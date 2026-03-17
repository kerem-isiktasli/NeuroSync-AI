/**
 * Brain Analyzer — domain-specific image analysis for brain imaging.
 * Consumes actual image content via Vertex, returns BrainFindingSchema-compatible findings.
 */
import type { BrainFindingSchema } from "../domainSchemas";
import type { PerSliceObservation, StudyAggregation, AnalyzerResult } from "./types";
import { googleHealthcare } from "@/lib/googleHealthcare";
import type { MedicalDomain } from "../domainRouter";

const DOMAIN: MedicalDomain = "brain";

function parseBrainResponse(raw: unknown): {
  findings: BrainFindingSchema;
  confidence: number;
  limitations: string[];
  evidenceSummary: string;
} {
  const obj = raw as Record<string, unknown>;
  const lesionLocalization = Array.isArray(obj.lesionLocalization)
    ? (obj.lesionLocalization as Array<{ region?: string; finding?: string }>)
        .filter((x) => x && typeof x === "object" && (x.region || x.finding))
        .map((x) => ({ region: String(x.region ?? "General"), finding: String(x.finding ?? "") }))
    : [{ region: "General", finding: "No focal lesion identified." }];

  const hemorrhageEdemaMassEffect = Array.isArray(obj.hemorrhageEdemaMassEffect)
    ? (obj.hemorrhageEdemaMassEffect as unknown[]).map(String).filter(Boolean)
    : [];

  const ventricularFindings = Array.isArray(obj.ventricularFindings)
    ? (obj.ventricularFindings as unknown[]).map(String).filter(Boolean)
    : [];

  const extraAxialFindings = Array.isArray(obj.extraAxialFindings)
    ? (obj.extraAxialFindings as unknown[]).map(String).filter(Boolean)
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

  const findings: BrainFindingSchema = {
    domain: "brain",
    lesionLocalization,
    hemorrhageEdemaMassEffect,
    ventricularFindings,
    extraAxialFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };

  return { findings, confidence, limitations, evidenceSummary };
}

/** Analyze a single brain image. */
export async function analyzeBrain(
  imageBase64: string,
  language: "tr" | "en" = "en",
  options?: { modality?: string; anatomicalRegion?: string }
): Promise<AnalyzerResult<BrainFindingSchema>> {
  const raw = await googleHealthcare.runDomainStructuredAnalysis(DOMAIN, imageBase64, language, {
    modality: options?.modality,
    anatomicalRegion: options?.anatomicalRegion,
  });
  const { findings, confidence, limitations, evidenceSummary } = parseBrainResponse(raw);

  const perSlice: PerSliceObservation<BrainFindingSchema> = {
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

/** Analyze multiple brain slices and aggregate. */
export async function analyzeBrainStudy(
  imagesBase64: string[],
  language: "tr" | "en" = "en",
  options?: { modality?: string; anatomicalRegion?: string }
): Promise<AnalyzerResult<BrainFindingSchema>> {
  if (imagesBase64.length === 0) {
    const emptyFindings: BrainFindingSchema = {
      domain: "brain",
      lesionLocalization: [{ region: "General", finding: "No images provided." }],
      hemorrhageEdemaMassEffect: [],
      ventricularFindings: [],
      extraAxialFindings: [],
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

  const observations: PerSliceObservation<BrainFindingSchema>[] = [];
  const totalSlices = imagesBase64.length;

  for (let i = 0; i < imagesBase64.length; i++) {
    const raw = await googleHealthcare.runDomainStructuredAnalysis(DOMAIN, imagesBase64[i], language, {
      sliceIndex: i,
      totalSlices,
      modality: options?.modality,
      anatomicalRegion: options?.anatomicalRegion,
    });
    const { findings, confidence, limitations, evidenceSummary } = parseBrainResponse(raw);
    observations.push({
      sliceIndex: i,
      totalSlices,
      findings,
      confidence,
      limitations,
      evidenceSummary,
    });
  }

  const aggregation = aggregateBrainSlices(observations);

  return {
    findings: aggregation.studyLevelFindings,
    perSliceObservations: observations,
    studyAggregation: aggregation,
    confidence: aggregation.aggregatedConfidence,
    limitations: aggregation.aggregatedLimitations,
    evidenceSummary: aggregation.evidenceSummary,
  };
}

/** Aggregate per-slice brain observations into study-level findings. */
export function aggregateBrainSlices(
  observations: PerSliceObservation<BrainFindingSchema>[]
): StudyAggregation<BrainFindingSchema> {
  if (observations.length === 0) {
    const empty: BrainFindingSchema = {
      domain: "brain",
      lesionLocalization: [{ region: "General", finding: "No observations." }],
      hemorrhageEdemaMassEffect: [],
      ventricularFindings: [],
      extraAxialFindings: [],
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

  const lesionMap = new Map<string, string>();
  const hemorrhageEdema: string[] = [];
  const ventricular: string[] = [];
  const extraAxial: string[] = [];
  const abnormalities: string[] = [];
  const allLimitations: string[] = [];
  let confidenceSum = 0;

  for (const obs of observations) {
    for (const l of obs.findings.lesionLocalization) {
      const key = l.region;
      if (!lesionMap.has(key) || l.finding) lesionMap.set(key, l.finding);
    }
    hemorrhageEdema.push(...obs.findings.hemorrhageEdemaMassEffect);
    ventricular.push(...obs.findings.ventricularFindings);
    extraAxial.push(...obs.findings.extraAxialFindings);
    abnormalities.push(...obs.findings.abnormalities);
    allLimitations.push(...obs.limitations);
    confidenceSum += obs.confidence;
  }

  const lesionLocalization = Array.from(lesionMap.entries()).map(([region, finding]) => ({ region, finding }));
  if (lesionLocalization.length === 0) {
    lesionLocalization.push({ region: "General", finding: "No focal lesion identified across slices." });
  }

  const aggregatedConfidence = Math.round(confidenceSum / observations.length);
  const uniqueLimitations = [...new Set(allLimitations)];
  const impression =
    abnormalities.length > 0
      ? `Study-level: ${[...new Set(abnormalities)].slice(0, 3).join(". ")}`
      : "No significant intracranial abnormality detected across slices.";

  const studyLevelFindings: BrainFindingSchema = {
    domain: "brain",
    lesionLocalization,
    hemorrhageEdemaMassEffect: [...new Set(hemorrhageEdema)],
    ventricularFindings: [...new Set(ventricular)],
    extraAxialFindings: [...new Set(extraAxial)],
    abnormalities: [...new Set(abnormalities)],
    impression,
    recommendedNextSteps:
      abnormalities.some((a) => a.toLowerCase().includes("hemorrhage")) ||
      abnormalities.some((a) => a.toLowerCase().includes("mass")) ||
      hemorrhageEdema.some((a) => a.toLowerCase().includes("hemorrhage")) ||
      hemorrhageEdema.some((a) => a.toLowerCase().includes("mass"))
        ? ["Urgent clinical correlation and possible follow-up imaging."]
        : ["Routine follow-up per clinical indication."],
  };

  return {
    studyLevelFindings,
    perSliceObservations: observations,
    aggregatedConfidence,
    aggregatedLimitations: uniqueLimitations,
    evidenceSummary: `Aggregated from ${observations.length} slice(s).`,
  };
}
