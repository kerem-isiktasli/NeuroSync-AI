/**
 * Two-stage DICOM slice analysis: Flash triage on all slices, Pro deep on queued subset.
 */
import type { VolumeOutput } from "./volumeBuilder";
import type { OrderedSlice } from "./studyAssembler";
import type { VertebraIndexMap } from "./vertebraIndexing";
import {
  renderSliceToPng,
  balancedDeepIndicesWhenTriageClear,
} from "./sliceRenderer";
import { googleHealthcare } from "@/lib/googleHealthcare";
import { routeToDomain } from "@/lib/medical/domainRouter";
import type { MedicalDomain } from "@/lib/medical/domainRouter";
import type { SliceFinding, StudyImageAnalysisResult } from "./studyImageAnalyzer";
import { isSliceVertexAnalysisSuccessful } from "./studyImageAnalyzer";
import { loadSliceTriagePipelineConfig } from "./sliceTriageConfig";
import {
  buildDeepQueue,
  collectFlaggedIndices,
  mergeClusters,
  computeDeepBudget,
  type TriageRow,
} from "./sliceTriageDeepQueue";
import {
  processWithQueue,
  isRetryableQuotaError,
  type QueueItem,
} from "@/services/vertex-queue";

export async function runTwoStageStudyImageAnalysis(params: {
  volume: VolumeOutput;
  orderedSlices: OrderedSlice[];
  modality: string;
  anatomicalRegion: string;
  vertebraIndexMap: VertebraIndexMap;
  language: "tr" | "en";
  sendEvent?: (type: string, data: unknown) => Promise<void>;
}): Promise<StudyImageAnalysisResult> {
  const {
    volume,
    orderedSlices,
    modality,
    anatomicalRegion,
    vertebraIndexMap,
    language,
    sendEvent,
  } = params;

  const cfg = loadSliceTriagePipelineConfig();
  const totalSlices = orderedSlices.length;
  const domainRoute = routeToDomain({
    uploadType: "dicom-study",
    modality,
    anatomicalRegion,
    hasDicomStudy: true,
  });
  const domain = domainRoute.domain;

  const token = await googleHealthcare.getAccessToken();

  await sendEvent?.("log", {
    phase: "dicom-two-stage-start",
    totalSlices,
    triageConcurrency: cfg.triageConcurrency,
    deepConcurrency: cfg.deepConcurrency,
    triageModel: cfg.triageModel,
    deepSliceModel: cfg.deepSliceModel,
    neighborRadius: cfg.neighborRadius,
    triageClearBelow: cfg.triageClearBelow,
    zeroFlagDeepMinSlices: cfg.zeroFlagDeepMinSlices,
    message: `Two-stage DICOM: triage all ${totalSlices} slices (maxSide=${cfg.triageMaxSide}), then deep queue.`,
  });

  const triageRows: TriageRow[] = new Array(totalSlices);
  const triageStarted = Date.now();

  const triageItems: QueueItem<TriageRow>[] = Array.from(
    { length: totalSlices },
    (_, sliceIndex) => ({
      id: sliceIndex,
      fn: async (): Promise<TriageRow> => {
        try {
          const jpegBase64 = await renderSliceToPng({
            volume,
            sliceIndex,
            maxSide: cfg.triageMaxSide,
          });
          const t = await googleHealthcare.triageDicomSlice(
            jpegBase64,
            { sliceIndex, totalSlices, language },
            token,
            {
              model: cfg.triageModel,
              timeoutMs: cfg.triageTimeoutMs,
              maxTokens: cfg.triageMaxTokens,
            }
          );
          return {
            slice_id: sliceIndex,
            score: t.score,
            triage_failed: false,
          };
        } catch (err) {
          if (isRetryableQuotaError(err)) throw err;
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`[twoStage] triage failed slice ${sliceIndex}:`, msg);
          return {
            slice_id: sliceIndex,
            score: 1.0,
            triage_failed: true,
          };
        }
      },
    })
  );

  const triageQueueResults = await processWithQueue(triageItems, {
    concurrency: cfg.triageConcurrency,
    requestTimeout: cfg.triageTimeoutMs + 20_000,
    retries: 3,
    baseDelay: 3_000,
    maxDelay: 25_000,
    onProgress: (completed, total, failed) => {
      void sendEvent?.("log", {
        phase: "dicom-triage-queue",
        completed,
        total,
        failed,
        message: `[twoStage] triage queue ${completed}/${total} (failed=${failed})`,
      });
    },
  });

  for (let i = 0; i < triageQueueResults.length; i++) {
    const r = triageQueueResults[i]!;
    const sliceIndex = i;
    if (r.success && r.data) {
      triageRows[sliceIndex] = r.data;
    } else {
      const msg = r.error?.message ?? "unknown";
      console.warn(`[twoStage] triage queue exhausted slice ${sliceIndex}:`, msg);
      triageRows[sliceIndex] = {
        slice_id: sliceIndex,
        score: 1.0,
        triage_failed: true,
      };
    }
  }

  const triageDurationMs = Date.now() - triageStarted;

  const rowsOrdered: TriageRow[] = triageRows.map((r, i) =>
    r
      ? r
      : { slice_id: i, score: 1.0, triage_failed: true }
  );

  const flagged = collectFlaggedIndices(rowsOrdered, cfg.triageClearBelow);
  const clusters = mergeClusters(flagged, cfg.clusterMaxGap);

  const budget = computeDeepBudget(
    totalSlices,
    flagged.length,
    clusters.length,
    cfg.neighborRadius
  );

  const queueFromTriage = buildDeepQueue(
    rowsOrdered,
    totalSlices,
    cfg.triageClearBelow,
    cfg.clusterMaxGap,
    cfg.neighborRadius,
    budget
  );

  let deepIndices = queueFromTriage.deepIndices;
  let zeroFlagBalancedFallback = false;
  if (deepIndices.length === 0 && totalSlices > 0) {
    deepIndices = balancedDeepIndicesWhenTriageClear(
      totalSlices,
      cfg.zeroFlagDeepMinSlices
    );
    zeroFlagBalancedFallback = true;
  }

  const {
    flaggedCount,
    truncated: deepQueueTruncated,
    truncatedDropCount,
  } = queueFromTriage;

  await sendEvent?.("log", {
    phase: "dicom-triage-done",
    totalSlices,
    triageDurationMs,
    triageCalls: totalSlices,
    triageFlagged: flaggedCount,
    deepPlanned: deepIndices.length,
    deepFromTriageQueue: queueFromTriage.deepIndices.length,
    deepBudget: budget,
    clusterCount: clusters.length,
    deepQueueTruncated,
    truncatedDropCount,
    zeroFlagBalancedFallback,
    message: zeroFlagBalancedFallback
      ? `Triage: no flags above threshold — balanced fallback deep on ${deepIndices.length} slice(s) (min=${cfg.zeroFlagDeepMinSlices}).`
      : deepQueueTruncated
        ? `Triage complete: ${flaggedCount} flagged; deep queue TRUNCATED (dropped ${truncatedDropCount}) to ${deepIndices.length} (budget ${budget}).`
        : `Triage complete: ${flaggedCount} flagged, ${deepIndices.length} deep slots (budget ${budget}).`,
  });

  const sliceFindings: SliceFinding[] = [];
  const deepStarted = Date.now();

  const deepItems: QueueItem<SliceFinding>[] = deepIndices.map(
    (sliceIndex: number) => ({
      id: sliceIndex,
      fn: async (): Promise<SliceFinding> => {
        await sendEvent?.("status", {
          step: "slice-analysis",
          message:
            language === "tr"
              ? `Derin analiz: kesit ${sliceIndex + 1}/${totalSlices}…`
              : `Deep analysis: slice ${sliceIndex + 1}/${totalSlices}…`,
        });

        const level = Object.entries(vertebraIndexMap).find(
          ([, idx]) => idx === sliceIndex
        )?.[0];

        try {
          const base64 = await renderSliceToPng({
            volume,
            sliceIndex,
          });

          const result = await googleHealthcare.analyzeDicomSlice(
            base64,
            {
              domain,
              modality,
              anatomicalRegion,
              sliceIndex,
              totalSlices,
              language,
            },
            token,
            {
              model: cfg.deepSliceModel,
              timeoutMs: cfg.deepTimeoutMs,
              maxTokens: cfg.deepMaxTokens,
            }
          );

          return {
            sliceIndex,
            vertebraLevel: level,
            findings: result.findings,
            abnormalities: result.abnormalities,
            confidence: result.confidence,
            limitations: result.limitations,
            sliceDescription: result.sliceDescription,
          };
        } catch (err) {
          if (isRetryableQuotaError(err)) throw err;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(`[twoStage] deep failed slice ${sliceIndex}:`, errMsg);
          return {
            sliceIndex,
            vertebraLevel: level,
            findings: [],
            abnormalities: [],
            confidence: 0,
            limitations: [
              `Deep analysis failed for this slice: ${errMsg}. Manual review recommended.`,
            ],
            sliceDescription: "",
          };
        }
      },
    })
  );

  const deepQueueResults = await processWithQueue(deepItems, {
    concurrency: cfg.deepConcurrency,
    requestTimeout: cfg.deepTimeoutMs + 20_000,
    retries: 3,
    baseDelay: 3_000,
    maxDelay: 25_000,
    onProgress: (completed, total, failed) => {
      void sendEvent?.("log", {
        phase: "dicom-deep-queue",
        completed,
        total,
        failed,
        message: `[twoStage] deep queue ${completed}/${total} (failed=${failed})`,
      });
    },
  });

  for (let i = 0; i < deepQueueResults.length; i++) {
    const r = deepQueueResults[i]!;
    const sliceIndex = deepIndices[i]!;
    if (r.success && r.data) {
      sliceFindings.push(r.data);
    } else {
      const errMsg = r.error?.message ?? "Vertex queue exhausted";
      console.warn(`[twoStage] deep queue exhausted slice ${sliceIndex}:`, errMsg);
      const level = Object.entries(vertebraIndexMap).find(
        ([, idx]) => idx === sliceIndex
      )?.[0];
      sliceFindings.push({
        sliceIndex,
        vertebraLevel: level,
        findings: [],
        abnormalities: [],
        confidence: 0,
        limitations: [
          `Deep analysis failed for this slice: ${errMsg}. Manual review recommended.`,
        ],
        sliceDescription: "",
      });
    }
  }

  const deepDurationMs = Date.now() - deepStarted;

  sliceFindings.sort((a, b) => a.sliceIndex - b.sliceIndex);

  const aggregatedFindings = Array.from(
    new Set(sliceFindings.flatMap((s) => s.findings).filter(Boolean))
  );
  const aggregatedAbnormalities = Array.from(
    new Set(sliceFindings.flatMap((s) => s.abnormalities).filter(Boolean))
  );

  const confidences = sliceFindings.map((s) => s.confidence).filter((c) => c > 0);
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

  await sendEvent?.("log", {
    phase: "dicom-two-stage-done",
    triagedSlices: totalSlices,
    triageDurationMs,
    deepDurationMs,
    triageCalls: totalSlices,
    deepCalls: deepIndices.length,
    deepAnalyzed: sliceFindings.length,
    deepQueueSize: deepIndices.length,
    deepBudget: budget,
    deepQueueTruncated,
    truncatedDropCount,
    zeroFlagBalancedFallback,
    message: `Two-stage complete: ${totalSlices} triaged (${triageDurationMs}ms), ${sliceFindings.length} deep results (${deepDurationMs}ms).`,
  });

  const successfulSliceCount = sliceFindings.filter(isSliceVertexAnalysisSuccessful).length;
  const failedSliceIndices = sliceFindings
    .filter((sf) => !isSliceVertexAnalysisSuccessful(sf))
    .map((sf) => sf.sliceIndex)
    .sort((a, b) => a - b);

  return {
    sliceFindings,
    aggregatedFindings,
    aggregatedAbnormalities,
    analyzedSliceCount: sliceFindings.length,
    totalSliceCount: totalSlices,
    sampledIndices: [...deepIndices].sort((a, b) => a - b),
    successfulSliceCount,
    failedSliceIndices,
    sliceSelectionStrategy: "two-stage-triage-deep",
    domain,
    modality,
    anatomicalRegion,
    avgConfidence,
    hadImageAnalysis: sliceFindings.length > 0,
    dicomTwoStageStats: {
      triagedSlices: totalSlices,
      triageCalls: totalSlices,
      deepCalls: deepIndices.length,
      deepBudget: budget,
      deepQueueTruncated,
      truncatedDropCount,
      zeroFlagBalancedFallback,
      triageDurationMs,
      deepDurationMs,
    },
  };
}
