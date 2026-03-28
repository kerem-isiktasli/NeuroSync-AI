/**
 * Env-driven thresholds for two-stage DICOM slice analysis (triage + deep).
 */
import { VERTEX_CONFIG, getVertexGlobalConcurrencyCap } from "@/lib/vertexConfig";

function parseFloatEnv(key: string, defaultVal: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultVal;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : defaultVal;
}

function parseIntEnv(key: string, defaultVal: number, min: number, max: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultVal;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return defaultVal;
  return Math.max(min, Math.min(max, n));
}

/** Align with studyImageAnalyzer MAX_SLICES_TO_ANALYZE default for zero-flag deep fallback. */
function maxDicomSlicesAnalyzedEnvDefault(): number {
  const n = parseInt(process.env.MAX_DICOM_SLICES_ANALYZED || "48", 10);
  return Number.isFinite(n) && n > 0 ? n : 48;
}

export interface SliceTriagePipelineConfig {
  /** Enable two-stage triage + deep for large studies. */
  twoStageEnabled: boolean;
  triageModel: string;
  deepSliceModel: string;
  triageMaxSide: number;
  triageTimeoutMs: number;
  deepTimeoutMs: number;
  triageConcurrency: number;
  deepConcurrency: number;
  /** Score < this → clear (no deep). */
  triageClearBelow: number;
  /** Score > this → HIT (deep + neighbors per cluster rules). */
  triageHitAbove: number;
  /** Merge flagged slices if index gap <= this. */
  clusterMaxGap: number;
  neighborRadius: number;
  triageMaxTokens: number;
  deepMaxTokens: number;
  /**
   * If triage flags zero slices, deep stage samples this many indices via
   * balanced spacing (same helper as legacy large-study sampling).
   */
  zeroFlagDeepMinSlices: number;
}

export { computeDeepBudget } from "./sliceTriageDeepQueue";

export function loadSliceTriagePipelineConfig(): SliceTriagePipelineConfig {
  const vertexCap = getVertexGlobalConcurrencyCap();
  /** Hard cap on parallel slice Vertex calls (triage + deep each respect this). */
  const pipelineCap = parseIntEnv("VERTEX_SLICE_PIPELINE_CONCURRENCY", 3, 1, 8);
  /** Default 1: reduces 429 storms when VERTEX_GLOBAL_CONCURRENCY is low. */
  const triageRequested = parseIntEnv("DICOM_TRIAGE_CONCURRENCY", 1, 1, 24);
  const deepRequested = parseIntEnv("DICOM_DEEP_CONCURRENCY", 3, 1, 16);
  const capped = Math.min(vertexCap, pipelineCap);
  return {
    /** Disable with `DICOM_TWO_STAGE_TRIAGE=false` if you need legacy sampling only. */
    twoStageEnabled: process.env.DICOM_TWO_STAGE_TRIAGE !== "false",
    triageModel:
      process.env.DICOM_TRIAGE_MODEL?.trim() || VERTEX_CONFIG.classificationModel,
    deepSliceModel:
      process.env.DICOM_DEEP_SLICE_MODEL?.trim() || VERTEX_CONFIG.extractionModel,
    triageMaxSide: parseIntEnv("DICOM_TRIAGE_MAX_SIDE", 256, 64, 512),
    triageTimeoutMs: parseIntEnv("DICOM_TRIAGE_TIMEOUT_MS", 120_000, 30_000, 600_000),
    deepTimeoutMs: parseIntEnv("DICOM_DEEP_TIMEOUT_MS", 50_000, 10_000, 120_000),
    triageConcurrency: Math.min(triageRequested, capped),
    deepConcurrency: Math.min(deepRequested, capped),
    triageClearBelow: parseFloatEnv("DICOM_TRIAGE_CLEAR_BELOW", 0.25),
    triageHitAbove: parseFloatEnv("DICOM_TRIAGE_HIT_ABOVE", 0.6),
    clusterMaxGap: parseIntEnv("DICOM_TRIAGE_CLUSTER_GAP", 3, 1, 20),
    neighborRadius: parseIntEnv("DICOM_DEEP_NEIGHBOR_RADIUS", 2, 0, 10),
    triageMaxTokens: parseIntEnv("DICOM_TRIAGE_MAX_TOKENS", 256, 64, 1024),
    deepMaxTokens: parseIntEnv("DICOM_DEEP_MAX_TOKENS", 1024, 256, 4096),
    zeroFlagDeepMinSlices: parseIntEnv(
      "DICOM_TRIAGE_ZERO_FLAG_DEEP_MIN",
      maxDicomSlicesAnalyzedEnvDefault(),
      1,
      500
    ),
  };
}
