/**
 * Chest Processor — Domain-specific processing for chest imaging.
 * Lung/lobe, pleura, effusion, consolidation, nodules.
 * No vertebra logic.
 */
import type { ChestFindingSchema } from "../domainSchemas";

export interface ChestProcessorInput {
  studySummary: string;
  sliceCount: number;
  modality: string;
  detectedAnomalies: Array<{
    region?: string;
    pathologyType: string;
    description: string;
    confidence: number;
  }>;
}

export function buildChestFindings(input: ChestProcessorInput): ChestFindingSchema {
  const { detectedAnomalies } = input;

  const lungLobeFindings = detectedAnomalies
    .filter((a) => a.region)
    .map((a) => ({ lobe: a.region!, finding: a.description }));

  if (lungLobeFindings.length === 0) {
    lungLobeFindings.push({ lobe: "General", finding: "No focal pulmonary abnormality." });
  }

  const pleuraEffusionConsolidation = detectedAnomalies
    .filter(
      (a) =>
        a.pathologyType.includes("effusion") ||
        a.pathologyType.includes("consolidation") ||
        a.pathologyType.includes("pleura") ||
        a.description.toLowerCase().includes("effusion") ||
        a.description.toLowerCase().includes("consolidation") ||
        a.description.toLowerCase().includes("pleural")
    )
    .map((a) => a.description);

  const noduleFindings = detectedAnomalies
    .filter(
      (a) =>
        a.pathologyType.includes("nodule") ||
        a.description.toLowerCase().includes("nodule")
    )
    .map((a) => a.description);

  const mediastinumFindings = detectedAnomalies
    .filter(
      (a) =>
        a.pathologyType.includes("mediastinum") ||
        a.description.toLowerCase().includes("mediastinum") ||
        a.description.toLowerCase().includes("hilar")
    )
    .map((a) => a.description);

  const abnormalities = detectedAnomalies
    .filter((a) => a.confidence >= 0.5)
    .map((a) => a.description);

  const impression =
    abnormalities.length > 0
      ? abnormalities.slice(0, 3).join(". ")
      : "No significant thoracic abnormality detected.";

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

  return {
    domain: "chest",
    lungLobeFindings,
    pleuraEffusionConsolidation,
    noduleFindings,
    mediastinumFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };
}
