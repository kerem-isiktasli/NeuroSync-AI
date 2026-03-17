/**
 * Document Processor — OCR extraction for reports/documents.
 * Uses Document AI for PDF, or Vertex OCR for report images.
 */
import type { DocumentFindingSchema } from "../domainSchemas";

export interface DocumentProcessorInput {
  impression: string;
  findings: string[];
  clinicalHistory: string;
  rawText?: string;
}

export function buildDocumentFindings(input: DocumentProcessorInput): DocumentFindingSchema {
  const { impression, findings, clinicalHistory, rawText = "" } = input;

  const recommendations: string[] = [];
  const limitations: string[] = [];

  if (findings.some((f) => f.toLowerCase().includes("follow") || f.toLowerCase().includes("recommend"))) {
    const recIdx = findings.findIndex(
      (f) => f.toLowerCase().includes("follow") || f.toLowerCase().includes("recommend")
    );
    if (recIdx >= 0) recommendations.push(findings[recIdx]!);
  }

  if (!impression && findings.length === 0) {
    limitations.push("Limited or no structured content extracted from document.");
  }

  return {
    domain: "document-only",
    impression: impression || (findings.length > 0 ? findings[0]! : "No impression available."),
    findings: findings.length > 0 ? findings : [rawText.slice(0, 500) || "No findings extracted."],
    clinicalHistory: clinicalHistory || "",
    recommendations: recommendations.length > 0 ? recommendations : ["Clinical correlation recommended."],
    limitations,
  };
}
