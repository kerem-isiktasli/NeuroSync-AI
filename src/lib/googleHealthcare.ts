/**
 * Vertex Image Service — Multimodal image reasoning via Vertex AI Gemini.
 *
 * ARCHITECTURE: This is NOT the Google Cloud Healthcare API.
 * - Cloud Healthcare API: DICOMweb study ingestion, metadata (future)
 * - Document AI: dedicated OCR for report screenshots (future)
 * - This module: Vertex Gemini for classification, extraction, provisional OCR
 * - Anthropic: synthesis and chat (see synthesisPrompts, reportChatPrompts)
 *
 * Do not imply Healthcare API is the diagnostic engine.
 */
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import {
  VertexCredentialError,
  VertexTimeoutError,
  VertexHttpError,
  VertexServiceError,
  VertexParseError,
} from './vertexErrors';
import {
  getClassificationPrompt,
  getDomainPrompt,
  resolveDomainRoute,
  type DomainRoute,
  type ClassificationResult,
} from './ai/promptRouter';
import { type PerImageIntakeResult } from './ai/intakePrompts';
import {
  buildSingleFileIntakeClassifierPrompt,
  buildSingleFileIntakeContext,
  parseSingleFileIntakeClassification,
  singleFileIntakeToPerImageResult,
  type RunIntakeClassificationMeta,
} from './ai/singleFileIntakeClassifier';
import {
  buildUploadCohesionArbiterPrompt,
  parseUploadCohesionResult,
  synthesizeCohesionSingleFile,
  type UploadCohesionArbiterInput,
  type UploadCohesionResult,
} from './ai/uploadCohesionArbiter';
import {
  buildProcedureMapperPrompt,
  parseProcedureMapperResult,
  defaultProcedureMapperResult,
  type ProcedureMapperInput,
  type ProcedureMapperResult,
} from './ai/procedureModalityAnatomyMapper';
import {
  buildImagingAtomicExtractorPrompt,
  parseImagingAtomicExtractionResult,
  defaultImagingAtomicExtractionResult,
  dedupeImagingCandidateFindings,
  type ImagingAtomicExtractorInput,
  type ImagingAtomicExtractionResult,
} from './ai/imagingAtomicExtractor';
import {
  buildLaboratoryReportExtractorPrompt,
  parseLaboratoryReportExtractionResult,
  defaultLaboratoryReportExtractionResult,
  type LaboratoryReportExtractorInput,
  type LaboratoryReportExtractionResult,
} from './ai/laboratoryReportExtractor';
import {
  buildWaveformExtractorPrompt,
  parseWaveformExtractionResult,
  defaultWaveformExtractionResult,
  type WaveformExtractorInput,
  type WaveformExtractionResult,
} from './ai/waveformExtractor';
import {
  buildEvidenceAdjudicatorPrompt,
  parseEvidenceAdjudicationResult,
  defaultEvidenceAdjudicationResult,
  primaryGroupIdFromAdjudicatorInput,
  sanitizeAdjudicationProvenanceAndDedupe,
  EVIDENCE_ADJUDICATION_SCHEMA_FAILURE_SUMMARY,
  EVIDENCE_ADJUDICATION_VERTEX_FAILURE_SUMMARY,
  type EvidenceAdjudicatorInput,
  type EvidenceAdjudicationResult,
} from './ai/evidenceAdjudicatorMerger';
import {
  buildProcedureCapabilityPolicyPrompt,
  parseProcedureCapabilityPolicyResult,
  finalizeProcedureCapabilityPolicyResult,
  type ProcedureCapabilityPolicyInput,
  type ProcedureCapabilityPolicyResult,
} from './ai/procedureCapabilityPolicy';
import {
  buildFinalReportRendererPrompt,
  parseFinalReportRenderResult,
  defaultFinalReportRenderResult,
  type FinalReportRendererModelInput,
  type FinalReportRenderResult,
} from './ai/finalReportRenderer';
import { VERTEX_CONFIG, getVertexEndpoint } from './vertexConfig';
import { loadRuntimeConfig, type RuntimeConfig } from './runtimeConfig';
import { RAPIMED_MAX_OUTPUT_TOKENS } from './rapiMed/stageTokenLimits';
import {
  validateUploadCohesionResult,
  validateProcedureMapperResult,
  validateImagingAtomicExtractionResult,
  validateLaboratoryReportExtractionResult,
  validateWaveformExtractionResult,
  validateEvidenceAdjudicationResult,
  validateFinalReportRenderResult,
  validateProcedureCapabilityPolicyResult,
} from './rapiMed/stageSchemaValidation';
import {
  getStructuredReconciliationPrompt,
  parseStructuredReconciliation,
  type PerImageFindingForReconciliation,
  type StructuredReconciliationResult,
} from './ai/structuredReconciliation';
import type { StudyMetadata } from './ai/studyAggregator';
import { getReportOcrPrompt, type ReportOcrResult } from './ai/reportOcrPrompts';
import {
  buildReportFusionPrompt,
  parseFusionResponse,
  type ReportFusionResult,
  type ReportFusionInput,
} from './ai/reportFusion';
import {
  buildStudyReportPrompt,
  type StudyReportVertexInput,
} from './ai/studyReportPrompts';
import {
  buildStudyReportPromptUniversal,
  type StudyReportVertexInput as StudyReportVertexInputUniversal,
} from './ai/studyReportPromptsUniversal';
import {
  getDicomSliceAnalysisPrompt,
  getDicomTriageSlicePrompt,
  type DicomSliceAnalysisContext,
  type DicomSliceAnalysisResult,
  type DicomTriageSliceContext,
} from './ai/dicomSlicePrompts';
import { getDomainAnalyzerPrompt } from './ai/domainAnalyzerPrompts';
import type { MedicalDomain } from './medical/domainRouter';

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

/** Caps concurrent Vertex generateContent calls per Node process (multi-instance serverless still multiplies load). */
const VERTEX_GLOBAL_CONCURRENCY = Math.max(
  1,
  Math.min(16, parseInt(process.env.VERTEX_GLOBAL_CONCURRENCY ?? "2", 10) || 2)
);
let vertexPermitsAvailable = VERTEX_GLOBAL_CONCURRENCY;
const vertexPermitWaiters: Array<() => void> = [];

async function acquireVertexPermit(): Promise<void> {
  if (vertexPermitsAvailable > 0) {
    vertexPermitsAvailable--;
    return;
  }
  await new Promise<void>((resolve) => {
    vertexPermitWaiters.push(resolve);
  });
}

function releaseVertexPermit(): void {
  if (vertexPermitWaiters.length > 0) {
    const next = vertexPermitWaiters.shift()!;
    next();
  } else {
    vertexPermitsAvailable++;
  }
}

function resolveVertexImageModel(rc: RuntimeConfig): string {
  const m = rc.vertexModel?.trim();
  if (m && m.length >= 3) return m;
  return VERTEX_CONFIG.extractionModel;
}

const KEY_FILE_PATH = (() => {
  const env = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (env) return path.isAbsolute(env) ? env : path.join(process.cwd(), env);
  return path.join(process.cwd(), "credentials", "google-key.json");
})();

const INTAKE_TIMEOUT_MS = 10_000;
const COHESION_ARBITER_TIMEOUT_MS = 25_000;
const PROCEDURE_MODALITY_MAPPER_TIMEOUT_MS = 25_000;
const IMAGING_ATOMIC_EXTRACTOR_TIMEOUT_MS = 80_000;
const MAX_ATOMIC_EXTRACTOR_IMAGES = 12;
const LAB_REPORT_EXTRACTOR_TIMEOUT_MS = 80_000;
const MAX_LAB_REPORT_EXTRACTOR_IMAGES = 12;
const WAVEFORM_EXTRACTOR_TIMEOUT_MS = 80_000;
const MAX_WAVEFORM_EXTRACTOR_IMAGES = 12;
const EVIDENCE_ADJUDICATOR_TIMEOUT_MS = 60_000;
const PROCEDURE_CAPABILITY_POLICY_TIMEOUT_MS = 30_000;
const FINAL_REPORT_RENDERER_TIMEOUT_MS = 90_000;
const CLASSIFY_TIMEOUT_MS = 20_000;
const EXTRACTION_TIMEOUT_MS = 50_000;
const DOMAIN_ANALYZER_TIMEOUT_MS = 45_000;
const RECONCILIATION_TIMEOUT_MS = 25_000;
const REPORT_OCR_TIMEOUT_MS = 30_000;
const LOCALIZER_OCR_TIMEOUT_MS = 12_000;
const FUSION_TIMEOUT_MS = 25_000;
const STUDY_REPORT_TIMEOUT_MS = 45_000;

export interface VertexAnalysisResult {
  classification: ClassificationResult;
  extraction: Record<string, unknown>;
  domainRoute: DomainRoute;
  model: string;
}

function removeTrailingCommas(s: string): string {
  let prev = "";
  let cur = s;
  while (cur !== prev) {
    prev = cur;
    cur = cur.replace(/,(\s*[}\]])/g, "$1");
  }
  return cur;
}

/**
 * Robust JSON extraction from model output. Tolerates:
 * - Markdown code fences (```json ... ```)
 * - Leading/trailing text
 * - Trailing commas
 * - Slightly malformed strings (escape fixes)
 */
function extractJSONFromText(text: string): unknown | null {
  if (!text || typeof text !== "string") return null;

  const strategies: ((t: string) => unknown | null)[] = [
    // Strategy 1: direct brace extraction
    (t) => tryParseWithBraces(t),
    // Strategy 2: strip markdown fences
    (t) => tryParseWithBraces(t.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()),
    // Strategy 3: regex-match deepest {...}
    (t) => {
      const m = t.match(/\{[\s\S]*\}/);
      return m ? tryParse(m[0]) : null;
    },
    // Strategy 4: fix common LLM escape issues (unescaped newlines in strings)
    (t) => {
      const m = t.match(/\{[\s\S]*\}/);
      if (!m) return null;
      const fixed = m[0]
        .replace(/(?<=:\s*"[^"]*)\n/g, "\\n")
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      return tryParse(fixed);
    },
    // Strategy 5: try array output (some models wrap in [...])
    (t) => {
      const m = t.match(/\[[\s\S]*\]/);
      if (!m) return null;
      const arr = tryParse(m[0]);
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === "object") return arr[0];
      return null;
    },
  ];

  for (const strat of strategies) {
    const out = strat(text.trim());
    if (out !== null) return out;
  }
  return null;
}

function tryParseWithBraces(cleaned: string): unknown | null {
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;
  const jsonStr = removeTrailingCommas(cleaned.slice(firstBrace, lastBrace + 1));
  return tryParse(jsonStr);
}

function tryParse(jsonStr: string): unknown | null {
  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

function extractTextFromGeminiResponse(data: unknown): string {
  const d = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  if (!d?.candidates?.[0]?.content?.parts) return "";
  return d.candidates[0].content.parts
    .map((p) => p.text ?? "")
    .join("\n");
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  opts: {
    maxAttempts?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    label?: string;
  } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseDelayMs = opts.baseDelayMs ?? 2000;
  const maxDelayMs = opts.maxDelayMs ?? 30_000;
  const label = opts.label ?? "vertex";

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const status =
        err instanceof VertexHttpError ? err.status : 0;
      const isRetryable = status === 429 || status === 503;
      if (!isRetryable || attempt === maxAttempts) throw err;
      const jitter = Math.random() * 1000;
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + jitter,
        maxDelayMs
      );
      console.warn(
        `[${label}] HTTP ${status} — retry ${attempt}/${maxAttempts - 1} in ${Math.round(delay)}ms`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Vertex Gemini service for image reasoning and provisional OCR. Alias preserved for compatibility. */
export class VertexImageService {
  private auth: GoogleAuth;

  constructor() {
    this.auth = new GoogleAuth({
      keyFile: KEY_FILE_PATH,
      scopes: SCOPES,
    });
  }

  async getAccessToken(): Promise<string> {
    const client = await this.auth.getClient();
    const accessToken = await client.getAccessToken();
    return accessToken.token || '';
  }

  private async callGemini(params: {
    model?: string;
    prompt: string;
    imageBase64: string;
    token: string;
    signal: AbortSignal;
    maxTokens: number;
  }): Promise<string> {
    const { model, prompt, imageBase64, token, signal, maxTokens } = params;
    const skipAnalysisCache = process.env.SKIP_ANALYSIS_CACHE === "true";
    const runtimeConfig = await loadRuntimeConfig();
    const activeModel = model || resolveVertexImageModel(runtimeConfig);
    const endpoint = getVertexEndpoint(activeModel);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[VertexImage] Calling model=${activeModel}, endpoint=${endpoint}`);
    }
    if (skipAnalysisCache) {
      console.log("[cache] BYPASSED key=vertex/callGemini-image (fresh generation; temp>0)");
    }

    const body = {
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inline_data: { mime_type: "image/jpeg", data: imageBase64 } },
        ],
      }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: skipAnalysisCache ? 0.12 : 0.0,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json",
      },
    };

    await acquireVertexPermit();
    try {
      const response = await retryWithBackoff(
        async () => {
          const r = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal,
          });
          if (r.status === 403) {
            console.error(
              `[VertexImage] IAM 403 on model ${activeModel}`
            );
            throw new VertexHttpError(403, r.statusText);
          }
          if (!r.ok) {
            const errText = await r.text().catch(() => "");
            console.error(
              `[VertexImage] HTTP ${r.status} model=${activeModel}:`,
              errText?.slice(0, 300)
            );
            if (r.status === 404) {
              console.error(
                `[VertexImage] Model 404 — "${activeModel}" not found. Use VERTEX_MODEL env to override. Valid models: gemini-2.5-flash, gemini-2.5-pro`
              );
            }
            throw new VertexHttpError(r.status, r.statusText, errText);
          }
          return r;
        },
        { maxAttempts: 4, baseDelayMs: 2000, label: "callGemini" }
      );

      const data = await response.json();
      return extractTextFromGeminiResponse(data);
    } finally {
      releaseVertexPermit();
    }
  }

  /** Multimodal: one prompt plus multiple JPEGs (same order as file_ids in prompt). */
  private async callGeminiMultiImages(params: {
    model?: string;
    prompt: string;
    images: Array<{ fileId: string; imageBase64: string }>;
    token: string;
    signal: AbortSignal;
    maxTokens: number;
  }): Promise<string> {
    const { model, prompt, images, token, signal, maxTokens } = params;
    const skipAnalysisCache = process.env.SKIP_ANALYSIS_CACHE === "true";
    const runtimeConfig = await loadRuntimeConfig();
    const activeModel = model || resolveVertexImageModel(runtimeConfig);
    const endpoint = getVertexEndpoint(activeModel);

    const orderNote =
      images.length > 0
        ? `\n\nAttached images in order (match to source_file_ids):\n${images
            .map((im, i) => `${i + 1}. ${im.fileId}`)
            .join("\n")}`
        : "";

    const parts: Array<
      | { text: string }
      | { inline_data: { mime_type: string; data: string } }
    > = [{ text: `${prompt}${orderNote}` }];

    for (const im of images) {
      const raw = im.imageBase64.includes(",")
        ? im.imageBase64.split(",")[1]
        : im.imageBase64;
      parts.push({ inline_data: { mime_type: "image/jpeg", data: raw } });
    }

    const body = {
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: skipAnalysisCache ? 0.12 : 0.0,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json",
      },
    };

    await acquireVertexPermit();
    try {
      const response = await retryWithBackoff(
        async () => {
          const r = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal,
          });
          if (!r.ok) {
            const errText = await r.text().catch(() => "");
            throw new VertexHttpError(r.status, r.statusText, errText);
          }
          return r;
        },
        { maxAttempts: 4, baseDelayMs: 2000, label: "callGeminiMultiImages" }
      );

      const data = await response.json();
      return extractTextFromGeminiResponse(data);
    } finally {
      releaseVertexPermit();
    }
  }

  private async callGeminiText(params: {
    prompt: string;
    token: string;
    signal: AbortSignal;
    maxTokens: number;
  }): Promise<string> {
    const { prompt, token, signal, maxTokens } = params;
    const skipAnalysisCache = process.env.SKIP_ANALYSIS_CACHE === "true";
    const runtimeConfig = await loadRuntimeConfig();
    const activeModel = resolveVertexImageModel(runtimeConfig);
    const endpoint = getVertexEndpoint(activeModel);
    if (skipAnalysisCache) {
      console.log("[cache] BYPASSED key=vertex/callGeminiText (fresh generation; temp>0)");
    }

    const body = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: skipAnalysisCache ? 0.12 : 0.0,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json",
      },
    };

    await acquireVertexPermit();
    try {
      const response = await retryWithBackoff(
        async () => {
          const r = await fetch(endpoint, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal,
          });
          if (!r.ok) {
            const errText = await r.text().catch(() => "");
            throw new VertexHttpError(r.status, r.statusText, errText);
          }
          return r;
        },
        { maxAttempts: 4, baseDelayMs: 3000, label: "callGeminiText" }
      );

      const data = await response.json();
      return extractTextFromGeminiResponse(data);
    } finally {
      releaseVertexPermit();
    }
  }

  /**
   * Lightweight intake classification — RapiMed single-file family classifier.
   * Maps families into legacy upload_type / diagnostic_value for routing.
   */
  async runIntakeClassification(
    imageBase64: string,
    language: "tr" | "en",
    meta?: RunIntakeClassificationMeta
  ): Promise<Omit<PerImageIntakeResult, "imageIndex" | "fileName">> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const rawBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INTAKE_TIMEOUT_MS);

    try {
      const runtimeConfig = await loadRuntimeConfig();
      const imageModel = resolveVertexImageModel(runtimeConfig);
      const effectiveMeta: RunIntakeClassificationMeta = meta ?? {
        file_id: "intake-unknown",
        original_filename: "upload.jpg",
        mime_type: "image/jpeg",
        upload_order_index: 0,
      };
      const context = buildSingleFileIntakeContext(effectiveMeta, rawBase64);
      const prompt = buildSingleFileIntakeClassifierPrompt(language, context);
      const raw = await this.callGemini({
        model: imageModel,
        prompt,
        imageBase64: rawBase64,
        token,
        signal: controller.signal,
        maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.intake_classifier,
      });

      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const classified = parseSingleFileIntakeClassification(parsed);
      if (!classified) {
        return defaultIntakeResult();
      }

      const legacy = singleFileIntakeToPerImageResult(
        classified,
        0,
        effectiveMeta.original_filename
      );
      const { imageIndex: _i, fileName: _f, ...rest } = legacy;
      return rest;
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort) {
        console.warn("[VertexImage] Intake timed out, using defaults");
      } else {
        console.warn("[VertexImage] Intake failed:", err instanceof Error ? err.message : err);
      }
      return defaultIntakeResult();
    }
  }

  /**
   * Batch upload cohesion — groups files, quarantine, process_action (text-only JSON).
   */
  async runUploadCohesionArbitration(
    input: UploadCohesionArbiterInput,
    language: "tr" | "en"
  ): Promise<UploadCohesionResult> {
    if (input.upload_count <= 1) {
      if (input.upload_count === 1) {
        return synthesizeCohesionSingleFile(input);
      }
      return {
        upload_batch_id: input.upload_batch_id,
        process_action: "cancel",
        overall_reason: "No files in batch.",
        groups: [],
        quarantined_files: [],
        canceled_files: [],
        user_clarification_needed: false,
        clarification_questions: [],
      };
    }

    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), COHESION_ARBITER_TIMEOUT_MS);

    try {
      const prompt = buildUploadCohesionArbiterPrompt(language, input);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.cohesion_arbiter,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const result = parseUploadCohesionResult(parsed);
      if (result) {
        const v = validateUploadCohesionResult(result);
        if (!v.ok) {
          console.warn("[RapiMed] Cohesion schema rejection:", v.errors.join("; "));
        } else {
          if (!result.upload_batch_id) {
            result.upload_batch_id = input.upload_batch_id;
          }
          return result;
        }
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.warn(
          "[VertexImage] Cohesion arbiter failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    const ids = input.original_file_order;
    return {
      upload_batch_id: input.upload_batch_id,
      process_action: "continue",
      overall_reason:
        "Cohesion arbitration unavailable or parse failed; proceeding with full batch (fail-open).",
      groups: [
        {
          group_id: "g_fail_open_all",
          group_type: "imaging_study_group",
          included_file_ids: [...ids],
          excluded_file_ids: [],
          group_confidence: 0.35,
          group_rationale: ["arbiter_fallback_all_files"],
          patient_match_status: "unknown",
          time_match_status: "unknown",
          anatomy_match_status: "unknown",
          family_match_status: "mixed_but_supported",
          provisional_group: false,
        },
      ],
      quarantined_files: [],
      canceled_files: [],
      user_clarification_needed: false,
      clarification_questions: [],
    };
  }

  /**
   * Procedure / modality / anatomy mapping for one coherent group (text-only JSON).
   */
  async runProcedureModalityAnatomyMapping(
    input: ProcedureMapperInput,
    language: "tr" | "en"
  ): Promise<ProcedureMapperResult> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROCEDURE_MODALITY_MAPPER_TIMEOUT_MS);

    try {
      const prompt = buildProcedureMapperPrompt(language, input);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.procedure_modality_mapper,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const result = parseProcedureMapperResult(parsed, input.group_id);
      if (result) {
        const v = validateProcedureMapperResult(result);
        if (!v.ok) {
          console.warn("[RapiMed] Procedure mapper schema rejection:", v.errors.join("; "));
        } else {
          return result;
        }
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.warn(
          "[VertexImage] Procedure/modality mapper failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    return defaultProcedureMapperResult(input.group_id, []);
  }

  /**
   * Atomic imaging evidence for one coherent group (multimodal; images in file_ids order).
   */
  async runImagingAtomicExtraction(
    input: ImagingAtomicExtractorInput,
    language: "tr" | "en",
    imagesByFileId: Array<{ file_id: string; imageBase64: string }>
  ): Promise<ImagingAtomicExtractionResult> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const idToB64 = new Map(
      imagesByFileId.map((x) => [x.file_id, x.imageBase64] as const)
    );
    const ordered: Array<{ fileId: string; imageBase64: string }> = [];
    for (const fid of input.file_ids) {
      const b64 = idToB64.get(fid);
      if (b64) ordered.push({ fileId: fid, imageBase64: b64 });
    }

    const capped = ordered.slice(0, MAX_ATOMIC_EXTRACTOR_IMAGES);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGING_ATOMIC_EXTRACTOR_TIMEOUT_MS);

    try {
      const runtimeConfig = await loadRuntimeConfig();
      const imageModel = resolveVertexImageModel(runtimeConfig);
      const prompt = buildImagingAtomicExtractorPrompt(language, input);

      const raw =
        capped.length === 0
          ? await this.callGeminiText({
              prompt: `${prompt}\n\nNOTE: No images attached; return JSON with technical_adequacy.non_diagnostic or limited and empty candidate_findings unless metadata alone supports entries.`,
              token,
              signal: controller.signal,
              maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.imaging_atomic_extractor,
            })
          : await this.callGeminiMultiImages({
              model: imageModel,
              prompt,
              images: capped,
              token,
              signal: controller.signal,
              maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.imaging_atomic_extractor,
            });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const result = parseImagingAtomicExtractionResult(parsed, input.group_id);
      if (result) {
        const v = validateImagingAtomicExtractionResult(result);
        if (!v.ok) {
          console.warn("[RapiMed] Imaging atomic schema rejection:", v.errors.join("; "));
        } else {
          return {
            ...result,
            candidate_findings: dedupeImagingCandidateFindings(result.candidate_findings),
          };
        }
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.warn(
          "[VertexImage] Imaging atomic extractor failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    return defaultImagingAtomicExtractionResult(
      input.group_id,
      "extraction_parse_failed_or_vertex_error"
    );
  }

  /**
   * Laboratory report atomic extraction for one coherent group (multimodal; images in file_ids order).
   */
  async runLaboratoryReportExtraction(
    input: LaboratoryReportExtractorInput,
    language: "tr" | "en",
    imagesByFileId: Array<{ file_id: string; imageBase64: string }>
  ): Promise<LaboratoryReportExtractionResult> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const idToB64 = new Map(
      imagesByFileId.map((x) => [x.file_id, x.imageBase64] as const)
    );
    const ordered: Array<{ fileId: string; imageBase64: string }> = [];
    for (const fid of input.file_ids) {
      const b64 = idToB64.get(fid);
      if (b64) ordered.push({ fileId: fid, imageBase64: b64 });
    }

    const capped = ordered.slice(0, MAX_LAB_REPORT_EXTRACTOR_IMAGES);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LAB_REPORT_EXTRACTOR_TIMEOUT_MS);

    try {
      const runtimeConfig = await loadRuntimeConfig();
      const imageModel = resolveVertexImageModel(runtimeConfig);
      const prompt = buildLaboratoryReportExtractorPrompt(language, input);

      const raw =
        capped.length === 0
          ? await this.callGeminiText({
              prompt: `${prompt}\n\nNOTE: No page images attached; extract only from OCR text and metadata in INPUTS_JSON. If insufficient, return panels: [] and extraction_quality.overall "low".`,
              token,
              signal: controller.signal,
              maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.laboratory_report_extractor,
            })
          : await this.callGeminiMultiImages({
              model: imageModel,
              prompt,
              images: capped,
              token,
              signal: controller.signal,
              maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.laboratory_report_extractor,
            });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const result = parseLaboratoryReportExtractionResult(parsed, input.group_id);
      if (result) {
        const v = validateLaboratoryReportExtractionResult(result);
        if (!v.ok) {
          console.warn("[RapiMed] Laboratory report schema rejection:", v.errors.join("; "));
        } else {
          return result;
        }
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.warn(
          "[VertexImage] Laboratory report extractor failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    return defaultLaboratoryReportExtractionResult(
      input.group_id,
      "lab_extraction_parse_failed_or_vertex_error"
    );
  }

  /**
   * Waveform extraction for one coherent ECG/EEG/EMG group (multimodal; images in file_ids order).
   */
  async runWaveformExtraction(
    input: WaveformExtractorInput,
    language: "tr" | "en",
    imagesByFileId: Array<{ file_id: string; imageBase64: string }>
  ): Promise<WaveformExtractionResult> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const idToB64 = new Map(
      imagesByFileId.map((x) => [x.file_id, x.imageBase64] as const)
    );
    const ordered: Array<{ fileId: string; imageBase64: string }> = [];
    for (const fid of input.file_ids) {
      const b64 = idToB64.get(fid);
      if (b64) ordered.push({ fileId: fid, imageBase64: b64 });
    }

    const capped = ordered.slice(0, MAX_WAVEFORM_EXTRACTOR_IMAGES);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WAVEFORM_EXTRACTOR_TIMEOUT_MS);

    try {
      const runtimeConfig = await loadRuntimeConfig();
      const imageModel = resolveVertexImageModel(runtimeConfig);
      const prompt = buildWaveformExtractorPrompt(language, input);

      const raw =
        capped.length === 0
          ? await this.callGeminiText({
              prompt: `${prompt}\n\nNOTE: No images attached; use OCR text and metadata only. If insufficient, waveform_type "unknown", signal_quality non_diagnostic, minimal structured_facts.`,
              token,
              signal: controller.signal,
              maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.waveform_extractor,
            })
          : await this.callGeminiMultiImages({
              model: imageModel,
              prompt,
              images: capped,
              token,
              signal: controller.signal,
              maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.waveform_extractor,
            });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const result = parseWaveformExtractionResult(parsed, input.group_id);
      if (result) {
        const v = validateWaveformExtractionResult(result);
        if (!v.ok) {
          console.warn("[RapiMed] Waveform schema rejection:", v.errors.join("; "));
        } else {
          return result;
        }
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.warn(
          "[VertexImage] Waveform extractor failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    return defaultWaveformExtractionResult(
      input.group_id,
      "waveform_extraction_parse_failed_or_vertex_error"
    );
  }

  /**
   * Evidence adjudication and merger — text-only JSON gatekeeper over pipeline candidates.
   */
  async runEvidenceAdjudication(
    input: EvidenceAdjudicatorInput,
    language: "tr" | "en"
  ): Promise<EvidenceAdjudicationResult> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EVIDENCE_ADJUDICATOR_TIMEOUT_MS);

    try {
      const prompt = buildEvidenceAdjudicatorPrompt(language, input);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.evidence_adjudicator,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const parsedResult = parseEvidenceAdjudicationResult(parsed, input.upload_batch_id);
      if (parsedResult && parsedResult.study_outputs.length > 0) {
        if (!parsedResult.upload_batch_id) parsedResult.upload_batch_id = input.upload_batch_id;
        let result = sanitizeAdjudicationProvenanceAndDedupe(parsedResult);
        const v = validateEvidenceAdjudicationResult(result);
        if (!v.ok) {
          console.warn("[RapiMed] Evidence adjudication schema rejection:", v.errors.join("; "));
          return defaultEvidenceAdjudicationResult(
            input.upload_batch_id,
            primaryGroupIdFromAdjudicatorInput(input),
            EVIDENCE_ADJUDICATION_SCHEMA_FAILURE_SUMMARY
          );
        }
        return result;
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.warn(
          "[VertexImage] Evidence adjudicator failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    return defaultEvidenceAdjudicationResult(
      input.upload_batch_id,
      primaryGroupIdFromAdjudicatorInput(input),
      EVIDENCE_ADJUDICATION_VERTEX_FAILURE_SUMMARY
    );
  }

  /**
   * Procedure capability policy — text-only JSON; labels vs procedure_class/anatomy (no raw files).
   */
  async runProcedureCapabilityPolicyEvaluation(
    input: ProcedureCapabilityPolicyInput,
    language: "tr" | "en"
  ): Promise<ProcedureCapabilityPolicyResult> {
    if (input.candidate_labels.length === 0) {
      return finalizeProcedureCapabilityPolicyResult(null, input, "");
    }

    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROCEDURE_CAPABILITY_POLICY_TIMEOUT_MS);

    try {
      const prompt = buildProcedureCapabilityPolicyPrompt(language, input);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.procedure_capability_policy,
      });
      clearTimeout(timer);

      const parsedJson = extractJSONFromText(raw);
      const partial = parseProcedureCapabilityPolicyResult(parsedJson, input.procedure_class);
      const finalized = finalizeProcedureCapabilityPolicyResult(
        partial,
        input,
        "no_matching_decision_row_for_label"
      );
      const cv = validateProcedureCapabilityPolicyResult(finalized);
      if (!cv.ok) {
        console.warn("[RapiMed] Capability policy schema rejection:", cv.errors.join("; "));
        return finalizeProcedureCapabilityPolicyResult(
          null,
          input,
          "procedure_capability_policy_schema_rejection"
        );
      }
      return finalized;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.warn(
          "[VertexImage] Procedure capability policy failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    return finalizeProcedureCapabilityPolicyResult(
      null,
      input,
      "procedure_capability_policy_parse_failed_or_vertex_error"
    );
  }

  /**
   * Final structured report from adjudicated evidence only (text JSON).
   */
  async runFinalReportRendering(
    input: FinalReportRendererModelInput,
    language: "tr" | "en",
    excludedFileIdsFallback: string[]
  ): Promise<FinalReportRenderResult> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const mergedExcluded = [
      ...new Set([
        ...excludedFileIdsFallback,
        ...input.group_provenance_summary.adjudication_global_quarantine_file_ids,
      ]),
    ];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FINAL_REPORT_RENDERER_TIMEOUT_MS);

    try {
      const prompt = buildFinalReportRendererPrompt(language, input);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: RAPIMED_MAX_OUTPUT_TOKENS.final_report_renderer,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const result = parseFinalReportRenderResult(parsed, input, mergedExcluded);
      if (result) {
        const v = validateFinalReportRenderResult(result);
        if (!v.ok) {
          console.warn("[RapiMed] Final report schema rejection:", v.errors.join("; "));
        } else {
          return result;
        }
      }
    } catch (err: unknown) {
      clearTimeout(timer);
      if (!(err instanceof Error && err.name === "AbortError")) {
        console.warn(
          "[VertexImage] Final report renderer failed:",
          err instanceof Error ? err.message : err
        );
      }
    }

    return defaultFinalReportRenderResult(
      input,
      mergedExcluded,
      "final_report_render_parse_failed_or_vertex_error",
      language
    );
  }

  /**
   * OCR extraction from report screenshot/photo. Transcribes text and structures findings.
   */
  async runReportOcr(
    imageBase64: string,
    language: "tr" | "en"
  ): Promise<ReportOcrResult | null> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const rawBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REPORT_OCR_TIMEOUT_MS);

    try {
      const prompt = getReportOcrPrompt(language);
      const raw = await this.callGemini({
        prompt,
        imageBase64: rawBase64,
        token,
        signal: controller.signal,
        maxTokens: 4096,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") return null;

      const obj = parsed as Record<string, unknown>;
      return {
        raw_text: String(obj.raw_text ?? ""),
        structured_findings: Array.isArray(obj.structured_findings)
          ? obj.structured_findings.map(String).filter(Boolean)
          : [],
        modality: obj.modality ? String(obj.modality) : undefined,
        anatomical_region: obj.anatomical_region ? String(obj.anatomical_region) : undefined,
        anatomical_levels: Array.isArray(obj.anatomical_levels)
          ? obj.anatomical_levels.map(String).filter(Boolean)
          : undefined,
        impression_or_conclusion: obj.impression_or_conclusion
          ? String(obj.impression_or_conclusion)
          : undefined,
        limitations: Array.isArray(obj.limitations)
          ? obj.limitations.map(String).filter(Boolean)
          : undefined,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      console.warn("[VertexImage] Report OCR failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Lightweight text extraction for localizer keyword detection.
   * Extracts any visible text (labels, headers, UI) — used to detect "localizer", "scout", etc.
   */
  async extractVisibleText(imageBase64: string): Promise<string | null> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const rawBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOCALIZER_OCR_TIMEOUT_MS);

    const prompt = `Extract ALL visible text from this medical image: labels, headers, UI text, study info, series names.
Return ONLY valid JSON: { "text": "concatenated extracted text" }`;

    try {
      const raw = await this.callGemini({
        prompt,
        imageBase64: rawBase64,
        token,
        signal: controller.signal,
        maxTokens: 1024,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") return null;
      const obj = parsed as Record<string, unknown>;
      const text = obj.text != null ? String(obj.text) : "";
      return text.trim() || null;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (process.env.NODE_ENV !== "production") {
        console.warn("[VertexImage] Localizer OCR failed:", err instanceof Error ? err.message : err);
      }
      return null;
    }
  }

  /**
   * Fusion: compare image-derived findings with official report text.
   * Returns null on failure.
   */
  async runReportFusion(input: ReportFusionInput): Promise<ReportFusionResult | null> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FUSION_TIMEOUT_MS);

    try {
      const prompt = buildReportFusionPrompt(input);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: 1500,
      });
      clearTimeout(timer);

      const result = parseFusionResponse(raw);
      if (!result) return null;

      result.report_text_summary = input.reportRawText.slice(0, 500);
      result.report_structured_findings = input.reportStructuredFindings;
      return result;
    } catch (err: unknown) {
      clearTimeout(timer);
      console.warn("[VertexImage] Report fusion failed:", err instanceof Error ? err.message : err);
      return null;
    }
  }

  /**
   * Fusion engine — combines image findings and report OCR into unified interpretation.
   * Returns raw model response for fusionEngine to parse.
   */
  async runFusionEngine(prompt: string): Promise<string> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FUSION_TIMEOUT_MS);

    try {
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: 2000,
      });
      clearTimeout(timer);
      return raw;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VertexTimeoutError(FUSION_TIMEOUT_MS);
      }
      if (err instanceof Error && err.name?.startsWith("Vertex")) throw err;
      throw new VertexServiceError(
        err instanceof Error ? err.message : "runFusionEngine failed",
        err
      );
    }
  }

  /**
   * Study-level structured reconciliation — correlates findings across images.
   * Returns null if fewer than 2 diagnostic images or on failure.
   */
  async runStructuredReconciliation(
    studyMeta: StudyMetadata,
    perImageFindings: PerImageFindingForReconciliation[],
    language: "tr" | "en"
  ): Promise<StructuredReconciliationResult | null> {
    const diagnosticCount = perImageFindings.filter(
      (f) => f.diagnostic_value !== "non-diagnostic" && !f.is_localizer
    ).length;
    if (diagnosticCount < 2) return null;

    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RECONCILIATION_TIMEOUT_MS);

    try {
      const prompt = getStructuredReconciliationPrompt(studyMeta, perImageFindings, language);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: 1500,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const jsonStr = parsed != null ? JSON.stringify(parsed) : raw;
      return parseStructuredReconciliation(jsonStr);
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort) {
        console.warn("[VertexImage] Structured reconciliation timed out");
      } else {
        console.warn("[VertexImage] Structured reconciliation failed:", err instanceof Error ? err.message : err);
      }
      return null;
    }
  }

  /**
   * Study-based radiology report generation.
   * Vertex receives: study summary, slice statistics, detected anomalies — NOT raw slices.
   * Replaces per-image analyzeImage for DICOM studies.
   */
  async analyzeStudy(
    input: StudyReportVertexInput,
    language: "tr" | "en" = "tr"
  ): Promise<{
    studyType: string;
    region: string;
    vertebraeFindings: Array<{ level: string; finding: string }>;
    abnormalities: string[];
    impression: string;
    recommendedNextSteps: string[];
  }> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STUDY_REPORT_TIMEOUT_MS);

    try {
      const prompt = buildStudyReportPrompt(input, language);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: 3072,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        console.warn("[VertexImage] analyzeStudy JSON parse failed, preview:", raw?.slice(0, 300));
        throw new VertexParseError("analyzeStudy returned unparseable response", raw?.slice(0, 200));
      }

      const obj = parsed as Record<string, unknown>;
      return {
        studyType: String(obj.studyType ?? input.studySummary.studyType ?? ""),
        region: String(obj.region ?? input.studySummary.region ?? ""),
        vertebraeFindings: Array.isArray(obj.vertebraeFindings)
          ? obj.vertebraeFindings.map((v: unknown) => {
              const item = v as Record<string, unknown>;
              return {
                level: String(item?.level ?? ""),
                finding: String(item?.finding ?? ""),
              };
            })
          : input.studySummary.vertebraeFindings ?? [],
        abnormalities: Array.isArray(obj.abnormalities)
          ? obj.abnormalities.map(String).filter(Boolean)
          : [],
        impression: String(obj.impression ?? ""),
        recommendedNextSteps: Array.isArray(obj.recommendedNextSteps)
          ? obj.recommendedNextSteps.map(String).filter(Boolean)
          : [],
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VertexTimeoutError(STUDY_REPORT_TIMEOUT_MS);
      }
      if (err instanceof Error && err.name?.startsWith("Vertex")) throw err;
      throw new VertexServiceError(
        err instanceof Error ? err.message : "analyzeStudy failed",
        err
      );
    }
  }

  /**
   * Domain-aware study analysis. Uses domain-specific prompts (spine, brain, chest, abdomen, general).
   */
  async analyzeStudyUniversal(
    input: StudyReportVertexInputUniversal,
    language: "tr" | "en" = "tr"
  ): Promise<Record<string, unknown>> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), STUDY_REPORT_TIMEOUT_MS);

    try {
      const prompt = buildStudyReportPromptUniversal(input, language);
      const raw = await this.callGeminiText({
        prompt,
        token,
        signal: controller.signal,
        maxTokens: 3072,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        console.warn("[VertexImage] analyzeStudyUniversal JSON parse failed");
        throw new VertexParseError("analyzeStudyUniversal returned unparseable response", raw?.slice(0, 200));
      }

      return parsed as Record<string, unknown>;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VertexTimeoutError(STUDY_REPORT_TIMEOUT_MS);
      }
      if (err instanceof Error && err.name?.startsWith("Vertex")) throw err;
      throw new VertexServiceError(
        err instanceof Error ? err.message : "analyzeStudyUniversal failed",
        err
      );
    }
  }

  /** Fast triage on one slice (JSON score 0–1). */
  async triageDicomSlice(
    imageBase64: string,
    ctx: DicomTriageSliceContext,
    token: string,
    options: { model: string; timeoutMs: number; maxTokens: number }
  ): Promise<{ score: number }> {
    const prompt = getDicomTriageSlicePrompt(ctx);
    const rawBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const raw = await this.callGemini({
        model: options.model,
        prompt,
        imageBase64: rawBase64 ?? imageBase64,
        token,
        signal: controller.signal,
        maxTokens: options.maxTokens,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const obj = (parsed && typeof parsed === "object"
        ? parsed
        : {}) as Record<string, unknown>;
      const s = obj.score;
      const score =
        typeof s === "number" && Number.isFinite(s)
          ? Math.max(0, Math.min(1, s))
          : 0.5;
      return { score };
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VertexTimeoutError(options.timeoutMs);
      }
      throw err;
    }
  }

  /** Analyze a single DICOM slice image with domain-specific prompts. */
  async analyzeDicomSlice(
    imageBase64: string,
    ctx: DicomSliceAnalysisContext,
    token?: string,
    options?: { model?: string; timeoutMs?: number; maxTokens?: number }
  ): Promise<DicomSliceAnalysisResult> {
    const resolvedToken =
      token ?? (await this.getAccessToken());
    const prompt = getDicomSliceAnalysisPrompt(ctx);
    const rawBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const timeoutMs = options?.timeoutMs ?? EXTRACTION_TIMEOUT_MS;
    const maxTokens = options?.maxTokens ?? 1024;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const raw = await this.callGemini({
        model: options?.model,
        prompt,
        imageBase64: rawBase64 ?? imageBase64,
        token: resolvedToken,
        signal: controller.signal,
        maxTokens,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      const obj = (parsed && typeof parsed === "object"
        ? parsed
        : {}) as Record<string, unknown>;

      const getArr = (k: string) =>
        (Array.isArray(obj[k]) ? obj[k] : []).map(String).filter(Boolean);

      return {
        findings: getArr("findings"),
        abnormalities: getArr("abnormalities"),
        confidence: typeof obj.confidence === "number"
          ? Math.max(0, Math.min(100, obj.confidence))
          : 50,
        limitations: getArr("limitations"),
        sliceDescription: String(obj.sliceDescription ?? ""),
        sliceIndex: ctx.sliceIndex,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VertexTimeoutError(timeoutMs);
      }
      throw err;
    }
  }

  /**
   * Domain-specific structured image analysis.
   * Returns raw parsed JSON for brain, chest, spine, abdomen analyzers.
   */
  async runDomainStructuredAnalysis(
    domain: MedicalDomain,
    imageBase64: string,
    language: "tr" | "en",
    options?: {
      sliceIndex?: number;
      totalSlices?: number;
      modality?: string;
      anatomicalRegion?: string;
    }
  ): Promise<Record<string, unknown>> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const rawBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const prompt = getDomainAnalyzerPrompt({
      domain,
      language,
      modality: options?.modality,
      anatomicalRegion: options?.anatomicalRegion,
      sliceIndex: options?.sliceIndex,
      totalSlices: options?.totalSlices,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOMAIN_ANALYZER_TIMEOUT_MS);

    try {
      const raw = await this.callGemini({
        prompt,
        imageBase64: rawBase64,
        token,
        signal: controller.signal,
        maxTokens: 2048,
      });
      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        throw new VertexParseError(
          "Domain analyzer returned unparseable response",
          raw?.slice(0, 200)
        );
      }
      return parsed as Record<string, unknown>;
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new VertexTimeoutError(DOMAIN_ANALYZER_TIMEOUT_MS);
      }
      throw err;
    }
  }

  private async runClassification(
    imageBase64: string,
    token: string,
    language: "tr" | "en"
  ): Promise<ClassificationResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLASSIFY_TIMEOUT_MS);

    try {
      const runtimeConfig = await loadRuntimeConfig();
      const imageModel = resolveVertexImageModel(runtimeConfig);
      const prompt = getClassificationPrompt(language);
      const raw = await this.callGemini({
        model: imageModel,
        prompt,
        imageBase64,
        token,
        signal: controller.signal,
        maxTokens: 400,
      });

      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        console.warn("[VertexImage] Classification JSON parse failed, preview:", raw?.slice(0, 200));
        return defaultClassification();
      }

      const obj = parsed as Record<string, unknown>;
      const validPlanes = ["sagittal", "axial", "coronal", "oblique", "unknown"];
      const validDiagVal = ["high", "medium", "low", "non-diagnostic"];
      return {
        modality: String(obj.modality ?? "Unknown"),
        anatomical_region: String(obj.anatomical_region ?? obj.region ?? "Unknown"),
        domain_route: resolveDomainRoute(String(obj.domain_route ?? "")),
        image_quality: (["low", "moderate", "high"].includes(String(obj.image_quality ?? ""))
          ? String(obj.image_quality) as ClassificationResult["image_quality"]
          : "moderate"),
        image_plane: (validPlanes.includes(String(obj.image_plane ?? ""))
          ? String(obj.image_plane) as ClassificationResult["image_plane"]
          : "unknown"),
        is_localizer: obj.is_localizer === true,
        diagnostic_value: (validDiagVal.includes(String(obj.diagnostic_value ?? ""))
          ? String(obj.diagnostic_value) as ClassificationResult["diagnostic_value"]
          : "medium"),
        series_type_guess: String(obj.series_type_guess ?? ""),
        confidence: typeof obj.confidence === "number" ? obj.confidence : 50,
        limitations: Array.isArray(obj.limitations)
          ? obj.limitations.map(String)
          : [],
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort) {
        console.warn("[VertexImage] Classification timed out, using defaults");
      } else {
        console.warn("[VertexImage] Classification failed:", err instanceof Error ? err.message : err);
      }
      return defaultClassification();
    }
  }

  private async runExtraction(params: {
    imageBase64: string;
    token: string;
    domainRoute: DomainRoute;
    language: "tr" | "en";
    classification?: ClassificationResult | null;
  }): Promise<{ extraction: Record<string, unknown>; model: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

    try {
      const { imageBase64, token, domainRoute, language, classification } = params;
      const prompt = getDomainPrompt(domainRoute, language, classification ?? undefined);

      let raw: string;
      const runtimeConfig = await loadRuntimeConfig();
      const extractionModel = resolveVertexImageModel(runtimeConfig);
      const model = extractionModel;

      raw = await this.callGemini({
        model: extractionModel,
        prompt,
        imageBase64,
        token,
        signal: controller.signal,
        maxTokens: 3072,
      });

      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        if (process.env.NODE_ENV !== "production") {
          console.error("[VertexImage] Extraction JSON parse failed, raw preview:", raw?.slice(0, 500));
        }
        // Stability: return controlled fallback instead of hard failure
        const fallback: Record<string, unknown> = {
          diagnosis: "Interpretation could not be extracted from model response.",
          findings: "Limited visibility. Please ensure image quality and try again.",
          limitations: ["AI response was not in expected format. Manual review recommended."],
          severity: "medium",
          affected_organ: "Unknown",
          modality: "",
          anatomical_region: "",
        };
        console.warn("[VertexImage] Using fallback extraction due to parse failure");
        return { extraction: fallback, model };
      }

      const obj = parsed as Record<string, unknown>;
      if (Object.keys(obj).length === 0) {
        const fallback: Record<string, unknown> = {
          diagnosis: "No structured findings could be extracted.",
          findings: "",
          limitations: ["Empty model response."],
          severity: "medium",
          affected_organ: "Unknown",
        };
        return { extraction: fallback, model };
      }

      return { extraction: obj, model };
    } catch (err: unknown) {
      clearTimeout(timer);

      if (err instanceof Error && err.name === "AbortError") {
        console.error("[VertexImage] Extraction timed out");
        throw new VertexTimeoutError(EXTRACTION_TIMEOUT_MS);
      }
      if (err instanceof Error && err.name?.startsWith("Vertex")) {
        throw err;
      }
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }

      console.error("[VertexImage] Extraction error:", err instanceof Error ? err.message : err);
      throw new VertexServiceError(
        err instanceof Error ? err.message : "Unknown extraction error",
        err
      );
    }
  }

  async analyzeImage(
    imageBase64: string,
    language: "tr" | "en" = "tr"
  ): Promise<VertexAnalysisResult> {
    let token: string;
    try {
      token = await this.getAccessToken();
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }
      throw new VertexCredentialError(
        err instanceof Error ? err.message : "Failed to obtain access token"
      );
    }

    const rawBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
    const runtimeSnapshot = await loadRuntimeConfig();
    const primaryVertexModel = resolveVertexImageModel(runtimeSnapshot);

    // STEP 1: Classification
    console.log("[VertexImage] Step 1: Classification...");
    const classification = await this.runClassification(rawBase64, token, language);

    // Route to universal assessment if confidence is too low
    if (classification.confidence < 50 && classification.domain_route !== "unknown") {
      console.log(`[VertexImage] Low confidence (${classification.confidence}), overriding route from "${classification.domain_route}" to "unknown"`);
      classification.domain_route = "unknown";
      if (!classification.limitations.some(l => l.toLowerCase().includes("confidence"))) {
        classification.limitations.push(
          `Classification confidence is low (${classification.confidence}%). Routing to universal assessment.`
        );
      }
    }

    const domainRoute = classification.domain_route;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[VertexImage] Classification result: route=${domainRoute}, modality=${classification.modality}, region=${classification.anatomical_region}, confidence=${classification.confidence}`);
    }

    // STEP 2: Specialist Extraction
    if (process.env.NODE_ENV !== "production") {
      console.log(`[VertexImage] Specialist extraction model: ${primaryVertexModel}`);
    }
    console.log(`[VertexImage] Step 2: Specialist extraction (${domainRoute})...`);
    const { extraction, model } = await this.runExtraction({
      imageBase64: rawBase64,
      token,
      domainRoute,
      language,
      classification,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[VertexImage] Extraction complete via ${model}, keys: ${Object.keys(extraction).join(", ")}`);
    }

    return {
      classification,
      extraction,
      domainRoute,
      model,
    };
  }
}

function defaultIntakeResult(): Omit<PerImageIntakeResult, "imageIndex" | "fileName"> {
  return {
    upload_type: "unknown",
    modality_guess: "",
    anatomical_region_guess: "",
    image_plane: "unknown",
    diagnostic_value: "low",
    contains_ui_overlay: false,
    contains_report_text: false,
    confidence: 0,
    reasons: ["Intake classification could not be performed"],
  };
}

function defaultClassification(): ClassificationResult {
  return {
    modality: "Unknown",
    anatomical_region: "Unknown",
    domain_route: "unknown",
    image_quality: "moderate",
    image_plane: "unknown",
    is_localizer: false,
    diagnostic_value: "medium",
    series_type_guess: "",
    confidence: 0,
    limitations: ["Classification could not be performed; using universal assessment"],
  };
}

/** Singleton. Use for image reasoning, OCR, fusion. */
export const googleHealthcare = new VertexImageService();

// ─── Cloud Healthcare API DICOM Store ─────────────────────
// Re-export Healthcare DICOM functions for upload/retrieve flow.

export {
  uploadDicomStudy,
  getStudyMetadata,
  getStudySeries,
  downloadSeries,
  type DicomUploadResult,
  type StudyMetadata,
  type SeriesInfo,
} from "./healthcareDicom";
