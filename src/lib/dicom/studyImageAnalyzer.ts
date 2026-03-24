/**
 * DICOM Study Image Analyzer — Runs real slice-level image analysis.
 * Samples slices, renders to images, sends to Vertex for domain-specific analysis.
 */
import type { VolumeOutput } from "./volumeBuilder";
import type { OrderedSlice } from "./studyAssembler";
import type { VertebraIndexMap } from "./vertebraIndexing";
import { renderSliceToPng, getAnatomicallyBalancedSliceIndices } from "./sliceRenderer";
import { googleHealthcare } from "@/lib/googleHealthcare";
import { routeToDomain } from "@/lib/medical/domainRouter";
import type { MedicalDomain } from "@/lib/medical/domainRouter";

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

/** For small studies (≤ this count), analyze ALL slices. For larger, sample. */
const SMALL_STUDY_THRESHOLD = 20;
const MAX_SLICES_TO_ANALYZE = parseInt(
  process.env.MAX_DICOM_SLICES_ANALYZED || "16",
  10
);

export interface SliceFinding {
  sliceIndex: number;
  vertebraLevel?: string;
  findings: string[];
  abnormalities: string[];
  confidence: number;
  limitations: string[];
  sliceDescription: string;
}

export interface StudyImageAnalysisResult {
  sliceFindings: SliceFinding[];
  aggregatedFindings: string[];
  aggregatedAbnormalities: string[];
  analyzedSliceCount: number;
  totalSliceCount: number;
  sampledIndices: number[];
  domain: MedicalDomain;
  modality: string;
  anatomicalRegion: string;
  avgConfidence: number;
  hadImageAnalysis: boolean;
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
  // For small readable studies: analyze ALL slices, no sampling
  const effectiveMax = totalSlices <= SMALL_STUDY_THRESHOLD ? totalSlices : MAX_SLICES_TO_ANALYZE;
  const sampledIndices = getAnatomicallyBalancedSliceIndices(
    totalSlices,
    effectiveMax
  );
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
    message: isSampled
      ? `Representative sampling: analyzing ${sampledIndices.length} of ${totalSlices} slices.`
      : `Analyzing all ${totalSlices} slices (small study, no sampling).`,
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

  return {
    sliceFindings,
    aggregatedFindings,
    aggregatedAbnormalities,
    analyzedSliceCount: sliceFindings.length,
    totalSliceCount: totalSlices,
    sampledIndices,
    domain,
    modality,
    anatomicalRegion,
    avgConfidence,
    hadImageAnalysis: sliceFindings.length > 0,
  };
}
