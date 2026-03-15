/**
 * Single source of truth for Vertex AI / Gemini model configuration.
 *
 * IMPORTANT: Do not use retired Gemini 1.5 models (gemini-1.5-flash-001,
 * gemini-1.5-pro-002, etc.) — they return 404.
 *
 * Use only Gemini 2.5 / 2.0 models. Override via env vars if needed.
 */

export const VERTEX_CONFIG = {
  projectId: process.env.VERTEX_PROJECT_ID || "rapiddoc",
  location: process.env.VERTEX_LOCATION || "us-central1",

  /** Model for classification and extraction. Single model to avoid 404 from broken fallbacks. */
  model:
    process.env.VERTEX_MODEL ||
    "gemini-2.5-flash",

  /** Backup model only if primary fails with non-404. Prefer one working model over two broken. */
  fallbackModel:
    process.env.VERTEX_FALLBACK_MODEL ||
    "gemini-2.0-flash-001",
} as const;

export function getVertexEndpoint(model: string): string {
  const { projectId, location } = VERTEX_CONFIG;
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
}
