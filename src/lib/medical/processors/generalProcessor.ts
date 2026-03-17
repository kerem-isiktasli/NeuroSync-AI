/**
 * General Processor — Fallback for MSK, vascular, general-radiology.
 * No domain-specific anatomy; flat findings structure.
 */
import type { GeneralFindingSchema } from "../domainSchemas";

export interface GeneralProcessorInput {
  findings: string[];
  abnormalities: string[];
  impression: string;
  modality: string;
  region: string;
}

export function buildGeneralFindings(input: GeneralProcessorInput): GeneralFindingSchema {
  const { findings, abnormalities, impression, modality, region } = input;

  const recommendedNextSteps: string[] = [];
  if (abnormalities.length > 0) {
    recommendedNextSteps.push("Clinical correlation and specialist review as indicated.");
  }
  recommendedNextSteps.push("Routine follow-up per clinical indication.");

  return {
    domain: modality.toLowerCase().includes("msk") || region.toLowerCase().includes("joint")
      ? "musculoskeletal"
      : modality.toLowerCase().includes("angio") || region.toLowerCase().includes("vascular")
        ? "vascular"
        : "general-radiology",
    findings: findings.length > 0 ? findings : ["No significant findings."],
    abnormalities,
    impression: impression || "No significant abnormality detected.",
    recommendedNextSteps,
  };
}
