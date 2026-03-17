/**
 * Spine Processor — Domain-specific processing for spine studies.
 * Uses vertebra mapping, canal/foramina/disc findings.
 * Only invoked when domain router selects "spine".
 */
import type { AssembledStudy } from "@/lib/dicom/studyAssembler";
import type { AnatomyMapping } from "@/lib/dicom/anatomyMapper";
import type { VertebraIndexMap } from "@/lib/dicom/vertebraIndexing";
import type { PathologyScanResult } from "@/lib/dicom/pathologyScanner";
import type { SpineFindingSchema } from "../domainSchemas";

export interface SpineProcessorInput {
  study: AssembledStudy;
  anatomy: AnatomyMapping;
  vertebraIndexMap: VertebraIndexMap;
  pathologyScan: PathologyScanResult;
}

export function buildSpineFindings(input: SpineProcessorInput): SpineFindingSchema {
  const { anatomy, pathologyScan, vertebraIndexMap } = input;
  const levels = Object.keys(vertebraIndexMap).sort();

  const vertebraeFindings = levels.map((level) => {
    const obs = pathologyScan.observations.filter((o) => o.vertebraLevel === level);
    const finding =
      obs.length > 0
        ? obs.map((o) => o.description).join("; ")
        : "No significant finding.";
    return { level, finding };
  });

  const discFindings = pathologyScan.observations
    .filter((o) => o.pathologyType === "disc_compression" || o.description.toLowerCase().includes("disc"))
    .map((o) => (o.vertebraLevel ? `${o.vertebraLevel}: ${o.description}` : o.description));

  const canalForaminaFindings = pathologyScan.observations
    .filter(
      (o) =>
        o.pathologyType === "spinal_canal_narrowing" ||
        o.description.toLowerCase().includes("canal") ||
        o.description.toLowerCase().includes("foramen")
    )
    .map((o) => o.description);

  const abnormalities = pathologyScan.observations
    .filter((o) => o.confidence >= 0.5)
    .map((o) => {
      const level = o.vertebraLevel ? ` (${o.vertebraLevel})` : "";
      return `${o.pathologyType.replace(/_/g, " ")}${level}: ${o.description}`;
    });

  const impression =
    pathologyScan.observations.length > 0
      ? pathologyScan.summary
      : "No significant abnormalities detected.";

  const recommendedNextSteps: string[] = [];
  if (pathologyScan.observations.some((o) => o.pathologyType === "fracture")) {
    recommendedNextSteps.push("Consider orthopedic or neurosurgery consultation.");
    recommendedNextSteps.push("Clinical correlation and follow-up imaging as indicated.");
  }
  if (pathologyScan.observations.some((o) => o.pathologyType === "disc_compression")) {
    recommendedNextSteps.push("MRI may provide additional soft tissue detail if clinically indicated.");
  }
  if (pathologyScan.observations.some((o) => o.pathologyType === "spinal_canal_narrowing")) {
    recommendedNextSteps.push(
      "Correlate with clinical symptoms. Consider MRI for cord signal evaluation."
    );
  }
  if (pathologyScan.observations.some((o) => o.pathologyType === "mass_tumor")) {
    recommendedNextSteps.push(
      "Tissue characterization with MRI or biopsy as clinically appropriate."
    );
  }
  if (recommendedNextSteps.length === 0) {
    recommendedNextSteps.push("Routine follow-up per clinical indication.");
  }

  return {
    domain: "spine",
    vertebraeFindings,
    canalForaminaFindings,
    discFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };
}
