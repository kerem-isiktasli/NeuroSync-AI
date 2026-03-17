/**
 * RapiMed AI / Healthcare Architecture — Service Responsibilities
 *
 * This module documents the intended responsibility split. Do NOT conflate
 * Cloud Healthcare API with diagnostic AI; each service has a distinct role.
 *
 * IMPLEMENTED:
 * - Vertex Gemini: image reasoning (classification, extraction, provisional OCR)
 * - Anthropic: synthesis, report chat
 *
 * FUTURE / STUBS:
 * - Cloud Healthcare API: DICOMweb study ingestion, study metadata
 * - Document AI: dedicated OCR for report screenshots/PDFs
 */

/** Study ingestion — DICOMweb, FHIR. Not a diagnostic model. */
export const HEALTHCARE_API_ROLE = "study_ingestion" as const;

/** OCR — Document AI for report screenshots and PDFs. */
export const DOCUMENT_AI_ROLE = "report_ocr" as const;

/** Multimodal image reasoning — Vertex Gemini. */
export const VERTEX_ROLE = "image_reasoning" as const;

/** Synthesis and chat — Anthropic or configured text model. */
export const SYNTHESIS_ROLE = "synthesis_chat" as const;

/** Pipeline stages for clear separation in code. */
export type PipelineStage =
  | "study_ingestion"   // Healthcare API: fetch study from DICOMweb
  | "report_ocr"       // Document AI: extract text from report screenshots
  | "image_reasoning"  // Vertex: classify, extract findings from images
  | "synthesis_chat";  // Anthropic: structured synthesis, report chat
