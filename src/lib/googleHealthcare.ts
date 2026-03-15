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
import {
  getIntakePrompt,
  resolveUploadType,
  type PerImageIntakeResult,
  type IntakeDiagnosticValue,
  type IntakeImagePlane,
} from './ai/intakePrompts';
import { VERTEX_CONFIG, getVertexEndpoint } from './vertexConfig';

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];
const KEY_FILE_PATH = path.join(process.cwd(), 'credentials', 'google-key.json');

const INTAKE_TIMEOUT_MS = 10_000;
const CLASSIFY_TIMEOUT_MS = 20_000;
const EXTRACTION_TIMEOUT_MS = 50_000;

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

function extractJSONFromText(text: string): unknown | null {
  if (!text || typeof text !== "string") return null;

  let cleaned = text.trim()
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  const jsonStr = removeTrailingCommas(cleaned.slice(firstBrace, lastBrace + 1));
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

export class GoogleHealthcareService {
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
    model: string;
    prompt: string;
    imageBase64: string;
    token: string;
    signal: AbortSignal;
    maxTokens: number;
  }): Promise<string> {
    const { model, prompt, imageBase64, token, signal, maxTokens } = params;
    const endpoint = getVertexEndpoint(model);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[GoogleHealthcare] Calling model=${model}, endpoint=${endpoint}`);
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
        temperature: 0.0,
        topP: 0.8,
        topK: 40,
        responseMimeType: "application/json",
      },
    };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (response.status === 403) {
      console.error(`[GoogleHealthcare] IAM 403 on model ${model}`);
      throw new VertexHttpError(403, response.statusText);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[GoogleHealthcare] HTTP ${response.status} on model=${model}, endpoint=${endpoint}:`, errText?.slice(0, 400));
      if (response.status === 404) {
        console.error(`[GoogleHealthcare] Model 404 — "${model}" not found. Use VERTEX_MODEL env to override. Valid models: gemini-2.5-flash, gemini-2.0-flash-001`);
      }
      throw new VertexHttpError(response.status, response.statusText, errText);
    }

    const data = await response.json();
    return extractTextFromGeminiResponse(data);
  }

  /**
   * Lightweight intake classification — determines upload type before main pipeline.
   * Use to route: diagnostic-image vs localizer vs report-image vs non-diagnostic.
   */
  async runIntakeClassification(
    imageBase64: string,
    language: "tr" | "en"
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
      const prompt = getIntakePrompt(language);
      const raw = await this.callGemini({
        model: VERTEX_CONFIG.model,
        prompt,
        imageBase64: rawBase64,
        token,
        signal: controller.signal,
        maxTokens: 350,
      });

      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        return defaultIntakeResult();
      }

      const obj = parsed as Record<string, unknown>;
      const validPlanes: IntakeImagePlane[] = [
        "sagittal",
        "axial",
        "coronal",
        "oblique",
        "unknown",
      ];
      const validDiagVal: IntakeDiagnosticValue[] = ["high", "medium", "low", "none"];

      return {
        upload_type: resolveUploadType(String(obj.upload_type ?? "")),
        modality_guess: String(obj.modality_guess ?? ""),
        anatomical_region_guess: String(obj.anatomical_region_guess ?? ""),
        image_plane: validPlanes.includes(String(obj.image_plane ?? "") as IntakeImagePlane)
          ? (String(obj.image_plane) as IntakeImagePlane)
          : "unknown",
        diagnostic_value: validDiagVal.includes(
          String(obj.diagnostic_value ?? "") as IntakeDiagnosticValue
        )
          ? (String(obj.diagnostic_value) as IntakeDiagnosticValue)
          : "low",
        contains_ui_overlay: obj.contains_ui_overlay === true,
        contains_report_text: obj.contains_report_text === true,
        confidence: typeof obj.confidence === "number" ? obj.confidence : 50,
        reasons: Array.isArray(obj.reasons) ? obj.reasons.map(String) : [],
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = err instanceof Error && err.name === "AbortError";
      if (isAbort) {
        console.warn("[GoogleHealthcare] Intake timed out, using defaults");
      } else {
        console.warn("[GoogleHealthcare] Intake failed:", err instanceof Error ? err.message : err);
      }
      return defaultIntakeResult();
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
      const prompt = getClassificationPrompt(language);
      const model = VERTEX_CONFIG.model;
      const raw = await this.callGemini({
        model,
        prompt,
        imageBase64,
        token,
        signal: controller.signal,
        maxTokens: 400,
      });

      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        console.warn("[GoogleHealthcare] Classification JSON parse failed, preview:", raw?.slice(0, 200));
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
        console.warn("[GoogleHealthcare] Classification timed out, using defaults");
      } else {
        console.warn("[GoogleHealthcare] Classification failed:", err instanceof Error ? err.message : err);
      }
      return defaultClassification();
    }
  }

  private async runExtraction(params: {
    imageBase64: string;
    token: string;
    domainRoute: DomainRoute;
    language: "tr" | "en";
  }): Promise<{ extraction: Record<string, unknown>; model: string }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), EXTRACTION_TIMEOUT_MS);

    try {
      const { imageBase64, token, domainRoute, language } = params;
      const prompt = getDomainPrompt(domainRoute, language);

      let raw: string;
      let model = VERTEX_CONFIG.model;

      try {
        raw = await this.callGemini({
          model: VERTEX_CONFIG.model,
          prompt,
          imageBase64,
          token,
          signal: controller.signal,
          maxTokens: 3072,
        });
      } catch (primaryErr) {
        if (primaryErr instanceof VertexHttpError) {
          if (primaryErr.status === 403) throw primaryErr;
          if (primaryErr.status === 404) {
            console.error(`[GoogleHealthcare] Primary model (${VERTEX_CONFIG.model}) returned 404. Set VERTEX_MODEL=gemini-2.0-flash-001 if 2.5 is unavailable.`);
            throw primaryErr;
          }
        }
        const errMsg = primaryErr instanceof Error ? primaryErr.message : String(primaryErr);
        console.warn(`[GoogleHealthcare] Primary model (${VERTEX_CONFIG.model}) failed:`, errMsg?.slice(0, 200));
        console.warn(`[GoogleHealthcare] Trying fallback: ${VERTEX_CONFIG.fallbackModel}`);
        model = VERTEX_CONFIG.fallbackModel;
        raw = await this.callGemini({
          model: VERTEX_CONFIG.fallbackModel,
          prompt,
          imageBase64,
          token,
          signal: controller.signal,
          maxTokens: 3072,
        });
      }

      clearTimeout(timer);

      const parsed = extractJSONFromText(raw);
      if (!parsed || typeof parsed !== "object") {
        console.error("[GoogleHealthcare] Extraction JSON parse failed");
        console.error("[VertexParse] raw response preview:", raw?.slice(0, 300));
        throw new VertexParseError(
          "Extraction returned unparseable response",
          raw?.slice(0, 200)
        );
      }

      const obj = parsed as Record<string, unknown>;
      if (Object.keys(obj).length === 0) {
        throw new VertexParseError("Extraction returned empty object");
      }

      return { extraction: obj, model };
    } catch (err: unknown) {
      clearTimeout(timer);

      if (err instanceof Error && err.name === "AbortError") {
        console.error("[GoogleHealthcare] Extraction timed out");
        throw new VertexTimeoutError(EXTRACTION_TIMEOUT_MS);
      }
      if (err instanceof Error && err.name?.startsWith("Vertex")) {
        throw err;
      }
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") {
        throw new VertexCredentialError(`Credential file not found at ${KEY_FILE_PATH}`);
      }

      console.error("[GoogleHealthcare] Extraction error:", err instanceof Error ? err.message : err);
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

    // STEP 1: Classification
    console.log("[GoogleHealthcare] Step 1: Classification...");
    const classification = await this.runClassification(rawBase64, token, language);

    // Route to universal assessment if confidence is too low
    if (classification.confidence < 50 && classification.domain_route !== "unknown") {
      console.log(`[GoogleHealthcare] Low confidence (${classification.confidence}), overriding route from "${classification.domain_route}" to "unknown"`);
      classification.domain_route = "unknown";
      if (!classification.limitations.some(l => l.toLowerCase().includes("confidence"))) {
        classification.limitations.push(
          `Classification confidence is low (${classification.confidence}%). Routing to universal assessment.`
        );
      }
    }

    const domainRoute = classification.domain_route;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[GoogleHealthcare] Classification result: route=${domainRoute}, modality=${classification.modality}, region=${classification.anatomical_region}, confidence=${classification.confidence}`);
    }

    // STEP 2: Specialist Extraction
    if (process.env.NODE_ENV !== "production") {
      console.log(`[GoogleHealthcare] Using extraction model: ${VERTEX_CONFIG.model} (fallback: ${VERTEX_CONFIG.fallbackModel})`);
    }
    console.log(`[GoogleHealthcare] Step 2: Specialist extraction (${domainRoute})...`);
    const { extraction, model } = await this.runExtraction({
      imageBase64: rawBase64,
      token,
      domainRoute,
      language,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[GoogleHealthcare] Extraction complete via ${model}, keys: ${Object.keys(extraction).join(", ")}`);
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

export const googleHealthcare = new GoogleHealthcareService();
