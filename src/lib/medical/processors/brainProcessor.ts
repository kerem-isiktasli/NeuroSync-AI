/**
 * Brain Processor — Domain-specific processing for brain imaging.
 * Lesion localization, hemorrhage/edema, region-specific findings.
 * No vertebra logic.
 */
import type { BrainFindingSchema } from "../domainSchemas";

export interface BrainProcessorInput {
  studySummary: string;
  sliceCount: number;
  modality: string;
  /** AI-detected anomalies (from Vertex or heuristic). */
  detectedAnomalies: Array<{ region?: string; pathologyType: string; description: string; confidence: number }>;
}

export function buildBrainFindings(input: BrainProcessorInput): BrainFindingSchema {
  const { detectedAnomalies } = input;

  const lesionLocalization = detectedAnomalies
    .filter((a) => a.region)
    .map((a) => ({ region: a.region!, finding: a.description }));

  if (lesionLocalization.length === 0) {
    lesionLocalization.push({ region: "General", finding: "No focal lesion identified." });
  }

  const hemorrhageEdemaMassEffect = detectedAnomalies
    .filter(
      (a) =>
        a.pathologyType.includes("hemorrhage") ||
        a.pathologyType.includes("edema") ||
        a.pathologyType.includes("mass_effect") ||
        a.description.toLowerCase().includes("hemorrhage") ||
        a.description.toLowerCase().includes("edema")
    )
    .map((a) => a.description);

  const ventricularFindings = detectedAnomalies
    .filter(
      (a) =>
        a.pathologyType.includes("ventricle") ||
        a.description.toLowerCase().includes("ventricle")
    )
    .map((a) => a.description);

  const extraAxialFindings = detectedAnomalies
    .filter(
      (a) =>
        a.pathologyType.includes("extra_axial") ||
        a.description.toLowerCase().includes("subdural") ||
        a.description.toLowerCase().includes("epidural")
    )
    .map((a) => a.description);

  const abnormalities = detectedAnomalies
    .filter((a) => a.confidence >= 0.5)
    .map((a) => a.description);

  const impression =
    abnormalities.length > 0
      ? abnormalities.slice(0, 3).join(". ")
      : "No significant intracranial abnormality detected.";

  const recommendedNextSteps: string[] = [];
  if (abnormalities.some((a) => a.toLowerCase().includes("hemorrhage"))) {
    recommendedNextSteps.push("Urgent clinical correlation and possible follow-up imaging.");
  }
  if (abnormalities.some((a) => a.toLowerCase().includes("mass"))) {
    recommendedNextSteps.push("Consider contrast-enhanced MRI or specialist referral.");
  }
  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push("Routine follow-up per clinical indication.");
  }

  return {
    domain: "brain",
    lesionLocalization,
    hemorrhageEdemaMassEffect,
    ventricularFindings,
    extraAxialFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };
}
