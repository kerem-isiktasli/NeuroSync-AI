import { NextResponse } from "next/server";
import { Anthropic } from "@anthropic-ai/sdk";
import sharp from "sharp";
import { z } from "zod";
import { googleHealthcare, type VertexAnalysisResult } from "@/lib/googleHealthcare";
import { isVertexError } from "@/lib/vertexErrors";
import {
  getSynthesisSystemPrompt,
  buildSynthesisUserMessage,
} from "@/lib/ai/synthesisPrompts";
import { deriveAdditionalDataRequests } from "@/lib/ai/dataRequestLogic";
import {
  shouldFetchLiterature,
  fetchLiterature,
  type LiteratureCitation,
} from "@/lib/ai/literatureSearch";
import { deriveConfidenceAssessment, getRouteQuestionHints } from "@/lib/ai/reportQuality";
import { buildStudyMetadata, type StudyMetadata } from "@/lib/ai/studyAggregator";
import { buildReconciliationBlock } from "@/lib/ai/crossImageReconciliation";
import {
  buildStudyIntakeSummary,
  getDiagnosticImageIndices,
  getViewableImageIndices,
  type StudyIntakeSummary,
} from "@/lib/ai/studyIntake";
import { selectBestSlices } from "@/lib/ai/sliceSelector";
import type { PerImageIntakeResult } from "@/lib/ai/intakePrompts";
import type { DomainRoute, ClassificationResult } from "@/lib/ai/promptRouter";
import { ANTHROPIC_CONFIG } from "@/lib/anthropicConfig";
import { VERTEX_CONFIG } from "@/lib/vertexConfig";
import { loadRuntimeConfig } from "@/lib/runtimeConfig";
import { applyContradictionGuards } from "@/lib/reportContradictionGuard";
import { rasterizePdfUpload } from "@/lib/rasterizePdfForAnalyze";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow large multipart uploads (50 images). JSON path still limited by default body parser. */
export const maxDuration = 300;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MAX_IMAGES = 50;
const MAX_SLICES_FOR_ANALYSIS =
  parseInt(process.env.MAX_DICOM_SLICES_FOR_AI ?? "25", 10) || 25;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
/** Per-image Vertex call timeout (classify+extract). */
const PER_IMAGE_TIMEOUT_MS = 35_000;
/** Maximum total Vertex analysis phase duration. */
const VERTEX_PHASE_MAX_MS = 180_000;
/** Process images in chunks of this size for bounded Vertex concurrency (default 2; env VERTEX_IMAGE_CONCURRENCY). */
const CHUNK_SIZE = Math.max(
  1,
  Math.min(8, parseInt(process.env.VERTEX_IMAGE_CONCURRENCY ?? "2", 10) || 2)
);
const SUPPORTED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// ─── ZOD SCHEMAS ────────────────────────────────────────

const InputImageSchema = z.object({
  imageBase64: z.string().min(1, "imageBase64 is required"),
  fileName: z.string().min(1).default("Image"),
});

const RequestSchema = z.object({
  scholarData: z.string().optional().default(""),
  language: z.enum(["tr", "en"]).optional().default("tr"),
  images: z.array(InputImageSchema).max(MAX_IMAGES).optional(),
  imageBase64: z.string().optional(),
  fileName: z.string().optional(),
});

const VertexFindingSchema = z.object({
  diagnosis: z.string().optional().default(""),
  severity: z.string().optional().default("medium"),
  affected_organ: z.string().optional().default("Unknown"),
  organ: z.string().optional().default(""),
  modality: z.string().optional().default(""),
  anatomical_region: z.string().optional().default(""),
  findings: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .default("")
    .transform((v) => (Array.isArray(v) ? v.join("\n") : String(v ?? ""))),
  clinical_eval: z.string().optional().default(""),
  reasoning: z.string().optional().default(""),
  recommendations: z.array(z.string()).optional().default([]),
  references: z.array(z.string()).optional().default([]),
  confidence: z.number().min(0).max(100).optional(),
  limitations: z.array(z.string()).optional().default([]),
});

const ReportSectionsSchema = z.object({
  plain_summary: z.string().optional().default(""),
  exam_overview: z.string().optional().default(""),
  technical_summary: z.string().optional().default(""),
  detailed_findings: z.array(z.string()).optional().default([]),
  interpretive_impression: z.string().optional().default(""),
  limitations: z.array(z.string()).optional().default([]),
  next_steps: z.array(z.string()).optional().default([]),
});

const DifferentialSchema = z.object({
  label: z.string(),
  likelihood: z.enum(["high", "moderate", "low"]),
  why_it_matches: z.string(),
  why_not_certain: z.string(),
});

const FinalResponseSchema = z.object({
  summary: z.string(),
  key_findings: z.array(z.string()),
  important_terms: z.array(
    z.object({
      term: z.string(),
      plain_explanation: z.string(),
    })
  ),
  concern_level: z.enum(["low", "moderate", "high", "urgent-review"]),
  possible_context: z.string(),

  differential_considerations: z.array(DifferentialSchema).optional().default([]),
  additional_data_requested: z.array(z.object({
    item: z.string(),
    reason: z.string(),
    priority: z.enum(["high", "medium", "low"]),
  })).optional().default([]),
  red_flags: z.array(z.string()).optional().default([]),
  literature_support: z.array(z.object({
    title: z.string(),
    source: z.string(),
    year: z.string(),
    relevance: z.string(),
  })).optional().default([]),

  questions_for_doctor: z.array(z.string()),
  follow_up_considerations: z.array(z.string()),
  medical_disclaimer: z.string(),
  modality: z.string().optional().default(""),
  anatomical_region: z.string().optional().default(""),
  professional_report_markdown: z.string().optional().default(""),
  report_sections: ReportSectionsSchema.optional().default({
    plain_summary: "",
    exam_overview: "",
    technical_summary: "",
    detailed_findings: [],
    interpretive_impression: "",
    limitations: [],
    next_steps: [],
  }),
  reportMode: z.string().optional(),
  reportLabel: z.object({
    reportMode: z.string(),
    inputTypeAnalyzed: z.string(),
    pipelineRan: z.string(),
    whatWasActuallyAnalyzed: z.array(z.string()),
    whatCouldNotBeDetermined: z.array(z.string()),
    analyzedSliceCount: z.number().optional(),
    analyzedFileCount: z.number().optional(),
    totalUploadedCount: z.number().optional(),
    selectedForAnalysisCount: z.number().optional(),
    selectionApplied: z.boolean().optional(),
    confidenceTier: z.string().optional(),
    adequacyTier: z.string().optional(),
  }).optional(),
});

type FinalResponse = z.infer<typeof FinalResponseSchema>;

type PreparedImage = {
  fileName: string;
  originalMimeType: string;
  normalizedMimeType: "image/jpeg";
  originalBase64: string;
  cleanBase64: string;
};

interface VertexViewWithMeta {
  finding: z.infer<typeof VertexFindingSchema>;
  classification: ClassificationResult;
  domainRoute: DomainRoute;
  model: string;
}

// ─── HELPERS ────────────────────────────────────────────

function getTextFromAnthropicContent(content: Anthropic.Message["content"]): string {
  return content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function extractDataUriMeta(value: string): { mimeType: string; base64: string } {
  const match = value.match(/^data:(.+?);base64,(.*)$/);
  if (!match) return { mimeType: "image/jpeg", base64: value };
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

function mapConcernLevel(
  rawSeverity?: string,
  fallbackFindings?: string
): FinalResponse["concern_level"] {
  const normalized = String(rawSeverity || "").toLowerCase();
  if (normalized.includes("critical")) return "urgent-review";
  if (normalized.includes("urgent")) return "urgent-review";
  if (normalized.includes("high")) return "high";
  if (normalized.includes("medium")) return "moderate";
  if (normalized.includes("moderate")) return "moderate";
  if (normalized.includes("low")) return "low";

  const findings = String(fallbackFindings || "").toLowerCase();
  if (
    findings.includes("mass") ||
    findings.includes("lesion") ||
    findings.includes("compression") ||
    findings.includes("fracture") ||
    findings.includes("hemorrhage")
  ) {
    return "high";
  }
  return "moderate";
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

function extractFirstJSONObject(text: string): unknown | null {
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

function safeJsonParse<T = unknown>(input: string): T | null {
  const trimmed = String(input).trim();
  const extracted = extractFirstJSONObject(trimmed);
  return extracted != null ? (extracted as T) : null;
}

function stripCodeFences(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

function normalizeExtractionResult(
  raw: Record<string, unknown>,
  classification: ClassificationResult
): Record<string, unknown> {
  const organ =
    (raw.affected_organ as string) ??
    (raw.organ as string) ??
    classification.anatomical_region ??
    "Unknown";

  const findings = raw.findings;
  const findingsNormalized = Array.isArray(findings)
    ? findings.filter((x) => typeof x === "string").join("\n")
    : typeof findings === "string"
    ? stripCodeFences(findings)
    : "";

  return {
    ...raw,
    affected_organ: organ,
    organ: organ,
    findings: findingsNormalized,
    modality: String(raw.modality ?? raw.study_type ?? classification.modality ?? ""),
    anatomical_region: String(raw.anatomical_region ?? classification.anatomical_region ?? ""),
  };
}

// ─── IMAGE NORMALIZATION ────────────────────────────────

async function normalizeImages(
  inputImages: Array<{ imageBase64: string; fileName: string }>
): Promise<PreparedImage[]> {
  const output: PreparedImage[] = [];

  for (const image of inputImages) {
    const { mimeType, base64 } = extractDataUriMeta(image.imageBase64);

    const isPdf =
      mimeType === "application/pdf" ||
      (mimeType === "application/octet-stream" && /\.pdf$/i.test(image.fileName));

    if (isPdf) {
      const remainingSlots = MAX_IMAGES - output.length;
      if (remainingSlots <= 0) {
        throw new Error(
          `Too many pages after PDF expansion. Maximum ${MAX_IMAGES} image slots allowed.`
        );
      }
      const pages = await rasterizePdfUpload({
        fileName: image.fileName,
        pdfBase64: base64,
        maxPages: remainingSlots,
      });
      output.push(...pages);
      continue;
    }
    if (
      mimeType.includes("dicom") ||
      mimeType.includes("application/dicom") ||
      mimeType.includes("application/octet-stream")
    ) {
      throw new Error("DICOM uploads are not supported by this route yet.");
    }
    if (!SUPPORTED_IMAGE_MIME.has(mimeType)) {
      throw new Error(`Unsupported image type: ${mimeType}`);
    }

    const imageBuffer = Buffer.from(base64, "base64");
    if (imageBuffer.byteLength > MAX_IMAGE_BYTES) {
      throw new Error(`Image too large: ${image.fileName}`);
    }

    const normalizedBuffer = await sharp(imageBuffer)
      .rotate()
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    output.push({
      fileName: image.fileName,
      originalMimeType: mimeType,
      normalizedMimeType: "image/jpeg",
      originalBase64: image.imageBase64,
      cleanBase64: normalizedBuffer.toString("base64"),
    });
  }

  return output;
}

// ─── VERTEX ANALYSIS (CLASSIFICATION → EXTRACTION) ──────

async function analyzeWithVertex(
  image: PreparedImage,
  language: "tr" | "en"
): Promise<VertexViewWithMeta> {
  const result: VertexAnalysisResult = await googleHealthcare.analyzeImage(
    image.originalBase64,
    language
  );

  const normalized = normalizeExtractionResult(result.extraction, result.classification);
  const validated = VertexFindingSchema.safeParse(normalized);

  if (!validated.success) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        `[analyze] Vertex schema mismatch for ${image.fileName}:`,
        validated.error.message
      );
    }
    throw new Error(
      `Vertex output validation failed for ${image.fileName}: ${validated.error.message}`
    );
  }

  return {
    finding: validated.data,
    classification: result.classification,
    domainRoute: result.domainRoute,
    model: result.model,
  };
}

// ─── FALLBACK ───────────────────────────────────────────

const FALLBACK_VISION_PROMPT_TR = `Sen RapiMed'sin. Vertex AI görüntü analizi başarısız oldu. Şimdi yalnızca bu tıbbi görüntülere bakarak EĞİTİM AMAÇLI basit bir yorum yap.

KURALLAR:
- Kesin tanı koyma.
- Sadece genel anatomi ve görünen yapılara dayalı basit bir özet ver.
- Belirsizlikleri açıkça belirt.
- Olası açıklamaları sırala (differential_considerations).
- SADECE geçerli JSON döndür. Markdown kullanma.

JSON ŞEMASI:
{"summary":"string","key_findings":["string"],"important_terms":[{"term":"string","plain_explanation":"string"}],"concern_level":"low|moderate|high|urgent-review","possible_context":"string","differential_considerations":[{"label":"string","likelihood":"high|moderate|low","why_it_matches":"string","why_not_certain":"string"}],"red_flags":["string"],"questions_for_doctor":["string"],"follow_up_considerations":["string"],"medical_disclaimer":"string","modality":"string","anatomical_region":"string","professional_report_markdown":"string","report_sections":{"exam_overview":"string","technical_summary":"string","detailed_findings":["string"],"interpretive_impression":"string","limitations":["string"],"next_steps":["string"]}}`;

const FALLBACK_VISION_PROMPT_EN = `You are RapiMed. Vertex AI image analysis failed. Provide a BASIC educational interpretation of these medical images only.

RULES:
- Do not give definitive diagnoses.
- Give a simple summary based on general anatomy and visible structures.
- State uncertainties clearly.
- Rank possible explanations (differential_considerations).
- Return ONLY valid JSON. No markdown.

JSON SCHEMA:
{"summary":"string","key_findings":["string"],"important_terms":[{"term":"string","plain_explanation":"string"}],"concern_level":"low|moderate|high|urgent-review","possible_context":"string","differential_considerations":[{"label":"string","likelihood":"high|moderate|low","why_it_matches":"string","why_not_certain":"string"}],"red_flags":["string"],"questions_for_doctor":["string"],"follow_up_considerations":["string"],"medical_disclaimer":"string","modality":"string","anatomical_region":"string","professional_report_markdown":"string","report_sections":{"exam_overview":"string","technical_summary":"string","detailed_findings":["string"],"interpretive_impression":"string","limitations":["string"],"next_steps":["string"]}}`;

async function runClaudeVisionFallback(params: {
  preparedImages: PreparedImage[];
  language: "tr" | "en";
  anthropicModel: string;
}): Promise<{ result: FinalResponse; usedFallback: true } | null> {
  const { preparedImages, language, anthropicModel } = params;
  const prompt = language === "tr" ? FALLBACK_VISION_PROMPT_TR : FALLBACK_VISION_PROMPT_EN;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }
  > = [{ type: "text", text: prompt }];

  for (const img of preparedImages) {
    const base64 = img.cleanBase64.includes(",")
      ? img.cleanBase64.split(",")[1]
      : img.cleanBase64;
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/jpeg", data: base64 },
    });
  }

  try {
    const msg = await anthropic.messages.create({
      model: anthropicModel,
      max_tokens: 3000,
      system: getSynthesisSystemPrompt(language),
      messages: [{ role: "user", content }],
    });

    const text = getTextFromAnthropicContent(msg.content);
    const parsed = safeJsonParse<unknown>(text);
    const validated = FinalResponseSchema.safeParse(parsed);

    if (validated.success) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[analyze] Claude vision fallback succeeded");
      }
      return { result: validated.data, usedFallback: true };
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analyze] Claude vision fallback validation failed:", validated.error.message);
    }
  } catch (err) {
    console.error("[analyze] Claude vision fallback failed:", err instanceof Error ? err.message : err);
  }
  return null;
}

function buildStructuredFailureResponse(params: {
  language: "tr" | "en";
  fileNames: string[];
  vertexErrors: Array<{ fileName: string; error: string }>;
  reason: string;
}): FinalResponse {
  const { language, vertexErrors, reason } = params;
  const errSummary =
    vertexErrors.length > 0
      ? vertexErrors.map((e) => `${e.fileName}: ${e.error}`).join("; ")
      : reason;

  if (language === "tr") {
    return {
      summary: `Görüntü analizi tamamlanamadı. Sebep: ${errSummary}`,
      key_findings: [
        "Otomatik görüntü analizi şu an kullanılamıyor.",
        "Kimlik bilgileri veya ağ ayarlarını kontrol edin.",
      ],
      important_terms: [],
      concern_level: "moderate",
      possible_context:
        "Teknik bir hata nedeniyle görüntü analizi yapılamadı. Lütfen daha sonra tekrar deneyin.",
      differential_considerations: [],
      additional_data_requested: [],
      red_flags: [],
      literature_support: [],
      questions_for_doctor: [
        "Bu görüntüleri nasıl değerlendirebilirim?",
        "Manuel inceleme için alternatif yollar var mı?",
      ],
      follow_up_considerations: [
        "Kimlik bilgilerini kontrol edin",
        "Daha sonra tekrar deneyin",
      ],
      medical_disclaimer:
        "Bu çıktı bilgilendirme amaçlıdır. Kesin tanı için uzman hekim değerlendirmesi gerekir.",
      modality: "",
      anatomical_region: "",
      professional_report_markdown: "",
      report_sections: {
        plain_summary: "",
        exam_overview: "",
        technical_summary: "",
        detailed_findings: [],
        interpretive_impression: "",
        limitations: ["Teknik hata nedeniyle analiz tamamlanamadı"],
        next_steps: ["Tekrar deneyin"],
      },
    };
  }

  return {
    summary: `Image analysis could not be completed. Reason: ${errSummary}`,
    key_findings: [
      "Automatic image analysis is currently unavailable.",
      "Please check credentials or network settings.",
    ],
    important_terms: [],
    concern_level: "moderate",
    possible_context:
      "Image analysis could not be performed due to a technical error. Please try again later.",
    differential_considerations: [],
    additional_data_requested: [],
    red_flags: [],
    literature_support: [],
    questions_for_doctor: [
      "How can I get these images evaluated?",
      "Are there alternative ways for manual review?",
    ],
    follow_up_considerations: [
      "Verify credentials",
      "Try again later",
    ],
    medical_disclaimer:
      "This output is for informational purposes only.",
    modality: "",
    anatomical_region: "",
    professional_report_markdown: "",
    report_sections: {
      plain_summary: "",
      exam_overview: "",
      technical_summary: "",
      detailed_findings: [],
      interpretive_impression: "",
      limitations: ["Analysis could not be completed due to a technical error"],
      next_steps: ["Try again later"],
    },
  };
}

function buildReportOnlyResponse(params: {
  language: "tr" | "en";
  fileNames: string[];
}): FinalResponse {
  const { language, fileNames } = params;
  const tr = language === "tr";

  const reportLabel = {
    reportMode: "DOCUMENT_EXTRACTION_REPORT" as const,
    inputTypeAnalyzed: tr ? "Rapor ekran görüntüsü / fotoğraf" : "Report screenshot / photo",
    pipelineRan: "intake -> report-ocr (no OCR)",
    whatWasActuallyAnalyzed: [
      tr ? "Görüntü sınıflandırması: rapor görüntüsü tespit edildi" : "Image classification: report image detected",
    ],
    whatCouldNotBeDetermined: [
      tr ? "Metin çıkarımı (OCR desteklenmiyor)" : "Text extraction (OCR not supported)",
      tr ? "Görüntü yorumlaması yapılamadı" : "Image interpretation could not be performed",
    ],
    analyzedFileCount: fileNames.length,
    adequacyTier: "limited" as const,
  };

  return {
    summary: tr
      ? "Yüklenen içerik yazılı tıbbi rapor ekran görüntüsü veya fotoğrafı gibi görünüyor."
      : "The uploaded content appears to be a screenshot or photo of a written medical report.",
    key_findings: tr
      ? [
          "Rapor görüntülerinden metin çıkarma (OCR) şu an desteklenmiyor.",
          "Yorumlama için gerçek tanısal görüntüler (MRI, CT, röntgen kesitleri) yükleyin.",
        ]
      : [
          "Text extraction (OCR) from report images is not currently supported.",
          "Please upload actual diagnostic images (MRI, CT, X-ray slices) for interpretation.",
        ],
    important_terms: [],
    concern_level: "moderate",
    possible_context: tr
      ? "RapiMed şu an sadece tıbbi GÖRÜNTÜ yorumlaması yapmaktadır. Yazılı rapor metnini okuyamaz."
      : "RapiMed currently interprets medical IMAGES only. It cannot read written report text.",
    differential_considerations: [],
    additional_data_requested: [
      {
        item: tr ? "Gerçek tanısal görüntü kesitleri (MRI/CT/XR)" : "Actual diagnostic image slices (MRI/CT/X-ray)",
        reason: tr
          ? "Yazılı rapor yerine ham görüntüleme verisi gereklidir."
          : "Raw imaging data is needed instead of written report.",
        priority: "high",
      },
    ],
    red_flags: [],
    literature_support: [],
    questions_for_doctor: [],
    follow_up_considerations: tr
      ? ["Tanısal görüntü kesitlerini yükleyin", "Resmi radyoloji raporunu doktorunuza gösterin"]
      : ["Upload diagnostic image slices", "Share the official radiology report with your doctor"],
    medical_disclaimer: tr
      ? "Bu çıktı bilgilendirme amaçlıdır. Kesin tanı için uzman hekim değerlendirmesi gerekir."
      : "This output is for informational purposes only.",
    modality: "",
    anatomical_region: "",
    professional_report_markdown: "",
    report_sections: {
      plain_summary: "",
      exam_overview: "",
      technical_summary: "",
      detailed_findings: [],
      interpretive_impression: tr
        ? "Yüklenen dosyalar rapor görüntüsü olarak sınıflandırıldı. Görüntü yorumlaması yapılamadı."
        : "Uploaded files were classified as report images. Image interpretation could not be performed.",
      limitations: [
        tr ? "OCR desteklenmiyor; rapor metni çıkarılamadı." : "OCR not supported; report text could not be extracted.",
      ],
      next_steps: [
        tr ? "Tanısal MRI/CT/XR kesitleri yükleyin" : "Upload diagnostic MRI/CT/X-ray slices",
      ],
    },
    reportMode: "DOCUMENT_EXTRACTION_REPORT",
    reportLabel,
  };
}

function buildInsufficientDataResponse(params: {
  language: "tr" | "en";
  fileNames: string[];
  intakeSummary: StudyIntakeSummary;
}): FinalResponse {
  const { language, fileNames, intakeSummary } = params;
  const tr = language === "tr";
  const { localizerCount, reportImageCount, studyAdequacy } = intakeSummary;

  const limitationParts: string[] = [];
  if (localizerCount > 0) {
    limitationParts.push(
      tr
        ? `${localizerCount} lokalizör/scout görüntüsü tespit edildi; tanısal kesit değildir.`
        : `${localizerCount} localizer/scout image(s) detected; not diagnostic slices.`
    );
  }
  if (reportImageCount > 0) {
    limitationParts.push(
      tr ? "Rapor görüntüleri tespit edildi; OCR desteklenmiyor." : "Report images detected; OCR not supported."
    );
  }
  limitationParts.push(
    tr
      ? "Detaylı yorumlama için tanısal kesitler (sagittal, aksiyel, koronal) gerekir."
      : "Diagnostic slices (sagittal, axial, coronal) are required for detailed interpretation."
  );

  const isLocalizerOnly = localizerCount > 0 && intakeSummary.diagnosticImageCount === 0;
  const reportMode = isLocalizerOnly ? "LOCALIZER_DETECTED_REPORT" : "LIMITED_IMAGE_ANALYSIS_REPORT";
  const reportLabel = {
    reportMode,
    inputTypeAnalyzed: tr
      ? (localizerCount > 0 ? `Lokalizör görüntüleri (${localizerCount})` : "Yetersiz görüntü seti")
      : (localizerCount > 0 ? `Localizer images (${localizerCount})` : "Insufficient image set"),
    pipelineRan: "intake -> insufficient-data",
    whatWasActuallyAnalyzed: [
      tr ? "Görüntü sınıflandırması yapıldı" : "Image classification performed",
      ...(localizerCount > 0 ? [tr ? "Lokalizör/scout tespit edildi" : "Localizer/scout detected"] : []),
    ],
    whatCouldNotBeDetermined: [
      tr ? "Tanısal yorumlama — yeterli tanısal kesit yok" : "Diagnostic interpretation — no sufficient diagnostic slices",
    ],
    analyzedFileCount: intakeSummary.viewableImageCount ?? 0,
    adequacyTier: intakeSummary.adequacyTier ?? "limited",
  };

  return {
    summary: tr
      ? "Yüklenen görüntüler tanısal yorumlama için yeterli değil."
      : "The uploaded images are not sufficient for diagnostic interpretation.",
    key_findings: tr
      ? [
          "Görüntüler lokalizör, düşük kaliteli veya tanısal olmayan türde sınıflandırıldı.",
          "Tanısal kesitler (MRI/CT/XR) yükleyerek tekrar deneyin.",
        ]
      : [
          "Images were classified as localizer, low quality, or non-diagnostic.",
          "Please try again by uploading diagnostic slices (MRI/CT/X-ray).",
        ],
    important_terms: [],
    concern_level: "moderate",
    possible_context: tr
      ? `Çalışma yeterliliği: ${studyAdequacy}. Daha fazla veri gerekli.`
      : `Study adequacy: ${studyAdequacy}. Additional data required.`,
    differential_considerations: [],
    additional_data_requested: [
      {
        item: tr ? "Tanısal görüntü kesitleri (sagittal, aksiyel, koronal)" : "Diagnostic image slices (sagittal, axial, coronal)",
        reason: tr
          ? "Lokalizör veya düşük kaliteli görüntülerle güvenilir yorumlama yapılamaz."
          : "Reliable interpretation is not possible from localizer or low-quality images.",
        priority: "high",
      },
    ],
    red_flags: [],
    literature_support: [],
    questions_for_doctor: tr
      ? ["Tam MRI/CT serisi nasıl paylaşılır?", "Hangi kesitler tanısal değerde?"]
      : ["How do I share my full MRI/CT series?", "Which slices are diagnostically useful?"],
    follow_up_considerations: tr
      ? ["Tanısal kesitler yükleyin", "Resmi raporu doktorunuza gösterin"]
      : ["Upload diagnostic slices", "Share official report with your doctor"],
    medical_disclaimer: tr
      ? "Bu çıktı bilgilendirme amaçlıdır."
      : "This output is for informational purposes only.",
    modality: "",
    anatomical_region: "",
    professional_report_markdown: "",
    report_sections: {
      plain_summary: "",
      exam_overview: "",
      technical_summary: "",
      detailed_findings: [],
      interpretive_impression: tr
        ? "Yüklenen görüntüler yeterli tanısal bilgi içermiyor. Ek kesitler gereklidir."
        : "Uploaded images do not contain sufficient diagnostic information. Additional slices are required.",
      limitations: limitationParts,
      next_steps: [
        tr ? "Tanısal MRI/CT kesitleri yükleyin" : "Upload diagnostic MRI/CT slices",
      ],
    },
    reportMode,
    reportLabel,
  };
}

function buildFallbackResponse(params: {
  language: "tr" | "en";
  fileNames: string[];
  vertexViews: VertexViewWithMeta[];
}): FinalResponse {
  const { language, fileNames, vertexViews } = params;

  const allFindings = vertexViews.map((v) => v.finding.findings).filter(Boolean).join(" ");
  const organList = Array.from(
    new Set(
      vertexViews
        .map((v) => v.finding.affected_organ || v.finding.organ)
        .filter(Boolean)
        .map(String)
    )
  );
  const modality = vertexViews[0]?.classification?.modality ?? "";
  const region = vertexViews[0]?.classification?.anatomical_region ?? "";

  if (language === "tr") {
    return {
      summary:
        vertexViews.length > 0
          ? `Yüklenen görüntülerde ${organList.length ? organList.join(", ") : "ilgili anatomik bölgeler"} ile ilişkili bulgular değerlendirildi.`
          : `Yüklenen dosyalar (${fileNames.join(", ")}) için sınırlı analiz üretilebildi.`,
      key_findings:
        vertexViews.length > 0
          ? vertexViews.map((v) => v.finding.diagnosis || v.finding.findings).filter(Boolean).slice(0, 5)
          : ["Analiz sonucu sınırlı düzeyde üretilebildi."],
      important_terms: [],
      concern_level: mapConcernLevel(vertexViews[0]?.finding.severity, allFindings),
      possible_context:
        "Bulgular eğitim amaçlı yapay zeka yorumudur. Klinik bağlam ve kesin değerlendirme için doktor incelemesi gerekir.",
      differential_considerations: [],
      additional_data_requested: [],
      red_flags: [],
      literature_support: [],
      questions_for_doctor: [
        "Bu bulgular klinik olarak ne kadar önemlidir?",
        "Ek görüntüleme veya takip gerekir mi?",
        "Hangi belirtiler olursa acil değerlendirme gerekir?",
      ],
      follow_up_considerations: [
        "Gerekirse uzman hekim değerlendirmesi",
        "Önceki görüntülerle karşılaştırma",
        "Takip görüntüleme veya ek tetkik gereksiniminin görüşülmesi",
      ],
      medical_disclaimer:
        "Bu çıktı bilgilendirme amaçlıdır. Kesin tanı ve tedavi için uzman hekim değerlendirmesi gereklidir.",
      modality,
      anatomical_region: region,
      professional_report_markdown: "",
      report_sections: {
        plain_summary: "",
        exam_overview: "",
        technical_summary: "",
        detailed_findings: vertexViews.map((v) => v.finding.findings).filter(Boolean),
        interpretive_impression: "",
        limitations: vertexViews.flatMap((v) => v.finding.limitations ?? []),
        next_steps: [],
      },
    };
  }

  return {
    summary:
      vertexViews.length > 0
        ? `The uploaded images were reviewed for findings related to ${organList.length ? organList.join(", ") : "the relevant anatomical regions"}.`
        : `A limited analysis was generated for the uploaded files (${fileNames.join(", ")}).`,
    key_findings:
      vertexViews.length > 0
        ? vertexViews.map((v) => v.finding.diagnosis || v.finding.findings).filter(Boolean).slice(0, 5)
        : ["Only a limited analysis could be generated."],
    important_terms: [],
    concern_level: mapConcernLevel(vertexViews[0]?.finding.severity, allFindings),
    possible_context:
      "These findings are AI-assisted educational interpretations and should be reviewed by a licensed clinician.",
    differential_considerations: [],
    additional_data_requested: [],
    red_flags: [],
    literature_support: [],
    questions_for_doctor: [
      "How clinically important are these findings?",
      "Do I need follow-up imaging or additional tests?",
      "What symptoms would require urgent evaluation?",
    ],
    follow_up_considerations: [
      "Specialist review if appropriate",
      "Comparison with prior imaging",
      "Discussion of follow-up imaging or additional tests",
    ],
    medical_disclaimer:
      "This output is for informational purposes only and does not replace medical advice from a licensed clinician.",
    modality,
    anatomical_region: region,
    professional_report_markdown: "",
    report_sections: {
      plain_summary: "",
      exam_overview: "",
      technical_summary: "",
      detailed_findings: vertexViews.map((v) => v.finding.findings).filter(Boolean),
      interpretive_impression: "",
      limitations: vertexViews.flatMap((v) => v.finding.limitations ?? []),
      next_steps: [],
    },
  };
}

// ─── MAIN HANDLER ───────────────────────────────────────

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (type: string, data: unknown) => {
    await writer.write(
      encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
    );
  };

  const sendProgress = async (
    phase: string,
    percent: number,
    message: string,
    extra?: Record<string, unknown>
  ) => {
    const pct = Math.min(100, Math.max(0, Math.round(percent)));
    await sendEvent("progress", { phase, percent: pct, message, ...extra });
  };

  const finalize = async () => {
    try { await writer.close(); } catch { /* no-op */ }
  };

  (async () => {
    const runtimeConfig = await loadRuntimeConfig();
    const activeAnthropicModel =
      runtimeConfig.anthropicModel || ANTHROPIC_CONFIG.model;
    const activeVertexModel =
      runtimeConfig.vertexModel || VERTEX_CONFIG.extractionModel;
    void activeVertexModel;
    const phaseStart = Date.now();
    const uploadId = `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const traceCheckpoints: Array<{ step: string; status: string; durationMs: number; counts?: Record<string, number> }> = [];
    const traceErrors: Array<{ step: string; errorCode: string; message: string }> = [];
    let tracePipeline = "unknown";
    let traceDomain = "unknown";

    const logPhase = (phase: string, counts?: Record<string, number>) => {
      const elapsed = Date.now() - phaseStart;
      traceCheckpoints.push({ step: phase, status: "ok", durationMs: elapsed, ...(counts ? { counts } : {}) });
      if (process.env.NODE_ENV !== "production") {
        console.log(`[analyze][${uploadId}] ${phase} @ +${elapsed}ms`);
      }
    };
    const logError = (step: string, errorCode: string, message: string) => {
      traceErrors.push({ step, errorCode, message });
      console.error(`[analyze][${uploadId}] ERROR ${step}: ${errorCode} — ${message}`);
    };
    try {
      const contentType = req.headers.get("content-type") ?? "";
      let imagesInput: Array<{ imageBase64: string; fileName: string }> = [];
      let language: "tr" | "en" = "tr";
      let scholarData = "";
      let clientRoutingContext: {
        pipeline?: string;
        domain?: string;
        confidenceLevel?: string;
        safetyLevel?: string;
        reportStyle?: string;
        bodyRegionSource?: string;
        conflicts?: string[];
        reasons?: string[];
        primaryConcern?: string;
        bodyRegion?: string;
        symptomDuration?: string;
        symptomTrend?: string;
        studyTimeline?: string;
        knownDiagnoses?: string[];
        chronicConditions?: string[];
        desiredOutput?: string[];
        isQuickMode?: boolean;
      } | null = null;

      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        language = (formData.get("language") as string)?.toLowerCase().trim() === "en" ? "en" : "tr";
        scholarData = (formData.get("scholarData") as string) ?? "";

        const routingRaw = formData.get("routingContext") as string | null;
        if (routingRaw) {
          try {
            clientRoutingContext = JSON.parse(routingRaw);
            logPhase("client-routing-parsed", {
              pipeline: clientRoutingContext?.pipeline as unknown as number ?? 0,
              domain: clientRoutingContext?.domain as unknown as number ?? 0,
            });
          } catch {
            logError("client-routing", "PARSE_ERROR", "Failed to parse routingContext from client");
          }
        }
        const files = [
          ...(formData.getAll("images") as File[]),
          ...(formData.getAll("files") as File[]),
        ].filter((v): v is File => v instanceof File);

        if (files.length > MAX_IMAGES) {
          await sendEvent("error", {
            message: `Too many images. Maximum ${MAX_IMAGES} allowed, received ${files.length}.`,
          });
          return;
        }

        for (const file of files) {
          const buf = await file.arrayBuffer();
          const base64 = Buffer.from(buf).toString("base64");
          const mime = file.type || "image/jpeg";
          const dataUri = `data:${mime};base64,${base64}`;
          imagesInput.push({ imageBase64: dataUri, fileName: file.name || "Image" });
        }
      } else {
        const json = await req.json();
        const parsedBody = RequestSchema.safeParse(json);

        if (!parsedBody.success) {
          const flat = parsedBody.error.flatten();
          const isArrayMax = flat.fieldErrors?.images?.[0]?.includes("at most");
          const imgCount = Array.isArray(json?.images) ? json.images.length : 0;
          await sendEvent("error", {
            message: isArrayMax && imgCount > 0
              ? `Too many images. Maximum ${MAX_IMAGES} allowed, received ${imgCount}.`
              : "Invalid request body",
            details: flat,
          });
          return;
        }

        language = parsedBody.data.language ?? "tr";
        scholarData = parsedBody.data.scholarData ?? "";
        imagesInput =
          Array.isArray(parsedBody.data.images) && parsedBody.data.images.length > 0
            ? parsedBody.data.images
            : parsedBody.data.imageBase64
              ? [{
                  imageBase64: parsedBody.data.imageBase64,
                  fileName: parsedBody.data.fileName || "Image",
                }]
              : [];
      }

      if (!imagesInput.length) {
        await sendEvent("error", { message: "No images provided" });
        return;
      }

      const seen = new Set<string>();
      imagesInput = imagesInput.filter((img) => {
        const key = img.fileName + "_" + img.imageBase64.length;
        if (seen.has(key)) {
          console.warn("[analyze] Duplicate image removed:", img.fileName);
          return false;
        }
        seen.add(key);
        return true;
      });

      await sendEvent("status", {
        step: "received",
        message: language === "tr" ? "Görüntüler alındı." : "Images received successfully.",
      });
      await sendProgress(
        "received",
        5,
        language === "tr" ? "Görüntüler alındı." : "Images received successfully."
      );

      // ──── NORMALIZATION ────
      logPhase("normalize-start");
      const preparedImages = await normalizeImages(imagesInput);
      logPhase("normalize-done");

      await sendEvent("status", {
        step: "normalized",
        message: language === "tr"
          ? "Görüntüler analiz için hazırlandı."
          : "Images were normalized for analysis.",
      });
      await sendProgress(
        "normalized",
        12,
        language === "tr"
          ? "Görüntüler analiz için hazırlandı."
          : "Images were normalized for analysis."
      );

      // ──── INTAKE CLASSIFICATION (pre-analysis upload-type detection) ────
      await sendEvent("status", {
        step: "intake",
        message: language === "tr"
          ? "Yükleme türü analiz ediliyor..."
          : "Analyzing upload type...",
      });
      await sendProgress(
        "intake",
        18,
        language === "tr"
          ? "Yükleme türü analiz ediliyor..."
          : "Analyzing upload type..."
      );

      logPhase("intake-start");
      const perImageIntake: PerImageIntakeResult[] = [];

      // Single image fast path — skip intake classification, use defaults
      if (preparedImages.length === 1) {
        perImageIntake.push({
          imageIndex: 0,
          fileName: preparedImages[0].fileName,
          upload_type: "diagnostic-image",
          modality_guess: "",
          anatomical_region_guess: "",
          image_plane: "unknown",
          diagnostic_value: "medium",
          contains_ui_overlay: false,
          contains_report_text: false,
          confidence: 50,
          reasons: ["intake-skip-single"],
        });
        logPhase("intake-skip-single");
      } else {
        // Chunked parallel intake to avoid sequential hang on many images
        for (let c = 0; c < preparedImages.length; c += CHUNK_SIZE) {
          const chunk = preparedImages.slice(c, c + CHUNK_SIZE);
          const chunkResults = await Promise.allSettled(
            chunk.map(async (img, ci) => {
              const idx = c + ci;
              try {
                const rawBase64 = img.originalBase64.includes(",")
                  ? img.originalBase64.split(",")[1]
                  : img.originalBase64;
                const result = await googleHealthcare.runIntakeClassification(rawBase64, language);
                return { imageIndex: idx, fileName: img.fileName, ...result };
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Intake failed";
                console.warn(`[analyze] Intake failed for ${img.fileName}:`, msg);
                return {
                  imageIndex: idx,
                  fileName: img.fileName,
                  upload_type: "unknown" as const,
                  modality_guess: "",
                  anatomical_region_guess: "",
                  image_plane: "unknown" as const,
                  diagnostic_value: "low" as const,
                  contains_ui_overlay: false,
                  contains_report_text: false,
                  confidence: 0,
                  reasons: [`Intake error: ${msg}`],
                };
              }
            })
          );
          for (const r of chunkResults) {
            if (r.status === "fulfilled") perImageIntake.push(r.value as PerImageIntakeResult);
          }
        }
      }

      const intakeSummary: StudyIntakeSummary = buildStudyIntakeSummary(perImageIntake);
      tracePipeline = intakeSummary.recommendedPipeline;
      logPhase("intake-done", {
        imageCount: intakeSummary.imageCount,
        diagnosticCount: intakeSummary.diagnosticImageCount,
        viewableCount: intakeSummary.viewableImageCount,
        localizerCount: intakeSummary.localizerCount,
        reportImageCount: intakeSummary.reportImageCount,
      });

      await sendEvent("log", {
        phase: "intake-complete",
        studyAdequacy: intakeSummary.studyAdequacy,
        recommendedPipeline: intakeSummary.recommendedPipeline,
        diagnosticCount: intakeSummary.diagnosticImageCount,
        localizerCount: intakeSummary.localizerCount,
        reportImageCount: intakeSummary.reportImageCount,
        uploadTypesPresent: intakeSummary.uploadTypesPresent,
        message: language === "tr"
          ? `Yükleme analizi: ${intakeSummary.recommendedPipeline}, ${intakeSummary.diagnosticImageCount} tanısal görüntü`
          : `Intake: ${intakeSummary.recommendedPipeline}, ${intakeSummary.diagnosticImageCount} diagnostic images`,
      });

      // ──── CLIENT INTAKE-AWARE ROUTING CONTEXT ────
      if (clientRoutingContext) {
        logPhase("client-routing-applied");
        await sendEvent("log", {
          phase: "intake-routing",
          clientPipeline: clientRoutingContext.pipeline,
          clientDomain: clientRoutingContext.domain,
          clientConfidence: clientRoutingContext.confidenceLevel,
          clientSafety: clientRoutingContext.safetyLevel,
          clientReportStyle: clientRoutingContext.reportStyle,
          conflicts: clientRoutingContext.conflicts,
          reasons: clientRoutingContext.reasons,
          message: `Client routing: pipeline=${clientRoutingContext.pipeline}, domain=${clientRoutingContext.domain}, confidence=${clientRoutingContext.confidenceLevel}`,
        });

        // If client says document-report pipeline but backend detected diagnostic images,
        // log conflict but let backend proceed with image analysis (safest path).
        if (
          clientRoutingContext.pipeline === "document-report" &&
          intakeSummary.diagnosticImageCount > 0
        ) {
          await sendEvent("log", {
            phase: "routing-conflict",
            message: "Client says document-report but backend found diagnostic images. Proceeding with image-analysis.",
          });
        }

        // Inject client domain hint for downstream use
        if (clientRoutingContext.domain && clientRoutingContext.domain !== "general-radiology") {
          traceDomain = clientRoutingContext.domain;
        }
      }

      // ──── ROUTING: report-ocr or insufficient-data with no diagnostic images ────
      if (
        intakeSummary.recommendedPipeline === "report-ocr" &&
        intakeSummary.diagnosticImageCount === 0
      ) {
        await sendEvent("status", {
          step: "report-only",
          message: language === "tr"
            ? "Rapor görüntüleri tespit edildi. OCR desteklenmiyor."
            : "Report images detected. OCR not supported.",
        });
        await sendProgress(
          "report-only",
          100,
          language === "tr" ? "Rapor yanıtı hazırlanıyor." : "Preparing report response."
        );
        const reportOnlyResult = buildReportOnlyResponse({
          language,
          fileNames: preparedImages.map((img) => img.fileName),
        });
        await sendEvent("result", {
          ...reportOnlyResult,
          meta: {
            fileNames: preparedImages.map((img) => img.fileName),
            pipeline: "intake -> report-ocr (no OCR)",
            intakeSummary: {
              studyAdequacy: intakeSummary.studyAdequacy,
              recommendedPipeline: intakeSummary.recommendedPipeline,
              diagnosticImageCount: 0,
              reportImageCount: intakeSummary.reportImageCount,
            },
          },
        });
        await sendEvent("done", { success: true });
        return;
      }

      // NOTE: We no longer hard-reject on "insufficient-data" from intake.
      // Intake can misclassify usable screenshots as non-diagnostic.
      // Instead, we always attempt analysis and let the quality tier surface
      // in the report. Only truly unusable images (0 viewable) get limited report.

      // ──── Select images for image-analysis pipeline ────
      // Prefer diagnostic images; fall back to all viewable; ultimate fallback: all images
      const diagnosticIndices = getDiagnosticImageIndices(perImageIntake);
      const viewableIndices = getViewableImageIndices(perImageIntake);

      let indicesToProcess: number[];

      if (preparedImages.length > MAX_SLICES_FOR_ANALYSIS) {
        indicesToProcess = selectBestSlices(
          perImageIntake,
          MAX_SLICES_FOR_ANALYSIS
        );
        await sendEvent("log", {
          phase: "slice-selection",
          totalUploaded: preparedImages.length,
          selectedForAnalysis: indicesToProcess.length,
          message:
            language === "tr"
              ? `${preparedImages.length} görüntüden en iyi ${indicesToProcess.length} tanesi seçildi.`
              : `Selected best ${indicesToProcess.length} of ${preparedImages.length} uploaded images for analysis.`,
        });
      } else {
        indicesToProcess =
          diagnosticIndices.length > 0 ? diagnosticIndices : viewableIndices;
        if (indicesToProcess.length === 0)
          indicesToProcess = preparedImages.map((_, i) => i);
      }
      const imagesToProcess = indicesToProcess.map((idx) => preparedImages[idx]).filter(Boolean);
      const useLimitedReportMode =
        (diagnosticIndices.length === 0 && viewableIndices.length > 0) ||
        intakeSummary.adequacyTier === "limited" ||
        intakeSummary.adequacyTier === "unusable"
        // "interpretable" and "strong" always get full report
        ? intakeSummary.adequacyTier !== "interpretable" && intakeSummary.adequacyTier !== "strong"
        : false;

      if (indicesToProcess.length > 0 && indicesToProcess.length < preparedImages.length) {
        await sendEvent("log", {
          phase: "intake-filter",
          processed: indicesToProcess.length,
          skipped: preparedImages.length - indicesToProcess.length,
          message: language === "tr"
            ? `${indicesToProcess.length} görüntü işlenecek; ${preparedImages.length - indicesToProcess.length} atlandı`
            : `Processing ${indicesToProcess.length} images; skipping ${preparedImages.length - indicesToProcess.length}`,
        });
      }

      // ──── CLASSIFICATION + EXTRACTION (chunked with timeout) ────
      logPhase("vertex-batch-start");
      const vertexViews: VertexViewWithMeta[] = [];
      const vertexErrors: Array<{ fileName: string; error: string }> = [];
      const vertexPhaseStart = Date.now();

      for (let c = 0; c < imagesToProcess.length; c += CHUNK_SIZE) {
        if (Date.now() - vertexPhaseStart > VERTEX_PHASE_MAX_MS) {
          await sendEvent("log", {
            phase: "vertex-timeout",
            processed: vertexViews.length,
            total: imagesToProcess.length,
            message: language === "tr"
              ? `Analiz süresi aşıldı (${vertexViews.length}/${imagesToProcess.length} tamamlandı).`
              : `Analysis timeout (${vertexViews.length}/${imagesToProcess.length} completed).`,
          });
          break;
        }

        const chunk = imagesToProcess.slice(c, c + CHUNK_SIZE);
        await sendEvent("log", {
          phase: "vertex-chunk",
          chunkStart: c + 1,
          chunkEnd: Math.min(c + CHUNK_SIZE, imagesToProcess.length),
          total: imagesToProcess.length,
          message: language === "tr"
            ? `Görüntü ${c + 1}–${Math.min(c + CHUNK_SIZE, imagesToProcess.length)} / ${imagesToProcess.length} analiz ediliyor...`
            : `Analyzing images ${c + 1}–${Math.min(c + CHUNK_SIZE, imagesToProcess.length)} of ${imagesToProcess.length}...`,
        });

        const chunkResults = await Promise.allSettled(
          chunk.map(async (current) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), PER_IMAGE_TIMEOUT_MS);
            try {
              const view = await analyzeWithVertex(current, language);
              clearTimeout(timer);
              return { ok: true as const, view, fileName: current.fileName };
            } catch (error) {
              clearTimeout(timer);
              const message = error instanceof Error ? error.message : "Unknown Vertex error";
              return { ok: false as const, fileName: current.fileName, error: message };
            }
          })
        );

        for (const r of chunkResults) {
          if (r.status !== "fulfilled") continue;
          const val = r.value;
          if (val.ok) {
            vertexViews.push(val.view);
            await sendEvent("partial_vertex", {
              fileName: val.fileName,
              diagnosis: val.view.finding.diagnosis,
              organ: val.view.finding.affected_organ || val.view.finding.organ,
              severity: val.view.finding.severity,
              domainRoute: val.view.domainRoute,
              modality: val.view.classification.modality,
              anatomicalRegion: val.view.classification.anatomical_region,
            });
          } else {
            vertexErrors.push({ fileName: val.fileName, error: val.error });
            logError("vertex-extraction", "VERTEX_FAIL", `${val.fileName}: ${val.error}`);
            await sendEvent("log", { phase: "vertex-analysis-warning", fileName: val.fileName, message: val.error });
          }
        }

        const vertexPct =
          imagesToProcess.length > 0
            ? 28 +
              Math.round((vertexViews.length / imagesToProcess.length) * 47)
            : 75;
        await sendProgress(
          "vertex",
          vertexPct,
          language === "tr"
            ? `${vertexViews.length}/${imagesToProcess.length} görüntü analiz edildi`
            : `${vertexViews.length} of ${imagesToProcess.length} images analyzed`,
          {
            completed: vertexViews.length,
            total: imagesToProcess.length,
          }
        );
      }
      logPhase(`vertex-batch-done count=${vertexViews.length}/${imagesToProcess.length}`);

      // ──── ALL VERTEX FAILED → FALLBACK ────
      if (!vertexViews.length) {
        await sendEvent("status", {
          step: "claude-fallback",
          message: language === "tr"
            ? "Vertex analizi başarısız. Claude ile alternatif yorum deneniyor."
            : "Vertex analysis failed. Trying Claude fallback interpretation.",
        });

        const claudeFallback = await runClaudeVisionFallback({
          anthropicModel: activeAnthropicModel,
          preparedImages,
          language,
        });

        const fallbackResult = claudeFallback
          ? claudeFallback.result
          : buildStructuredFailureResponse({
              language,
              fileNames: preparedImages.map((img) => img.fileName),
              vertexErrors,
              reason: vertexErrors.length
                ? vertexErrors.map((e) => e.error).join("; ")
                : "Unknown error",
            });

        const meta: Record<string, unknown> = {
          fileNames: preparedImages.map((img) => img.fileName),
          processedCount: preparedImages.length,
          successfulVertexAnalyses: 0,
          failedVertexAnalyses: vertexErrors,
          pipeline: claudeFallback
            ? "vertex-failed -> claude-vision-fallback"
            : "vertex-failed -> structured-failure",
        };

        if (process.env.NODE_ENV !== "production") {
          meta.debug = {
            vertexSuccessCount: 0,
            vertexErrorCount: vertexErrors.length,
            vertexErrors: vertexErrors.map((e) => ({ file: e.fileName, error: e.error })),
            claudeFallbackUsed: !!claudeFallback,
          };
        }

        await sendProgress(
          "finalize-fallback",
          99,
          language === "tr" ? "Rapor tamamlanıyor..." : "Finalizing report..."
        );
        await sendEvent("result", { ...fallbackResult, meta });
        return;
      }

      // ──── STUDY-LEVEL AGGREGATION ────
      const         studyMeta: StudyMetadata = buildStudyMetadata(
        vertexViews.map((v, i) => ({
          fileName: imagesToProcess[i]?.fileName ?? `Image_${i + 1}`,
          classification: v.classification,
          domainRoute: v.domainRoute,
        }))
      );

      await sendEvent("log", {
        phase: "study-aggregation",
        studyAdequacy: studyMeta.studyAdequacy,
        planesAvailable: studyMeta.planesAvailable,
        diagnosticImages: studyMeta.diagnosticImageCount,
        nonDiagnosticImages: studyMeta.nonDiagnosticImageCount,
        localizerPresent: studyMeta.localizerPresent,
        seriesGuesses: studyMeta.seriesGuesses,
        message: language === "tr"
          ? `Çalışma analizi: ${studyMeta.studyAdequacy}, ${studyMeta.diagnosticImageCount} tanısal görüntü`
          : `Study analysis: ${studyMeta.studyAdequacy}, ${studyMeta.diagnosticImageCount} diagnostic images`,
      });
      await sendProgress(
        "study-aggregation",
        79,
        language === "tr"
          ? "Çalışma düzeyinde bulgular birleştiriliyor..."
          : "Merging findings at study level..."
      );

      // ──── CROSS-IMAGE RECONCILIATION ────
      const reconciliationBlock = buildReconciliationBlock(
        studyMeta,
        vertexViews.map((v, i) => ({
          imageIndex: i,
          fileName: imagesToProcess[i]?.fileName ?? `Image_${i + 1}`,
          image_plane: v.classification.image_plane,
          diagnostic_value: v.classification.diagnostic_value,
          is_localizer: v.classification.is_localizer,
          findings: v.finding.findings,
          diagnosis: v.finding.diagnosis,
          severity: v.finding.severity,
          limitations: v.finding.limitations ?? [],
        })),
        language
      );

      if (reconciliationBlock) {
        await sendEvent("log", {
          phase: "cross-image-reconciliation",
          message: language === "tr"
            ? "Çapraz görüntü karşılaştırması oluşturuldu"
            : "Cross-image reconciliation generated",
        });
        await sendProgress(
          "reconciliation",
          82,
          language === "tr"
            ? "Çapraz görüntü karşılaştırması tamamlandı"
            : "Cross-image reconciliation complete"
        );
      }

      // ──── DERIVE ADDITIONAL DATA REQUESTS (deterministic) ────
      const classificationForSynthesis = vertexViews[0]?.classification ?? null;
      const primaryDomainRoute = vertexViews[0]?.domainRoute ?? "unknown";
      traceDomain = primaryDomainRoute;
      const allExtractionLimitations = vertexViews.flatMap((v) => v.finding.limitations ?? []);

      const additionalDataRequested = classificationForSynthesis
        ? deriveAdditionalDataRequests({
            domainRoute: primaryDomainRoute,
            classification: classificationForSynthesis,
            imageCount: preparedImages.length,
            extractionLimitations: allExtractionLimitations,
            language,
            studyMetadata: studyMeta,
            intakeSummary,
          })
        : [];

      // ──── CONDITIONAL LITERATURE SEARCH ────
      let literatureCitations: LiteratureCitation[] = [];
      const extractionConfidence = classificationForSynthesis?.confidence ?? 0;
      const extractionKeyFindings = vertexViews
        .map((v) => v.finding.diagnosis || v.finding.findings)
        .filter(Boolean);

      const preliminaryConcern = mapConcernLevel(
        vertexViews[0]?.finding.severity,
        extractionKeyFindings.join(" ")
      );

      const litInput = {
        domainRoute: primaryDomainRoute,
        keyFindings: extractionKeyFindings,
        anatomicalRegion: classificationForSynthesis?.anatomical_region ?? "",
        modality: classificationForSynthesis?.modality ?? "",
        concernLevel: preliminaryConcern,
        confidence: extractionConfidence,
      };

      if (shouldFetchLiterature(litInput)) {
        await sendEvent("status", {
          step: "literature-search",
          message: language === "tr"
            ? "İlgili tıbbi literatür araştırılıyor."
            : "Searching relevant medical literature.",
        });
        await sendProgress(
          "literature",
          84,
          language === "tr"
            ? "Tıbbi literatür taranıyor..."
            : "Searching medical literature..."
        );

        try {
          literatureCitations = await fetchLiterature(litInput);
          if (process.env.NODE_ENV !== "production") {
            console.log(`[analyze] Literature search returned ${literatureCitations.length} citation(s)`);
          }
        } catch (err) {
          console.warn("[analyze] Literature search failed, proceeding without:", err instanceof Error ? err.message : err);
        }
        await sendProgress(
          "literature-done",
          86,
          language === "tr" ? "Literatür adımı tamamlandı" : "Literature step complete"
        );
      }

      // ──── SYNTHESIS (Claude) ────
      logPhase("synthesis-start");
      await sendEvent("status", {
        step: "synthesizing",
        message: language === "tr"
          ? "Bulgular profesyonel rapor haline getiriliyor."
          : "Converting findings into a professional report.",
      });
      await sendProgress(
        "synthesis",
        literatureCitations.length ? 88 : 85,
        language === "tr"
          ? "Profesyonel rapor metni oluşturuluyor..."
          : "Generating professional report text..."
      );

      const routeQuestionHint = getRouteQuestionHints(
        primaryDomainRoute,
        preliminaryConcern,
        language
      );

      const synthesisPayload = {
        uploadType: "screenshot-images",
        fileCount: preparedImages.length,
        imageCount: studyMeta.imageCount,
        analyzedItemCount: vertexViews.length,
        planesAvailable: studyMeta.planesAvailable,
        sourceBranchName: "anthropic-synthesis",
      };
      if (process.env.NODE_ENV !== "production") {
        console.log("[analyze] synthesis input:", JSON.stringify(synthesisPayload, null, 2));
      }

      const synthesisUserMessage = buildSynthesisUserMessage({
        language,
        fileNames: preparedImages.map((img) => img.fileName),
        scholarData,
        extractionResults: vertexViews.map((v) => v.finding),
        classificationResult: classificationForSynthesis,
        additionalDataRequested,
        literatureContext: literatureCitations,
        routeQuestionHint,
        patientContext: clientRoutingContext
          ? {
              domain: clientRoutingContext.domain,
              confidenceLevel: clientRoutingContext.confidenceLevel,
              safetyLevel: clientRoutingContext.safetyLevel,
              reportStyle: clientRoutingContext.reportStyle,
              primaryConcern: clientRoutingContext.primaryConcern,
              bodyRegion: clientRoutingContext.bodyRegion,
              symptomDuration: clientRoutingContext.symptomDuration,
              symptomTrend: clientRoutingContext.symptomTrend,
              studyTimeline: clientRoutingContext.studyTimeline,
              knownDiagnoses: clientRoutingContext.knownDiagnoses,
              chronicConditions: clientRoutingContext.chronicConditions,
            }
          : null,
        isQuickMode: clientRoutingContext?.isQuickMode ?? false,
        studyMetadata: {
          imageCount: studyMeta.imageCount,
          modality: studyMeta.modality,
          anatomicalRegion: studyMeta.anatomicalRegion,
          planesAvailable: studyMeta.planesAvailable,
          localizerPresent: studyMeta.localizerPresent,
          diagnosticImageCount: studyMeta.diagnosticImageCount,
          nonDiagnosticImageCount: studyMeta.nonDiagnosticImageCount,
          studyAdequacy: studyMeta.studyAdequacy,
          seriesGuesses: studyMeta.seriesGuesses,
        },
        crossImageReconciliation: reconciliationBlock,
        intakeSummary: {
          studyAdequacy: intakeSummary.studyAdequacy,
          adequacyTier: intakeSummary.adequacyTier,
          recommendedPipeline: intakeSummary.recommendedPipeline,
          uploadTypesPresent: intakeSummary.uploadTypesPresent,
          diagnosticImageCount: intakeSummary.diagnosticImageCount,
          viewableImageCount: intakeSummary.viewableImageCount,
          localizerCount: intakeSummary.localizerCount,
          reportImageCount: intakeSummary.reportImageCount,
          hasMixedUpload: intakeSummary.hasMixedUpload,
        },
      });

      let finalResult: FinalResponse | null = null;

      try {
        // If quick mode, system prompt instructs Claude
        // to skip personalization sections
        const synthesisSystem = getSynthesisSystemPrompt(language);
        const msg = await anthropic.messages.create({
          model: activeAnthropicModel,
          max_tokens: 4000,
          system: synthesisSystem,
          messages: [{ role: "user", content: synthesisUserMessage }],
        });

        const text = getTextFromAnthropicContent(msg.content);
        const parsed = safeJsonParse<unknown>(text);
        const validated = FinalResponseSchema.safeParse(parsed);

        if (validated.success) {
          finalResult = validated.data;

          const firstExtraction = vertexViews[0]?.finding;
          const isUsable = (v?: string) => !!v && v !== "Unknown" && v !== "unknown";

          if (!isUsable(finalResult.modality)) {
            finalResult.modality =
              (isUsable(firstExtraction?.modality) ? firstExtraction!.modality : undefined) ??
              (isUsable(classificationForSynthesis?.modality) ? classificationForSynthesis!.modality : "") ??
              "";
          }
          if (!isUsable(finalResult.anatomical_region)) {
            finalResult.anatomical_region =
              (isUsable(firstExtraction?.anatomical_region) ? firstExtraction!.anatomical_region : undefined) ??
              (isUsable(classificationForSynthesis?.anatomical_region) ? classificationForSynthesis!.anatomical_region : "") ??
              "";
          }

          // Hard override: certain findings always require urgent review
          if (finalResult) {
            const urgentText = [
              finalResult.summary ?? "",
              ...(finalResult.key_findings ?? []),
              ...(finalResult.report_sections?.detailed_findings ?? []),
              ...(finalResult.report_sections?.interpretive_impression
                ? [finalResult.report_sections.interpretive_impression]
                : []),
            ].join(" ");

            const hasUrgentPattern =
              /ring.?enhanc/i.test(urgentText) ||
              /central necrosis/i.test(urgentText) ||
              /midline shift/i.test(urgentText) ||
              /subfalcine herniation/i.test(urgentText) ||
              /obstructive hydrocephalus/i.test(urgentText) ||
              /acute (subdural|epidural|subarachnoid)/i.test(urgentText) ||
              /herniation/i.test(urgentText) ||
              /\bstroke\b/i.test(urgentText) ||
              /large vessel occlusion/i.test(urgentText) ||
              /tension pneumothorax/i.test(urgentText) ||
              /aortic dissection/i.test(urgentText);

            if (
              hasUrgentPattern &&
              finalResult.concern_level !== "urgent-review"
            ) {
              finalResult.concern_level = "urgent-review";
              if (!finalResult.red_flags) finalResult.red_flags = [];
              if (!finalResult.red_flags.includes("Urgent specialist review required")) {
                finalResult.red_flags.push("Urgent specialist review required");
              }
            }
          }
        } else {
          await sendEvent("log", {
            phase: "anthropic-validation-warning",
            message: validated.error.message,
          });
        }
      } catch (error) {
        await sendEvent("log", {
          phase: "anthropic-warning",
          message: error instanceof Error ? error.message : "Anthropic synthesis failed",
        });
      }

      await sendProgress(
        "synthesis-done",
        94,
        language === "tr" ? "Rapor doğrulanıyor..." : "Validating report..."
      );

      if (!finalResult) {
        finalResult = buildFallbackResponse({
          language,
          fileNames: preparedImages.map((img) => img.fileName),
          vertexViews,
        });
      }

      const allFindingsText = vertexViews.map((v) => v.finding.findings ?? v.finding.diagnosis ?? "").join(" ").toLowerCase();
      const contrastEnhancementPresent = /\b(enhancing|contrast|post.?contrast|gadolinium|kontrast)\b/i.test(allFindingsText);
      const obviousAbnormalityPresent = /\b(mass|lesion|edema|ring.?enhanc|necrotic|abnormal)\b/i.test(allFindingsText);
      applyContradictionGuards(finalResult, {
        imageCount: vertexViews.length,
        planesAvailable: studyMeta.planesAvailable,
        displayUnit: "images",
        contrastEnhancementPresent,
        obviousAbnormalityPresent,
        aggregatedFindingsCount: vertexViews.length,
      });

      // ──── DERIVE CONFIDENCE ASSESSMENT ────
      const confidenceAssessment = deriveConfidenceAssessment({
        classification: classificationForSynthesis,
        imageCount: preparedImages.length,
        domainRoute: primaryDomainRoute,
        language,
        studyMetadata: studyMeta,
        intakeSummary,
      });

      const reportMode = useLimitedReportMode
        ? "LIMITED_INTERPRETATION_REPORT"
        : "FULL_INTERPRETATION_REPORT";

      const reportLabel = {
        reportMode,
        inputTypeAnalyzed:
          language === "tr"
            ? `Tanısal görüntüler (${imagesToProcess.length} dosya)`
            : `Diagnostic images (${imagesToProcess.length} files)`,
        pipelineRan:
          [
            "classification",
            "specialist-extraction",
            reconciliationBlock ? "cross-image-reconciliation" : null,
            literatureCitations.length ? "literature-search" : null,
            "anthropic-synthesis",
          ]
            .filter(Boolean)
            .join(" -> "),
        whatWasActuallyAnalyzed: [
          language === "tr" ? "Görüntü sınıflandırması ve uzman analizi" : "Image classification and specialist analysis",
          language === "tr" ? "Çapraz görüntü karşılaştırması" : "Cross-image reconciliation",
          language === "tr" ? "Sentez raporu" : "Synthesis report",
        ],
        whatCouldNotBeDetermined: [],
        analyzedFileCount: imagesToProcess.length,
        analyzedSliceCount: undefined,
        displayUnit: "images",
        adequacyTier: intakeSummary.adequacyTier ?? "interpretable",
        confidenceTier: intakeSummary.adequacyTier ?? "interpretable",
        totalUploadedCount: preparedImages.length,
        selectedForAnalysisCount: imagesToProcess.length,
        selectionApplied: preparedImages.length > MAX_SLICES_FOR_ANALYSIS,
      };

      // ──── ATTACH SUPPLEMENTARY DATA ────
      const resultWithSupplementary = {
        ...finalResult,
        reportMode,
        reportLabel,
        additional_data_requested: additionalDataRequested.length
          ? additionalDataRequested
          : finalResult.additional_data_requested ?? [],
        literature_support: literatureCitations.length
          ? literatureCitations
          : finalResult.literature_support ?? [],
      };

      const classificationConfidence = classificationForSynthesis?.confidence ?? 0;

      const pipelineSteps = [
        "classification",
        "specialist-extraction",
        reconciliationBlock ? "cross-image-reconciliation" : null,
        literatureCitations.length ? "literature-search" : null,
        "anthropic-synthesis",
      ].filter(Boolean).join(" -> ");

      const successMeta: Record<string, unknown> = {
        fileNames: preparedImages.map((img) => img.fileName),
        processedCount: preparedImages.length,
        successfulVertexAnalyses: vertexViews.length,
        failedVertexAnalyses: vertexErrors,
        pipeline: pipelineSteps,
        confidence: classificationConfidence,
        confidenceAssessment,
        studyMetadata: {
          studyAdequacy: studyMeta.studyAdequacy,
          planesAvailable: studyMeta.planesAvailable,
          diagnosticImageCount: studyMeta.diagnosticImageCount,
          nonDiagnosticImageCount: studyMeta.nonDiagnosticImageCount,
          localizerPresent: studyMeta.localizerPresent,
          seriesGuesses: studyMeta.seriesGuesses,
        },
        intakeSummary: {
          studyAdequacy: intakeSummary.studyAdequacy,
          adequacyTier: intakeSummary.adequacyTier,
          recommendedPipeline: intakeSummary.recommendedPipeline,
          uploadTypesPresent: intakeSummary.uploadTypesPresent,
          diagnosticImageCount: intakeSummary.diagnosticImageCount,
          viewableImageCount: intakeSummary.viewableImageCount,
          localizerCount: intakeSummary.localizerCount,
          reportImageCount: intakeSummary.reportImageCount,
          hasMixedUpload: intakeSummary.hasMixedUpload,
        },
        limitations: classificationForSynthesis?.limitations ?? [],
        domainRoutes: vertexViews.map((v) => ({
          file: v.finding.affected_organ,
          route: v.domainRoute,
          model: v.model,
        })),
      };

      if (process.env.NODE_ENV !== "production") {
        successMeta.debug = {
          vertexSuccessCount: vertexViews.length,
          vertexErrorCount: vertexErrors.length,
          vertexErrors: vertexErrors.map((e) => ({ file: e.fileName, error: e.error })),
          claudeFallbackUsed: false,
          crossImageReconciliationUsed: !!reconciliationBlock,
          literatureSearchTriggered: literatureCitations.length > 0,
          literatureCitationCount: literatureCitations.length,
          additionalDataRequestCount: additionalDataRequested.length,
          perImageClassifications: studyMeta.perImageClassifications.map((p) => ({
            file: p.fileName,
            route: p.domain_route,
            modality: p.modality,
            region: p.anatomical_region,
            plane: p.image_plane,
            isLocalizer: p.is_localizer,
            diagnosticValue: p.diagnostic_value,
            seriesGuess: p.series_type_guess,
            confidence: p.confidence,
          })),
        };
      }

      await sendProgress(
        "complete",
        99,
        language === "tr" ? "Rapor hazır" : "Report ready"
      );
      await sendEvent("result", { ...resultWithSupplementary, meta: successMeta });
      logPhase("complete", { images: imagesToProcess.length, vertexOk: vertexViews.length, vertexFail: vertexErrors.length });
      await sendEvent("trace", {
        uploadId,
        fileCount: preparedImages.length,
        fileTypes: [...new Set(preparedImages.map(p => p.fileName.split(".").pop()?.toLowerCase() || "unknown"))],
        selectedPipeline: tracePipeline,
        selectedDomain: traceDomain,
        startTime: new Date(phaseStart).toISOString(),
        totalDurationMs: Date.now() - phaseStart,
        checkpoints: traceCheckpoints,
        errors: traceErrors,
        finalStatus: "success",
      });
      await sendEvent("done", { success: true });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected server error";
      logError("top-level", "UNHANDLED", message);
      await sendEvent("trace", {
        uploadId,
        startTime: new Date(phaseStart).toISOString(),
        totalDurationMs: Date.now() - phaseStart,
        checkpoints: traceCheckpoints,
        errors: traceErrors,
        finalStatus: "error",
      });
      await sendEvent("error", { message });

      const emergencyResult: FinalResponse = {
        summary: "Analiz tamamlanamadı. Yüklenen içerik işlenirken beklenmeyen bir sorun oluştu.",
        key_findings: [],
        important_terms: [],
        concern_level: "moderate",
        possible_context:
          "Sistem bu isteği güvenli biçimde tamamlayamadı. İçeriğin yeniden yüklenmesi gerekebilir.",
        differential_considerations: [],
        additional_data_requested: [],
        red_flags: [],
        literature_support: [],
        questions_for_doctor: [
          "Bu görüntüyü tekrar değerlendirmem gerekir mi?",
          "Daha uygun bir dosya formatı ile tekrar paylaşmalı mıyım?",
        ],
        follow_up_considerations: [
          "Görüntüyü tekrar yükleme",
          "Gerekirse uzman değerlendirmesi",
        ],
        medical_disclaimer:
          "Bu çıktı bilgilendirme amaçlıdır. Kesin tanı ve tedavi için uzman hekim değerlendirmesi gerekir.",
        modality: "",
        anatomical_region: "",
        professional_report_markdown: "",
        report_sections: {
          plain_summary: "",
          exam_overview: "",
          technical_summary: "",
          detailed_findings: [],
          interpretive_impression: "",
          limitations: [],
          next_steps: [],
        },
      };

      await sendEvent("result", emergencyResult);
    } finally {
      await finalize();
    }
  })();

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
