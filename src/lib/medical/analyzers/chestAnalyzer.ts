/**
 * Chest Analyzer — domain-specific image analysis for chest imaging.
 * Consumes actual image content via Vertex, returns ChestFindingSchema-compatible findings.
 */
import type { ChestFindingSchema } from "../domainSchemas";
import type { PerSliceObservation, StudyAggregation, AnalyzerResult } from "./types";
import { googleHealthcare } from "@/lib/googleHealthcare";
import type { MedicalDomain } from "../domainRouter";

const DOMAIN: MedicalDomain = "chest";

function parseChestResponse(raw: unknown): {
  findings: ChestFindingSchema;
  confidence: number;
  limitations: string[];
  evidenceSummary: string;
} {
  const obj = raw as Record<string, unknown>;
  const lungLobeFindings = Array.isArray(obj.lungLobeFindings)
    ? (obj.lungLobeFindings as Array<{ lobe?: string; finding?: string }>)
        .filter((x) => x && typeof x === "object" && (x.lobe || x.finding))
        .map((x) => ({ lobe: String(x.lobe ?? "General"), finding: String(x.finding ?? "") }))
    : [{ lobe: "General", finding: "No focal pulmonary abnormality." }];

  const pleuraEffusionConsolidation = Array.isArray(obj.pleuraEffusionConsolidation)
    ? (obj.pleuraEffusionConsolidation as unknown[]).map(String).filter(Boolean)
    : [];

  const noduleFindings = Array.isArray(obj.noduleFindings)
    ? (obj.noduleFindings as unknown[]).map(String).filter(Boolean)
    : [];

  const mediastinumFindings = Array.isArray(obj.mediastinumFindings)
    ? (obj.mediastinumFindings as unknown[]).map(String).filter(Boolean)
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

  const findings: ChestFindingSchema = {
    domain: "chest",
    lungLobeFindings,
    pleuraEffusionConsolidation,
    noduleFindings,
    mediastinumFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };

  return { findings, confidence, limitations, evidenceSummary };
}

/** Analyze a single chest image. */
export async function analyzeChest(
  imageBase64: string,
  language: "tr" | "en" = "en",
  options?: { modality?: string; anatomicalRegion?: string }
): Promise<AnalyzerResult<ChestFindingSchema>> {
  const raw = await googleHealthcare.runDomainStructuredAnalysis(DOMAIN, imageBase64, language, {
    modality: options?.modality,
    anatomicalRegion: options?.anatomicalRegion,
  });
  const { findings, confidence, limitations, evidenceSummary } = parseChestResponse(raw);

  const perSlice: PerSliceObservation<ChestFindingSchema> = {
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

/** Analyze multiple chest slices and aggregate. */
export async function analyzeChestStudy(
  imagesBase64: string[],
  language: "tr" | "en" = "en",
  options?: { modality?: string; anatomicalRegion?: string }
): Promise<AnalyzerResult<ChestFindingSchema>> {
  if (imagesBase64.length === 0) {
    const emptyFindings: ChestFindingSchema = {
      domain: "chest",
      lungLobeFindings: [{ lobe: "General", finding: "No images provided." }],
      pleuraEffusionConsolidation: [],
      noduleFindings: [],
      mediastinumFindings: [],
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

  const observations: PerSliceObservation<ChestFindingSchema>[] = [];
  const totalSlices = imagesBase64.length;

  for (let i = 0; i < imagesBase64.length; i++) {
    const raw = await googleHealthcare.runDomainStructuredAnalysis(DOMAIN, imagesBase64[i], language, {
      sliceIndex: i,
      totalSlices,
      modality: options?.modality,
      anatomicalRegion: options?.anatomicalRegion,
    });
    const { findings, confidence, limitations, evidenceSummary } = parseChestResponse(raw);
    observations.push({
      sliceIndex: i,
      totalSlices,
      findings,
      confidence,
      limitations,
      evidenceSummary,
    });
  }

  const aggregation = aggregateChestSlices(observations);

  return {
    findings: aggregation.studyLevelFindings,
    perSliceObservations: observations,
    studyAggregation: aggregation,
    confidence: aggregation.aggregatedConfidence,
    limitations: aggregation.aggregatedLimitations,
    evidenceSummary: aggregation.evidenceSummary,
  };
}

/** Aggregate per-slice chest observations into study-level findings. */
export function aggregateChestSlices(
  observations: PerSliceObservation<ChestFindingSchema>[]
): StudyAggregation<ChestFindingSchema> {
  if (observations.length === 0) {
    const empty: ChestFindingSchema = {
      domain: "chest",
      lungLobeFindings: [{ lobe: "General", finding: "No observations." }],
      pleuraEffusionConsolidation: [],
      noduleFindings: [],
      mediastinumFindings: [],
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

  const lobeMap = new Map<string, string>();
  const pleura: string[] = [];
  const nodules: string[] = [];
  const mediastinum: string[] = [];
  const abnormalities: string[] = [];
  const allLimitations: string[] = [];
  let confidenceSum = 0;

  for (const obs of observations) {
    for (const l of obs.findings.lungLobeFindings) {
      const key = l.lobe;
      if (!lobeMap.has(key) || l.finding) lobeMap.set(key, l.finding);
    }
    pleura.push(...obs.findings.pleuraEffusionConsolidation);
    nodules.push(...obs.findings.noduleFindings);
    mediastinum.push(...obs.findings.mediastinumFindings);
    abnormalities.push(...obs.findings.abnormalities);
    allLimitations.push(...obs.limitations);
    confidenceSum += obs.confidence;
  }

  const lungLobeFindings = Array.from(lobeMap.entries()).map(([lobe, finding]) => ({ lobe, finding }));
  if (lungLobeFindings.length === 0) {
    lungLobeFindings.push({ lobe: "General", finding: "No focal pulmonary abnormality across slices." });
  }

  const aggregatedConfidence = Math.round(confidenceSum / observations.length);
  const uniqueLimitations = [...new Set(allLimitations)];
  const impression =
    abnormalities.length > 0
      ? `Study-level: ${[...new Set(abnormalities)].slice(0, 3).join(". ")}`
      : "No significant thoracic abnormality detected across slices.";

  const recommendedNextSteps: string[] = [];
  if (abnormalities.some((a) => a.toLowerCase().includes("nodule"))) {
    recommendedNextSteps.push("Consider follow-up CT for nodule characterization.");
  }
  if (abnormalities.some((a) => a.toLowerCase().includes("effusion"))) {
    recommendedNextSteps.push("Clinical correlation for effusion. Consider cause evaluation.");
  }
  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push("Routine follow-up per clinical indication.");
  }

  const studyLevelFindings: ChestFindingSchema = {
    domain: "chest",
    lungLobeFindings,
    pleuraEffusionConsolidation: [...new Set(pleura)],
    noduleFindings: [...new Set(nodules)],
    mediastinumFindings: [...new Set(mediastinum)],
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
