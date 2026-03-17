/**
 * Spine Analyzer — domain-specific image analysis for spine imaging.
 * Consumes actual image content via Vertex, returns SpineFindingSchema-compatible findings.
 */
import type { SpineFindingSchema } from "../domainSchemas";
import type { PerSliceObservation, StudyAggregation, AnalyzerResult } from "./types";
import { googleHealthcare } from "@/lib/googleHealthcare";
import type { MedicalDomain } from "../domainRouter";

const DOMAIN: MedicalDomain = "spine";

function parseSpineResponse(raw: unknown): {
  findings: SpineFindingSchema;
  confidence: number;
  limitations: string[];
  evidenceSummary: string;
} {
  const obj = raw as Record<string, unknown>;
  const vertebraeFindings = Array.isArray(obj.vertebraeFindings)
    ? (obj.vertebraeFindings as Array<{ level?: string; finding?: string }>)
        .filter((x) => x && typeof x === "object" && (x.level || x.finding))
        .map((x) => ({ level: String(x.level ?? "Unknown"), finding: String(x.finding ?? "") }))
    : [{ level: "General", finding: "No significant vertebral finding." }];

  const canalForaminaFindings = Array.isArray(obj.canalForaminaFindings)
    ? (obj.canalForaminaFindings as unknown[]).map(String).filter(Boolean)
    : [];

  const discFindings = Array.isArray(obj.discFindings)
    ? (obj.discFindings as unknown[]).map(String).filter(Boolean)
    : [];

  const abnormalities = Array.isArray(obj.abnormalities)
    ? (obj.abnormalities as unknown[]).map(String).filter(Boolean)
    : [];

  const impression = typeof obj.impression === "string" ? obj.impression : "Assessment based on provided image.";

  const recommendedNextSteps = Array.isArray(obj.recommendedNextSteps)
    ? (obj.recommendedNextSteps as unknown[]).map(String).filter(Boolean)
    : ["Routine follow-up per clinical indication."];

  const confidence = typeof obj.confidence === "number" ? Math.max(0, Math.min(100, obj.confidence)) : 50;
  const limitations = Array.isArray(obj.limitations) ? (obj.limitations as unknown[]).map(String).filter(Boolean) : [];
  const evidenceSummary =
    typeof obj.evidenceSummary === "string" ? obj.evidenceSummary : "Image analysis performed.";

  const findings: SpineFindingSchema = {
    domain: "spine",
    vertebraeFindings,
    canalForaminaFindings,
    discFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };

  return { findings, confidence, limitations, evidenceSummary };
}

/** Analyze a single spine image. */
export async function analyzeSpine(
  imageBase64: string,
  language: "tr" | "en" = "en",
  options?: { modality?: string; anatomicalRegion?: string }
): Promise<AnalyzerResult<SpineFindingSchema>> {
  const raw = await googleHealthcare.runDomainStructuredAnalysis(DOMAIN, imageBase64, language, {
    modality: options?.modality,
    anatomicalRegion: options?.anatomicalRegion,
  });
  const { findings, confidence, limitations, evidenceSummary } = parseSpineResponse(raw);

  const perSlice: PerSliceObservation<SpineFindingSchema> = {
    sliceIndex: 0,
    totalSlices: 1,
    findings,
    confidence,
    limitations,
    evidenceSummary,
  };

  return {
    findings,
    perSliceObservations: [perSlice],
    confidence,
    limitations,
    evidenceSummary,
  };
}

/** Analyze multiple spine slices and aggregate. */
export async function analyzeSpineStudy(
  imagesBase64: string[],
  language: "tr" | "en" = "en",
  options?: { modality?: string; anatomicalRegion?: string }
): Promise<AnalyzerResult<SpineFindingSchema>> {
  if (imagesBase64.length === 0) {
    const emptyFindings: SpineFindingSchema = {
      domain: "spine",
      vertebraeFindings: [{ level: "N/A", finding: "No images provided." }],
      canalForaminaFindings: [],
      discFindings: [],
      abnormalities: [],
      impression: "No analysis possible; no images provided.",
      recommendedNextSteps: ["Provide diagnostic images for assessment."],
    };
    return {
      findings: emptyFindings,
      confidence: 0,
      limitations: ["No images provided."],
      evidenceSummary: "N/A",
    };
  }

  const observations: PerSliceObservation<SpineFindingSchema>[] = [];
  const totalSlices = imagesBase64.length;

  for (let i = 0; i < imagesBase64.length; i++) {
    const raw = await googleHealthcare.runDomainStructuredAnalysis(DOMAIN, imagesBase64[i], language, {
      sliceIndex: i,
      totalSlices,
      modality: options?.modality,
      anatomicalRegion: options?.anatomicalRegion,
    });
    const { findings, confidence, limitations, evidenceSummary } = parseSpineResponse(raw);
    observations.push({
      sliceIndex: i,
      totalSlices,
      findings,
      confidence,
      limitations,
      evidenceSummary,
    });
  }

  const aggregation = aggregateSpineSlices(observations);

  return {
    findings: aggregation.studyLevelFindings,
    perSliceObservations: observations,
    studyAggregation: aggregation,
    confidence: aggregation.aggregatedConfidence,
    limitations: aggregation.aggregatedLimitations,
    evidenceSummary: aggregation.evidenceSummary,
  };
}

/** Aggregate per-slice spine observations into study-level findings. */
export function aggregateSpineSlices(
  observations: PerSliceObservation<SpineFindingSchema>[]
): StudyAggregation<SpineFindingSchema> {
  if (observations.length === 0) {
    const empty: SpineFindingSchema = {
      domain: "spine",
      vertebraeFindings: [{ level: "General", finding: "No observations." }],
      canalForaminaFindings: [],
      discFindings: [],
      abnormalities: [],
      impression: "No observations to aggregate.",
      recommendedNextSteps: [],
    };
    return {
      studyLevelFindings: empty,
      perSliceObservations: [],
      aggregatedConfidence: 0,
      aggregatedLimitations: ["No slices to aggregate."],
      evidenceSummary: "N/A",
    };
  }

  const levelMap = new Map<string, string>();
  const canal: string[] = [];
  const disc: string[] = [];
  const abnormalities: string[] = [];
  const allLimitations: string[] = [];
  let confidenceSum = 0;

  for (const obs of observations) {
    for (const v of obs.findings.vertebraeFindings) {
      const key = v.level;
      if (!levelMap.has(key) || v.finding) levelMap.set(key, v.finding);
    }
    canal.push(...obs.findings.canalForaminaFindings);
    disc.push(...obs.findings.discFindings);
    abnormalities.push(...obs.findings.abnormalities);
    allLimitations.push(...obs.limitations);
    confidenceSum += obs.confidence;
  }

  const vertebraeFindings = Array.from(levelMap.entries()).map(([level, finding]) => ({ level, finding }));
  if (vertebraeFindings.length === 0) {
    vertebraeFindings.push({ level: "General", finding: "No significant vertebral finding across slices." });
  }

  const aggregatedConfidence = Math.round(confidenceSum / observations.length);
  const uniqueLimitations = [...new Set(allLimitations)];
  const impression =
    abnormalities.length > 0
      ? `Study-level: ${[...new Set(abnormalities)].slice(0, 3).join(". ")}`
      : "No significant spine abnormality detected across slices.";

  const recommendedNextSteps: string[] = [];
  if (abnormalities.some((a) => a.toLowerCase().includes("fracture"))) {
    recommendedNextSteps.push("Consider orthopedic or neurosurgery consultation.");
  }
  if (abnormalities.some((a) => a.toLowerCase().includes("disc") || a.toLowerCase().includes("disk"))) {
    recommendedNextSteps.push("MRI may provide additional soft tissue detail if clinically indicated.");
  }
  if (abnormalities.some((a) => a.toLowerCase().includes("canal") || a.toLowerCase().includes("stenosis"))) {
    recommendedNextSteps.push("Correlate with clinical symptoms. Consider MRI for cord signal evaluation.");
  }
  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push("Routine follow-up per clinical indication.");
  }

  const studyLevelFindings: SpineFindingSchema = {
    domain: "spine",
    vertebraeFindings,
    canalForaminaFindings: [...new Set(canal)],
    discFindings: [...new Set(disc)],
    abnormalities: [...new Set(abnormalities)],
    impression,
    recommendedNextSteps,
  };

  return {
    studyLevelFindings,
    perSliceObservations: observations,
    aggregatedConfidence,
    aggregatedLimitations: uniqueLimitations,
    evidenceSummary: `Aggregated from ${observations.length} slice(s).`,
  };
}
