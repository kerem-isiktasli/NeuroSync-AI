/**
 * Lab Document Processor — Extracts structured lab values from lab reports.
 * Schema: analytes, abnormal flags, reference ranges, clinical interpretation caveats.
 * Do NOT treat labs like radiology.
 */

import type { LabFindingSchema } from "../domainSchemas";

export interface LabProcessorInput {
  rawText: string;
  /** Parsed analytes from OCR/LLM extraction */
  analytes?: Array<{
    name: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: "high" | "low" | "critical" | "normal";
  }>;
  /** Manually extracted abnormal flags if available */
  abnormalFlags?: string[];
  /** Reference range strings if detected */
  referenceRanges?: string[];
}

/**
 * Build structured lab summary from extracted content.
 */
export function buildLabFindings(input: LabProcessorInput): LabFindingSchema {
  const { rawText, analytes = [], abnormalFlags = [], referenceRanges = [] } = input;

  const clinicalInterpretationCaveats: string[] = [];
  const recommendations: string[] = [];
  const limitations: string[] = [];

  if (!rawText?.trim() && analytes.length === 0) {
    limitations.push("Limited or no lab content could be extracted from this document.");
  }

  const abnormalAnalytes = analytes.filter((a) => a.flag && a.flag !== "normal");
  const criticalCount = analytes.filter((a) => a.flag === "critical").length;

  if (criticalCount > 0) {
    recommendations.push("Critical values detected. Please discuss with your healthcare provider promptly.");
  }

  if (abnormalAnalytes.length > 0 && analytes.length > 0) {
    const pct = Math.round((abnormalAnalytes.length / analytes.length) * 100);
    if (pct > 20) {
      clinicalInterpretationCaveats.push(
        `Multiple values outside reference range (${abnormalAnalytes.length}/${analytes.length}). Clinical correlation recommended.`
      );
    }
  }

  const impression =
    abnormalAnalytes.length > 0
      ? `Lab report contains ${analytes.length} analyte(s). ${abnormalAnalytes.length} value(s) flagged outside reference range.`
      : analytes.length > 0
      ? `Lab report contains ${analytes.length} analyte(s). Values within reference range where provided.`
      : rawText
      ? "Lab report document extracted. Structured analyte parsing limited — raw text available for clinician review."
      : "No lab content could be extracted.";

  return {
    domain: "lab",
    analytes,
    abnormalFlags: abnormalFlags.length > 0 ? abnormalFlags : abnormalAnalytes.map((a) => `${a.name}: ${a.value} (${a.flag})`),
    referenceRanges,
    clinicalInterpretationCaveats,
    impression,
    recommendations: recommendations.length > 0 ? recommendations : ["Discuss results with your healthcare provider."],
    limitations,
  };
}
