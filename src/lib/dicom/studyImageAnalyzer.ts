/**
 * DICOM Study Image Analyzer — Runs real slice-level image analysis.
 * Samples slices, renders to images, sends to Vertex for domain-specific analysis.
 */
import type { VolumeOutput } from "./volumeBuilder";
import type { OrderedSlice } from "./studyAssembler";
import type { VertebraIndexMap } from "./vertebraIndexing";
import { renderSliceToPng } from "./sliceRenderer";
import { googleHealthcare } from "@/lib/googleHealthcare";
import { routeToDomain } from "@/lib/medical/domainRouter";
import type { MedicalDomain } from "@/lib/medical/domainRouter";
import {
  getSelectionTarget,
  selectVarianceStratifiedSliceIndices,
} from "@/services/dicom-slice-selector";

/** Max simultaneous Vertex slice calls. Keep at 3 to stay under Vertex RPM quota. */
const SLICE_CONCURRENCY = 3;

async function withConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>
): Promise<void> {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx]!, idx);
      }
    }
  );
  await Promise.all(workers);
}

export interface SliceFinding {
  sliceIndex: number;
  vertebraLevel?: string;
  findings: string[];
  abnormalities: string[];
  confidence: number;
  limitations: string[];
  sliceDescription: string;
}

export interface DicomTwoStageStats {
  triagedSlices: number;
  triageCalls: number;
  deepCalls: number;
  deepBudget: number;
  deepQueueTruncated: boolean;
  truncatedDropCount: number;
  zeroFlagBalancedFallback: boolean;
  triageDurationMs: number;
  deepDurationMs: number;
}

export interface StudyImageAnalysisResult {
  sliceFindings: SliceFinding[];
  aggregatedFindings: string[];
  aggregatedAbnormalities: string[];
  analyzedSliceCount: number;
  totalSliceCount: number;
  sampledIndices: number[];
  /** Slices where Vertex returned usable output (vs timeout/API failure rows). */
  successfulSliceCount: number;
  failedSliceIndices: number[];
  sliceSelectionStrategy: string;
  domain: MedicalDomain;
  modality: string;
  anatomicalRegion: string;
  avgConfidence: number;
  hadImageAnalysis: boolean;
  dicomTwoStageStats?: DicomTwoStageStats;
}

/** False when the row is a placeholder after timeout or Vertex failure. */
export function isSliceVertexAnalysisSuccessful(sf: SliceFinding): boolean {
  const lim = sf.limitations.join(" ").toLowerCase();
  return !(
    /analysis failed|deep analysis failed|vertex queue exhausted|request timeout|timed out/i.test(
      lim
    )
  );
}

/**
 * Convert slice findings to pathology-format observations for spine compatibility.
 */
export function toPathologyObservations(
  sliceFindings: SliceFinding[],
  vertebraIndexMap: VertebraIndexMap
): Array<{
  sliceIndex: number;
  vertebraLevel?: string;
  pathologyType: string;
  description: string;
  confidence: number;
}> {
  const obs: Array<{
    sliceIndex: number;
    vertebraLevel?: string;
    pathologyType: string;
    description: string;
    confidence: number;
  }> = [];

  for (const sf of sliceFindings) {
    if (!isSliceVertexAnalysisSuccessful(sf)) continue;
    const level = Object.entries(vertebraIndexMap).find(
      ([, idx]) => idx === sf.sliceIndex
    )?.[0];
    for (const abn of sf.abnormalities) {
      obs.push({
        sliceIndex: sf.sliceIndex,
        vertebraLevel: level,
        pathologyType: "other",
        description: abn,
        confidence: sf.confidence / 100,
      });
    }
    if (sf.abnormalities.length === 0 && sf.findings.length > 0) {
      obs.push({
        sliceIndex: sf.sliceIndex,
        vertebraLevel: level,
        pathologyType: "other",
        description: sf.findings[0] ?? "No significant finding.",
        confidence: sf.confidence / 100,
      });
    }
  }
  return obs;
}

export async function runStudyImageAnalysis(params: {
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

  const totalSlices = orderedSlices.length;
  const target = getSelectionTarget(totalSlices);
  let sampledIndices: number[];
  let sliceSelectionStrategy: string;
  if (totalSlices <= target) {
    sampledIndices = Array.from({ length: totalSlices }, (_, i) => i);
    sliceSelectionStrategy = "all";
  } else {
    const sel = selectVarianceStratifiedSliceIndices(volume, totalSlices, target);
    sampledIndices = sel.indices;
    sliceSelectionStrategy = sel.strategy;
  }
  const isSampled = sampledIndices.length < totalSlices;

  const domainRoute = routeToDomain({
    uploadType: "dicom-study",
    modality,
    anatomicalRegion,
    hasDicomStudy: true,
  });
  const domain = domainRoute.domain;

  const SLICE_TIMEOUT_MS = 45_000;
  const sliceFindings: SliceFinding[] = [];

  await sendEvent?.("log", {
    phase: "dicom-slice-plan",
    totalSlices,
    analyzingCount: sampledIndices.length,
    sampled: isSampled,
    strategy: sliceSelectionStrategy,
    message: isSampled
      ? `Sampling (${sliceSelectionStrategy}): analyzing ${sampledIndices.length} of ${totalSlices} slices.`
      : `Analyzing all ${totalSlices} slices (${sliceSelectionStrategy}).`,
  });

  const sharedToken = await googleHealthcare.getAccessToken();

  await withConcurrency(
    sampledIndices,
    SLICE_CONCURRENCY,
    async (sliceIndex, i) => {
      if (sliceIndex < 0 || sliceIndex >= totalSlices) return;

      await sendEvent?.("status", {
        step: "slice-analysis",
        message:
          language === "tr"
            ? `Kesit ${i + 1}/${sampledIndices.length} analiz ediliyor...`
            : `Analyzing slice ${i + 1}/${sampledIndices.length}...`,
      });

      const sliceStart = Date.now();
      try {
        const base64 = await renderSliceToPng({
          volume,
          sliceIndex,
        });

        const result = await Promise.race([
          googleHealthcare.analyzeDicomSlice(
            base64,
            { domain, modality, anatomicalRegion, sliceIndex, totalSlices, language },
            sharedToken
          ),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error("Slice analysis timeout")),
              SLICE_TIMEOUT_MS
            )
          ),
        ]);

        const level = Object.entries(vertebraIndexMap).find(
          ([, idx]) => idx === sliceIndex
        )?.[0];

        sliceFindings.push({
          sliceIndex,
          vertebraLevel: level,
          findings: result.findings,
          abnormalities: result.abnormalities,
          confidence: result.confidence,
          limitations: result.limitations,
          sliceDescription: result.sliceDescription,
        });

        if (process.env.NODE_ENV !== "production") {
          console.log(
            `[studyImageAnalyzer] Slice ${sliceIndex} OK ` +
              `(${Date.now() - sliceStart}ms)`
          );
        }
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : String(err);
        console.warn(
          `[studyImageAnalyzer] Slice ${sliceIndex} failed ` +
            `(${Date.now() - sliceStart}ms):`,
          errMsg
        );
        sliceFindings.push({
          sliceIndex,
          findings: [],
          abnormalities: [],
          confidence: 0,
          limitations: [`Analysis failed: ${errMsg}`],
          sliceDescription: "",
        });
      }
    }
  );

  sliceFindings.sort((a, b) => a.sliceIndex - b.sliceIndex);

  const aggregatedFindings = Array.from(
    new Set(
      sliceFindings.flatMap((s) => s.findings).filter(Boolean)
    )
  );
  const aggregatedAbnormalities = Array.from(
    new Set(
      sliceFindings.flatMap((s) => s.abnormalities).filter(Boolean)
    )
  );

  const confidences = sliceFindings
    .map((s) => s.confidence)
    .filter((c) => c > 0);
  const avgConfidence =
    confidences.length > 0
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0;

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
    sampledIndices,
    successfulSliceCount,
    failedSliceIndices,
    sliceSelectionStrategy,
    domain,
    modality,
    anatomicalRegion,
    avgConfidence,
    hadImageAnalysis: sliceFindings.length > 0,
  };
}
