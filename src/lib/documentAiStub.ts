/**
 * Document AI — REPORT OCR (future).
 *
 * Config from env: DOCUMENTAI_LOCATION, DOCUMENTAI_PROCESSOR_ID, GOOGLE_PROJECT_ID
 *
 * Purpose: Extract text from report screenshots and PDFs.
 * When implemented, use Document AI (forms, document parsers) for:
 * - Report screenshot OCR
 * - PDF report text extraction
 *
 * Current: Vertex Gemini runReportOcr() is used as provisional OCR.
 * Document AI will provide better accuracy for structured medical reports.
 */

export const DOCUMENT_AI_CONFIG = {
  projectId: process.env.GOOGLE_PROJECT_ID || process.env.VERTEX_PROJECT_ID,
  location: process.env.DOCUMENTAI_LOCATION || "us",
  processorId: process.env.DOCUMENTAI_PROCESSOR_ID || "",
} as const;

import type { ReportOcrResult } from "./ai/reportOcrPrompts";

/**
 * Stub: Extract report text via Document AI.
 * Returns null until implemented. Caller falls back to Vertex OCR.
 */
export async function extractReportTextViaDocumentAi(
  _imageBase64: string,
  _language: "tr" | "en"
): Promise<ReportOcrResult | null> {
  // Future: use @google-cloud/documentai
  return null;
}
