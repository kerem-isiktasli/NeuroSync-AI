/**
 * Abdomen Processor — Domain-specific processing for abdomen/pelvis imaging.
 * Organ-based: liver, kidney, pancreas, spleen, bowel, bladder.
 * No vertebra logic.
 */
import type { AbdomenFindingSchema } from "../domainSchemas";

export interface AbdomenProcessorInput {
  studySummary: string;
  sliceCount: number;
  modality: string;
  detectedAnomalies: Array<{
    organ?: string;
    pathologyType: string;
    description: string;
    confidence: number;
  }>;
}

export function buildAbdomenFindings(input: AbdomenProcessorInput): AbdomenFindingSchema {
  const { detectedAnomalies } = input;

  const organFindings = detectedAnomalies
    .filter((a) => a.organ)
    .map((a) => ({ organ: a.organ!, finding: a.description }));

  if (organFindings.length === 0) {
    organFindings.push({ organ: "General", finding: "No focal abnormality identified." });
  }

  const liverFindings = detectedAnomalies
    .filter(
      (a) =>
        (a.organ && a.organ.toLowerCase().includes("liver")) ||
        a.description.toLowerCase().includes("liver")
    )
    .map((a) => a.description);

  const kidneyFindings = detectedAnomalies
    .filter(
      (a) =>
        (a.organ && a.organ.toLowerCase().includes("kidney")) ||
        a.description.toLowerCase().includes("kidney")
    )
    .map((a) => a.description);

  const bowelBladderFindings = detectedAnomalies
    .filter(
      (a) =>
        a.description.toLowerCase().includes("bowel") ||
        a.description.toLowerCase().includes("bladder") ||
        a.description.toLowerCase().includes("colon")
    )
    .map((a) => a.description);

  const abnormalities = detectedAnomalies
    .filter((a) => a.confidence >= 0.5)
    .map((a) => a.description);

  const impression =
    abnormalities.length > 0
      ? abnormalities.slice(0, 3).join(". ")
      : "No significant abdominal abnormality detected.";

  const recommendedNextSteps: string[] = [];
  if (abnormalities.some((a) => a.toLowerCase().includes("mass") || a.toLowerCase().includes("lesion"))) {
    recommendedNextSteps.push("Consider further characterization with MRI or biopsy as clinically indicated.");
  }
  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push("Routine follow-up per clinical indication.");
  }

  return {
    domain: "abdomen-pelvis",
    organFindings,
    liverFindings,
    kidneyFindings,
    bowelBladderFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };
}
