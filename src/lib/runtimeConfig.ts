/**
 * Server-side runtime configuration.
 * Loads from Firestore config (admin-managed) with env fallbacks.
 * Used by analyze, report-chat, and other API routes.
 * Uses Firebase Admin to bypass auth for config read.
 */

const CONFIG_COLLECTION = "config";
const ACTIVE_DOC = "active";
const DEFAULT_VERSION = "1.0";

export interface RuntimeConfig {
  version: string;
  updatedAt: string;

  // AI providers
  vertexModel: string;
  vertexFallbackModel: string;
  anthropicModel: string;

  // Feature flags
  ocrEnabled: boolean;
  literatureEnabled: boolean;
  fusionEnabled: boolean;

  // Limits
  maxImages: number;
  maxImageBytes: number;

  // Thresholds
  classificationConfidenceThreshold: number;

  // Prompt/schema version (for cache invalidation)
  promptVersionKey: string;
  schemaVersion: string;
}

const DEFAULTS: RuntimeConfig = {
  version: DEFAULT_VERSION,
  updatedAt: new Date().toISOString(),
  vertexModel: process.env.VERTEX_EXTRACTION_MODEL || process.env.VERTEX_MODEL || "gemini-2.5-flash",
  vertexFallbackModel: process.env.VERTEX_FALLBACK_MODEL || "gemini-2.5-flash",
  anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-4.5",
  ocrEnabled: true,
  literatureEnabled: true,
  fusionEnabled: true,
  maxImages: 8,
  maxImageBytes: 20 * 1024 * 1024,
  classificationConfidenceThreshold: 40,
  promptVersionKey: "v1",
  schemaVersion: "1.0",
};

const VALID_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "claude-sonnet-4.5",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022",
]);

function validateAndMerge(config: Partial<RuntimeConfig>): RuntimeConfig {
  const merged = { ...DEFAULTS, ...config };
  if (merged.maxImages < 1 || merged.maxImages > 20) merged.maxImages = DEFAULTS.maxImages;
  if (merged.maxImageBytes < 1024 * 1024 || merged.maxImageBytes > 100 * 1024 * 1024) {
    merged.maxImageBytes = DEFAULTS.maxImageBytes;
  }
  if (merged.classificationConfidenceThreshold < 0 || merged.classificationConfidenceThreshold > 100) {
    merged.classificationConfidenceThreshold = DEFAULTS.classificationConfidenceThreshold;
  }
  if (!VALID_MODELS.has(merged.vertexModel)) merged.vertexModel = DEFAULTS.vertexModel;
  if (!VALID_MODELS.has(merged.vertexFallbackModel)) merged.vertexFallbackModel = DEFAULTS.vertexFallbackModel;
  return merged;
}

let cached: RuntimeConfig | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000; // 1 min

/**
 * Load runtime config. Tries Firestore first, falls back to env/defaults.
 * Safe for missing config or invalid values.
 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const { getAdminFirestore } = await import("@/lib/firebaseAdmin");
    const adminDb = getAdminFirestore();
    const snap = await adminDb.collection(CONFIG_COLLECTION).doc(ACTIVE_DOC).get();
    if (snap.exists) {
      const data = snap.data() as Record<string, unknown>;
      const updatedAt =
        typeof data.updatedAt === "string"
          ? data.updatedAt
          : (data.updatedAt as { toISOString?: () => string })?.toISOString?.() ?? new Date().toISOString();
      cached = validateAndMerge({
        ...(data as Partial<RuntimeConfig>),
        updatedAt,
      });
    } else {
      cached = validateAndMerge({});
    }
  } catch (err) {
    console.warn("[RuntimeConfig] Firestore read failed, using defaults:", err);
    cached = validateAndMerge({});
  }
  cachedAt = now;
  return cached;
}

/** Invalidate cache (call after admin config update). */
export function invalidateConfigCache(): void {
  cached = null;
}
