/**
 * Single source of truth for Vertex AI / Gemini model configuration.
 *
 * Env vars (from your .env):
 * - GOOGLE_PROJECT_ID, GOOGLE_LOCATION
 * - VERTEX_CLASSIFICATION_MODEL (intake, classification — fast multimodal)
 * - VERTEX_EXTRACTION_MODEL (deep medical reasoning — higher-reasoning)
 * - VERTEX_MODEL (legacy: used when classification/extraction not set)
 */

export const VERTEX_CONFIG = {
  projectId:
    process.env.GOOGLE_PROJECT_ID ||
    process.env.VERTEX_PROJECT_ID ||
    "rapiddoc",
  location:
    process.env.GOOGLE_LOCATION ||
    process.env.VERTEX_LOCATION ||
    "us-central1",

  /** Fast model for classification, intake, and OCR. */
  classificationModel:
    process.env.VERTEX_CLASSIFICATION_MODEL ||
    process.env.VERTEX_MODEL ||
    "gemini-2.5-flash",

  /** Higher-reasoning model for extraction / medical reasoning / report synthesis. */
  extractionModel:
    process.env.VERTEX_EXTRACTION_MODEL ||
    "gemini-2.5-pro",

  /** Primary model (used for OCR, fusion when no dedicated model). */
  model:
    process.env.VERTEX_MODEL ||
    "gemini-2.5-flash",
} as const;

export function getVertexEndpoint(model: string): string {
  const { projectId, location } = VERTEX_CONFIG;
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

/**
 * Max parallel Vertex calls this process should schedule (align with googleHealthcare permit pool).
 */
export function getVertexGlobalConcurrencyCap(): number {
  const n = parseInt(process.env.VERTEX_GLOBAL_CONCURRENCY ?? "2", 10);
  return Math.max(1, Math.min(16, Number.isFinite(n) ? n : 2));
}
