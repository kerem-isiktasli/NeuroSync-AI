/**
 * Abdomen/Pelvis Analyzer — domain-specific image analysis for abdominal imaging.
 * Consumes actual image content via Vertex, returns AbdomenFindingSchema-compatible findings.
 */
import type { AbdomenFindingSchema } from "../domainSchemas";
import type { PerSliceObservation, StudyAggregation, AnalyzerResult } from "./types";
import { googleHealthcare } from "@/lib/googleHealthcare";
import type { MedicalDomain } from "../domainRouter";

const DOMAIN: MedicalDomain = "abdomen-pelvis";

function parseAbdomenResponse(raw: unknown): {
  findings: AbdomenFindingSchema;
  confidence: number;
  limitations: string[];
  evidenceSummary: string;
} {
  const obj = raw as Record<string, unknown>;
  const organFindings = Array.isArray(obj.organFindings)
    ? (obj.organFindings as Array<{ organ?: string; finding?: string }>)
        .filter((x) => x && typeof x === "object" && (x.organ || x.finding))
        .map((x) => ({ organ: String(x.organ ?? "General"), finding: String(x.finding ?? "") }))
    : [{ organ: "General", finding: "No focal abnormality identified." }];

  const liverFindings = Array.isArray(obj.liverFindings)
    ? (obj.liverFindings as unknown[]).map(String).filter(Boolean)
    : [];

  const kidneyFindings = Array.isArray(obj.kidneyFindings)
    ? (obj.kidneyFindings as unknown[]).map(String).filter(Boolean)
    : [];

  const bowelBladderFindings = Array.isArray(obj.bowelBladderFindings)
    ? (obj.bowelBladderFindings as unknown[]).map(String).filter(Boolean)
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

  const findings: AbdomenFindingSchema = {
    domain: "abdomen-pelvis",
    organFindings,
    liverFindings,
    kidneyFindings,
    bowelBladderFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };

  return { findings, confidence, limitations, evidenceSummary };
}

/** Analyze a single abdomen/pelvis image. */
export async function analyzeAbdomen(
  imageBase64: string,
  language: "tr" | "en" = "en",
  options?: { modality?: string; anatomicalRegion?: string }
): Promise<AnalyzerResult<AbdomenFindingSchema>> {
  const raw = await googleHealthcare.runDomainStructuredAnalysis(DOMAIN, imageBase64, language, {
    modality: options?.modality,
    anatomicalRegion: options?.anatomicalRegion,
  });
  const { findings, confidence, limitations, evidenceSummary } = parseAbdomenResponse(raw);

  const perSlice: PerSliceObservation<AbdomenFindingSchema> = {
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

/** Analyze multiple abdomen slices and aggregate. */
export async function analyzeAbdomenStudy(
  imagesBase64: string[],
  language: "tr" | "en" = "en",
  options?: { modality?: string; anatomicalRegion?: string }
): Promise<AnalyzerResult<AbdomenFindingSchema>> {
  if (imagesBase64.length === 0) {
    const emptyFindings: AbdomenFindingSchema = {
      domain: "abdomen-pelvis",
      organFindings: [{ organ: "General", finding: "No images provided." }],
      liverFindings: [],
      kidneyFindings: [],
      bowelBladderFindings: [],
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

  const observations: PerSliceObservation<AbdomenFindingSchema>[] = [];
  const totalSlices = imagesBase64.length;

  for (let i = 0; i < imagesBase64.length; i++) {
    const raw = await googleHealthcare.runDomainStructuredAnalysis(DOMAIN, imagesBase64[i], language, {
      sliceIndex: i,
      totalSlices,
      modality: options?.modality,
      anatomicalRegion: options?.anatomicalRegion,
    });
    const { findings, confidence, limitations, evidenceSummary } = parseAbdomenResponse(raw);
    observations.push({
      sliceIndex: i,
      totalSlices,
      findings,
      confidence,
      limitations,
      evidenceSummary,
    });
  }

  const aggregation = aggregateAbdomenSlices(observations);

  return {
    findings: aggregation.studyLevelFindings,
    perSliceObservations: observations,
    studyAggregation: aggregation,
    confidence: aggregation.aggregatedConfidence,
    limitations: aggregation.aggregatedLimitations,
    evidenceSummary: aggregation.evidenceSummary,
  };
}

/** Aggregate per-slice abdomen observations into study-level findings. */
export function aggregateAbdomenSlices(
  observations: PerSliceObservation<AbdomenFindingSchema>[]
): StudyAggregation<AbdomenFindingSchema> {
  if (observations.length === 0) {
    const empty: AbdomenFindingSchema = {
      domain: "abdomen-pelvis",
      organFindings: [{ organ: "General", finding: "No observations." }],
      liverFindings: [],
      kidneyFindings: [],
      bowelBladderFindings: [],
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

  const organMap = new Map<string, string>();
  const liver: string[] = [];
  const kidney: string[] = [];
  const bowel: string[] = [];
  const abnormalities: string[] = [];
  const allLimitations: string[] = [];
  let confidenceSum = 0;

  for (const obs of observations) {
    for (const o of obs.findings.organFindings) {
      const key = o.organ;
      if (!organMap.has(key) || o.finding) organMap.set(key, o.finding);
    }
    liver.push(...obs.findings.liverFindings);
    kidney.push(...obs.findings.kidneyFindings);
    bowel.push(...obs.findings.bowelBladderFindings);
    abnormalities.push(...obs.findings.abnormalities);
    allLimitations.push(...obs.limitations);
    confidenceSum += obs.confidence;
  }

  const organFindings = Array.from(organMap.entries()).map(([organ, finding]) => ({ organ, finding }));
  if (organFindings.length === 0) {
    organFindings.push({ organ: "General", finding: "No focal abnormality identified across slices." });
  }

  const aggregatedConfidence = Math.round(confidenceSum / observations.length);
  const uniqueLimitations = [...new Set(allLimitations)];
  const impression =
    abnormalities.length > 0
      ? `Study-level: ${[...new Set(abnormalities)].slice(0, 3).join(". ")}`
      : "No significant abdominal abnormality detected across slices.";

  const recommendedNextSteps: string[] = [];
  if (abnormalities.some((a) => a.toLowerCase().includes("mass") || a.toLowerCase().includes("lesion"))) {
    recommendedNextSteps.push("Consider further characterization with MRI or biopsy as clinically indicated.");
  }
  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push("Routine follow-up per clinical indication.");
  }

  const studyLevelFindings: AbdomenFindingSchema = {
    domain: "abdomen-pelvis",
    organFindings,
    liverFindings: [...new Set(liver)],
    kidneyFindings: [...new Set(kidney)],
    bowelBladderFindings: [...new Set(bowel)],
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
