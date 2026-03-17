/**
 * Pathology Document Processor — Extracts structured pathology data.
 * Schema: specimen, diagnosis, histologic type, grade, stage, markers.
 * Do NOT treat pathology like radiology.
 */

import type { PathologyFindingSchema } from "../domainSchemas";

export interface PathologyProcessorInput {
  rawText: string;
  specimen?: string;
  diagnosis?: string;
  histologicType?: string;
  grade?: string;
  stage?: string;
  markers?: string[];
  margins?: string[];
}

/**
 * Build structured pathology summary from extracted content.
 */
export function buildPathologyFindings(input: PathologyProcessorInput): PathologyFindingSchema {
  const {
    rawText,
    specimen = "",
    diagnosis = "",
    histologicType,
    grade,
    stage,
    markers = [],
    margins = [],
  } = input;

  const limitations: string[] = [];
  const recommendations: string[] = ["Pathology reports should be interpreted by a pathologist or treating physician."];

  if (!rawText?.trim() && !diagnosis && !specimen) {
    limitations.push("Limited or no pathology content could be extracted from this document.");
  }

  const impression =
    diagnosis
      ? `Pathology report: ${diagnosis}${specimen ? `. Specimen: ${specimen}` : ""}`
      : specimen
      ? `Pathology report extracted. Specimen: ${specimen}. Full diagnosis text requires review.`
      : rawText
      ? "Pathology document extracted. Structured parsing limited — raw text available for pathologist review."
      : "No pathology content could be extracted.";

  return {
    domain: "pathology",
    specimen,
    diagnosis,
    histologicType,
    grade,
    stage,
    markers,
    margins,
    limitations,
    impression,
    recommendations,
  };
}
