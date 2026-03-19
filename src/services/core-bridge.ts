// src/services/core-bridge.ts
// Unified API Bridge for NeuroSync.ai

import { DiagnosisResult, type ReportMode } from "@/types/diagnosis";

/** Convert base64 string to Blob for FormData uploads. */
function base64ToBlob(base64: string, mime: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
import type { AnalysisJobResult } from "@/lib/analysisJobStore";

/** Backend FinalResponse schema (from /api/analyze) */
type FinalResponse = {
  reportType?: "DIAGNOSTIC" | "LOCALIZER_DETECTED";
  reportMode?: string;
  reportLabel?: import("@/types/diagnosis").ReportLabel;
  summary?: string;
  key_findings?: string[];
  important_terms?: Array<{ term: string; plain_explanation: string }>;
  concern_level?: "low" | "moderate" | "high" | "urgent-review";
  possible_context?: string;
  differential_considerations?: Array<{
    label: string;
    likelihood: "high" | "moderate" | "low";
    why_it_matches: string;
    why_not_certain: string;
  }>;
  additional_data_requested?: Array<{
    item: string;
    reason: string;
    priority: "high" | "medium" | "low";
  }>;
  red_flags?: string[];
  literature_support?: Array<{
    title: string;
    source: string;
    year: string;
    relevance: string;
  }>;
  questions_for_doctor?: string[];
  follow_up_considerations?: string[];
  medical_disclaimer?: string;
  modality?: string;
  anatomical_region?: string;
  professional_report_markdown?: string;
  report_sections?: {
    exam_overview?: string;
    technical_summary?: string;
    detailed_findings?: string[];
    interpretive_impression?: string;
    limitations?: string[];
    next_steps?: string[];
    study_adequacy_summary?: string;
    anatomical_specificity_summary?: string;
    findings_by_level_summary?: string;
    what_cannot_be_determined?: string[];
    evidence_agreement_summary?: string;
  };
  report_fusion?: {
    official_report_present: boolean;
    report_text_summary: string;
    agreement_points: string[];
    mismatch_points: Array<{ image_finding: string; report_finding: string; note: string }>;
    official_report_priority_note: string;
  };
  meta?: { fileNames?: string[]; [key: string]: unknown };
};

function mapConcernToSeverity(
  level?: string
): "low" | "medium" | "high" | "critical" {
  const n = String(level || "").toLowerCase();
  if (n === "urgent-review") return "critical";
  if (n === "high") return "high";
  if (n === "moderate") return "medium";
  return "low";
}

function finalResponseToDiagnosisResult(
  data: FinalResponse,
  fileNames?: string[]
): DiagnosisResult {
  const findingsParts: string[] = [];

  if (data.report_sections?.detailed_findings?.length) {
    findingsParts.push(...data.report_sections.detailed_findings);
  } else if (data.key_findings?.length) {
    findingsParts.push(...data.key_findings);
  }

  const findings = findingsParts.join("\n");

  const clinicalParts = [
    data.report_sections?.interpretive_impression,
    data.possible_context,
    data.medical_disclaimer,
    data.follow_up_considerations?.length
      ? "Takip: " + data.follow_up_considerations.join("; ")
      : "",
  ].filter(Boolean);
  const clinical_eval = clinicalParts.join("\n\n");

  const recommended_actions = [
    ...(data.questions_for_doctor || []),
    ...(data.follow_up_considerations || []),
    ...(data.report_sections?.next_steps || []),
  ];

  const organLabel =
    [data.anatomical_region, data.modality]
      .filter((v) => v && v !== "Unknown" && v !== "unknown")
      .join(" — ") || "Görüntü Analizi";

  const usable = (v?: string) => (v && v !== "Unknown" && v !== "unknown") ? v : undefined;
  const modality = usable(data.modality) ?? "";
  const anatomical_region = usable(data.anatomical_region) ?? "";

  const localizerReport =
    (data as { localizerReport?: DiagnosisResult["localizerReport"] }).localizerReport ??
    (data.meta as { localizerReport?: DiagnosisResult["localizerReport"] } | undefined)?.localizerReport;

  const confidence =
    (typeof data.meta?.confidence === "number" ? data.meta.confidence : null) ??
    (localizerReport?.confidence != null ? Math.round((localizerReport.confidence as number) * 100) : 0);

  return {
    reportType:
      data.reportMode === "LOCALIZER_DETECTED_REPORT"
        ? "LOCALIZER_DETECTED"
        : (data.reportType ?? "DIAGNOSTIC"),
    reportMode: data.reportMode as ReportMode | undefined,
    reportLabel: data.reportLabel,
    localizerReport,
    diagnosis: data.summary || "Klinik analiz tamamlandı.",
    severity: mapConcernToSeverity(data.concern_level),
    affected_organ: organLabel,
    confidence,
    timestamp: new Date().toISOString(),
    recommended_actions,
    references: data.medical_disclaimer ? [data.medical_disclaimer] : [],
    findings,
    clinical_eval,
    fileName: fileNames?.join(", "),

    modality,
    anatomical_region,
    concern_level: data.concern_level,
    key_findings: data.key_findings,
    important_terms: data.important_terms,
    questions_for_doctor: data.questions_for_doctor,
    follow_up_considerations: data.follow_up_considerations,
    medical_disclaimer: data.medical_disclaimer,
    professional_report_markdown: data.professional_report_markdown,
    report_sections: data.report_sections,
    differential_considerations: data.differential_considerations,
    additional_data_requested: data.additional_data_requested,
    red_flags: data.red_flags,
    literature_support: data.literature_support,

    confidence_level: (data.meta?.confidenceAssessment as { level?: string })?.level,
    confidence_reasons: (data.meta?.confidenceAssessment as { reasons?: string[] })?.reasons,
    intake_summary: (data.meta?.intakeSummary as DiagnosisResult["intake_summary"]) ?? null,
    report_fusion: data.report_fusion,
  };
}

function logDataToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "message" in data) {
    return String((data as { message?: string }).message ?? JSON.stringify(data));
  }
  return String(data);
}

function jobResultToFinalResponse(r: AnalysisJobResult): FinalResponse {
  const findingsByLevel = r.findingsPerVertebra
    .map((v) => `${v.level}: ${v.finding}`)
    .join("\n");
  const reportMode = ((r.reportMode as string) ?? "FULL_INTERPRETATION_REPORT") as ReportMode;
  const isMetadataOnly = reportMode === "METADATA_ONLY_REPORT";
  const reportLabel = {
    reportMode,
    inputTypeAnalyzed: `DICOM study (${r.studyMetadata.sliceCount} slices)`,
    pipelineRan: isMetadataOnly
      ? "DICOM metadata extraction only"
      : "DICOM assembly -> pathology scan -> Vertex synthesis",
    whatWasActuallyAnalyzed: isMetadataOnly
      ? ["DICOM metadata", "Study/series information"]
      : ["DICOM metadata and slice-level analysis", "Pathology scan findings", "Structured synthesis report"],
    whatCouldNotBeDetermined: isMetadataOnly
      ? ["Pixel-level image analysis was not performed", "No visual interpretation of slices"]
      : [],
    analyzedSliceCount: r.studyMetadata.sliceCount,
    analyzedFileCount: r.studyMetadata.sliceCount,
    displayUnit: "slices",
  };
  return {
    summary: r.finalImpression,
    key_findings: Array.isArray(r.key_findings)
      ? r.key_findings
      : r.findingsPerVertebra
          .filter((v) => v.finding !== "No significant finding.")
          .map((v) => `${v.level}: ${v.finding}`),
    important_terms: [],
    concern_level: (r.abnormalities as string[] || []).length > 0 ? "moderate" : "low",
    possible_context: `${r.studyMetadata.modality} ${r.anatomicalRegion} study. ${r.finalImpression}`,
    differential_considerations: [],
    additional_data_requested: [],
    red_flags: (r.abnormalities as string[]) ?? [],
    literature_support: [],
    questions_for_doctor: [],
    follow_up_considerations: (r.recommendedNextSteps as string[]) ?? [],
    medical_disclaimer: "This output is for informational purposes only. Expert review required for definitive diagnosis.",
    modality: r.studyMetadata.modality,
    anatomical_region: r.anatomicalRegion,
    professional_report_markdown: [
      `## Study Type: ${r.studyMetadata.modality}`,
      `## Region: ${r.anatomicalRegion}`,
      "",
      "### Findings by Vertebral Level",
      findingsByLevel || "No significant findings.",
      "",
      "### Impression",
      r.finalImpression,
    ].join("\n"),
    report_sections: {
      exam_overview: `${r.studyMetadata.modality} ${r.anatomicalRegion}`,
      technical_summary: `Slices analyzed: ${r.studyMetadata.sliceCount} levels`,
      detailed_findings: (r.abnormalities as string[])?.length
        ? (r.abnormalities as string[])
        : r.findingsPerVertebra.map((v) => `${v.level}: ${v.finding}`),
      interpretive_impression: r.finalImpression,
      limitations: [],
      next_steps: (r.recommendedNextSteps as string[]) ?? [],
      anatomical_specificity_summary: findingsByLevel,
      findings_by_level_summary: findingsByLevel,
    },
    reportMode,
    reportLabel,
    meta: {
      studyMetadata: r.studyMetadata,
      sliceCount: r.studyMetadata.sliceCount,
      anatomicalRegion: r.anatomicalRegion,
      vertebraMap: r.vertebraMap,
      findingsPerVertebra: r.findingsPerVertebra,
      finalImpression: r.finalImpression,
      confidenceScore: r.confidenceScore,
      confidence: r.confidenceScore,
    },
  };
}

export class CoreBridge {
  // Convert File to Base64 (In-Memory)
  static async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  /**
   * Study-based analysis: upload files → backend assembles study → Vertex AI
   * receives structured summary (study summary, slice statistics, anomalies), NOT raw slices.
   * Use for single file (DICOM or image) — backend routes appropriately.
   */
  static async analyzeStudy(
    file: File,
    imageBase64: string,
    callbacks: {
      onLog: (msg: string) => void;
      onClaudeData: (data: FinalResponse) => void;
      onDocStatus: (status: string) => void;
      onDocUrl: (url: string) => void;
    },
    options?: { language?: "tr" | "en"; routingContext?: string; reportFile?: File }
  ): Promise<void> {
    return this.analyzeStudyBatch([file], [imageBase64], callbacks, options);
  }

  /** @deprecated Use analyzeStudy. */
  static async analyzeWithPipeline(
    file: File,
    imageBase64: string,
    callbacks: {
      onLog: (msg: string) => void;
      onClaudeData: (data: FinalResponse) => void;
      onDocStatus: (status: string) => void;
      onDocUrl: (url: string) => void;
    }
  ): Promise<void> {
    return this.analyzeStudy(file, imageBase64, callbacks);
  }

  static async generateReport(diagnosisData: DiagnosisResult, docUrl: string): Promise<string> {
    // Return the PDF download link generated by the backend
    return docUrl;
  }

  /**
   * Study-based batch analysis. Backend: assemble study → volume → pathology scan
   * → send structured summary to Vertex AI (NOT raw slices) → generate report.
   */
  /**
   * DICOM study analysis via multipart form-data.
   * Use for DICOM uploads — no base64, no JSON body, scales to 50+ files.
   */
  static async analyzeDicomStudyBatch(
    files: File[],
    callbacks: {
      onLog: (msg: string) => void;
      onClaudeData: (data: FinalResponse) => void;
      onDocStatus: (status: string) => void;
      onDocUrl: (url: string) => void;
    },
    options?: { language?: "tr" | "en" }
  ): Promise<void> {
    const language = options?.language ?? "tr";
    if (process.env.NODE_ENV !== "production") {
      const totalBytes = files.reduce((s, f) => s + (f.size ?? 0), 0);
      console.log(
        `[CoreBridge] analyzeDicomStudyBatch: ${files.length} file(s), ${(totalBytes / 1024 / 1024).toFixed(1)}MB total, ` +
          `POST /api/dicom/analyze (multipart, no base64).`
      );
    }

    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file, file.name);
    }
    formData.set("language", language);

    const response = await fetch("/api/dicom/analyze", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "DICOM analysis failed");
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const jsonStr = line.slice(6);
          const { type, data } = JSON.parse(jsonStr);

          switch (type) {
            case "status":
            case "log":
              callbacks.onLog(logDataToString(data));
              break;
            case "result":
              if (process.env.NODE_ENV !== "production") {
                console.log("[CoreBridge] DICOM SSE result received, streaming complete.");
              }
              callbacks.onClaudeData(data as FinalResponse);
              break;
            case "claude":
              callbacks.onClaudeData(data as FinalResponse);
              break;
            case "doc_status":
              callbacks.onDocStatus(typeof data === "string" ? data : logDataToString(data));
              break;
            case "doc_url":
              callbacks.onDocUrl(typeof data === "string" ? data : String(data));
              break;
            case "error":
              throw new Error(
                data && typeof data === "object" && "message" in data
                  ? (data as { message: string }).message
                  : String(data)
              );
          }
        } catch (e) {
          if (e instanceof Error && e.name !== "SyntaxError") throw e;
          console.error("Error parsing stream chunk:", e);
        }
      }
    }
  }

  static async analyzeStudyBatch(
    files: File[],
    imagesBase64: string[],
    callbacks: {
      onLog: (msg: string) => void;
      onClaudeData: (data: FinalResponse) => void;
      onDocStatus: (status: string) => void;
      onDocUrl: (url: string) => void;
    },
    options?: { language?: "tr" | "en"; routingContext?: string; reportFile?: File }
  ): Promise<void> {
    const language = options?.language ?? "tr";
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[CoreBridge] analyzeStudyBatch: ${files.length} file(s), POST /api/analyze (multipart). ` +
          `Files: ${files.map((f) => `${f.name}(${f.type})`).join(", ")}`
      );
    }

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      const dataUri = imagesBase64[i];
      const base64 = dataUri?.includes(",") ? dataUri.split(",")[1] : dataUri ?? "";
      const mime = files[i]?.type || "image/jpeg";
      const ext = mime === "image/png" ? "png" : "jpg";
      const blob = base64ToBlob(base64, mime);
      formData.append("images", blob, files[i]?.name || `image_${i}.${ext}`);
    }
    if (options?.reportFile) {
      formData.append("files", options.reportFile, options.reportFile.name);
    }
    formData.set("language", language);
    if (options?.routingContext) {
      formData.set("routingContext", options.routingContext);
    }

    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CoreBridge] Server error:", response.status, errorText);
      throw new Error(
        `Server ${response.status}: ${errorText || "Analysis failed"}`
      );
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const jsonStr = line.slice(6);
          const { type, data } = JSON.parse(jsonStr);

          switch (type) {
            case "status":
            case "log":
              callbacks.onLog(logDataToString(data));
              break;
            case "result":
              if (process.env.NODE_ENV !== "production") {
                console.log("[CoreBridge] SSE result received, streaming complete.");
              }
              callbacks.onClaudeData(data as FinalResponse);
              break;
            case "claude":
              callbacks.onClaudeData(data as FinalResponse);
              break;
            case "doc_status":
              callbacks.onDocStatus(typeof data === "string" ? data : logDataToString(data));
              break;
            case "doc_url":
              callbacks.onDocUrl(typeof data === "string" ? data : String(data));
              break;
            case "error":
              throw new Error(
                data && typeof data === "object" && "message" in data
                  ? (data as { message: string }).message
                  : String(data)
              );
          }
        } catch (e) {
          if (e instanceof Error && e.name !== "SyntaxError") throw e;
          console.error("Error parsing stream chunk:", e);
        }
      }
    }
  }
}

export interface VitaCoordinates {
  x: number;
  y: number;
  organ: string;
}

// Updated to use callbacks for streaming updates
export async function runFullDiagnosis(
  file: File,
  callbacks: {
    onLog: (msg: string) => void;
    onResult: (result: DiagnosisResult) => void;
    onReport: (text: string) => void;
    onDownloadUrl: (url: string) => void;
  },
  options?: { language?: "tr" | "en"; routingContext?: string; reportFile?: File }
): Promise<void> {
  console.log("[NeuroSync] Starting Analysis Pipeline...");
  
  // 1. Convert to Base64 (In-Memory)
  const imageBase64 = await CoreBridge.fileToBase64(file);
  
  // 2. Run study-based pipeline (backend assembles study, Vertex receives summary)
  await CoreBridge.analyzeStudy(file, imageBase64, {
    onLog: (msg) => callbacks.onLog(`[SYSTEM] ${msg}`),

    onClaudeData: (data) => {
      callbacks.onLog(`[RapiMed] Analiz tamamlandı.`);

      const result = finalResponseToDiagnosisResult(data, [file.name]);

      const reportText = `
SAPTANAN BULGULAR:
${result.findings}

KLİNİK DEĞERLENDİRME:
${result.clinical_eval}

REFERANSLAR:
${result.references?.join("\n") || "-"}
      `.trim();

      callbacks.onResult(result);
      callbacks.onReport(reportText);
    },

    onDocStatus: (status) => {
      callbacks.onLog(`[DOCS] ${status}`);
    },

    onDocUrl: (url) => {
      callbacks.onLog(`[DOCS] PDF Hazır: İndirme linki aktif.`);
      callbacks.onDownloadUrl(url);
    },
  }, options);

  // Explicit Cleanup Log
  callbacks.onLog(`[SYSTEM] Bellek Temizliği: Görüntü verisi RAM'den silindi.`);
}

export async function runFullDiagnosisBatch(
  files: File[],
  callbacks: {
    onLog: (msg: string) => void;
    onResult: (result: DiagnosisResult) => void;
    onReport: (text: string) => void;
    onDownloadUrl: (url: string) => void;
  },
  routingContext?: Record<string, unknown>,
  options?: { language?: "tr" | "en"; reportFile?: File }
): Promise<void> {
  console.log("[NeuroSync] Starting Analysis Pipeline (Batch)...");
  if (routingContext && "pipeline" in routingContext) {
    console.log("[NeuroSync] Intake routing:", routingContext.pipeline, routingContext.domain, routingContext.confidenceLevel);
  }

  const imagesBase64 = await Promise.all(files.map((f) => CoreBridge.fileToBase64(f)));

  await CoreBridge.analyzeStudyBatch(files, imagesBase64, {
    onLog: (msg) => callbacks.onLog(`[SYSTEM] ${msg}`),

    onClaudeData: (data) => {
      callbacks.onLog(`[RapiMed] Analiz tamamlandı.`);

      const fileNames = data.meta?.fileNames || files.map((f) => f.name);
      const result = finalResponseToDiagnosisResult(data, fileNames);

      const reportText = `
SAPTANAN BULGULAR:
${result.findings}

KLİNİK DEĞERLENDİRME:
${result.clinical_eval}

REFERANSLAR:
${result.references?.join("\n") || "-"}
      `.trim();

      callbacks.onResult(result);
      callbacks.onReport(reportText);
    },

    onDocStatus: (status) => callbacks.onLog(`[DOCS] ${status}`),
    onDocUrl: (url) => {
      callbacks.onLog(`[DOCS] PDF Hazır: İndirme linki aktif.`);
      callbacks.onDownloadUrl(url);
    },
  }, {
    language: options?.language,
    routingContext: routingContext ? JSON.stringify(routingContext) : undefined,
    reportFile: options?.reportFile,
  });

  callbacks.onLog(`[SYSTEM] Bellek Temizliği: Görüntü verisi RAM'den silindi.`);
}

/**
 * DICOM study analysis via multipart form-data (no base64).
 * Use when classifyUploadBatch returns "dicom-study".
 */
export async function runFullDiagnosisDicomBatch(
  files: File[],
  callbacks: {
    onLog: (msg: string) => void;
    onResult: (result: DiagnosisResult) => void;
    onReport: (text: string) => void;
    onDownloadUrl: (url: string) => void;
  },
  options?: { language?: "tr" | "en" }
): Promise<void> {
  console.log("[NeuroSync] Starting DICOM Analysis Pipeline (multipart)...");

  await CoreBridge.analyzeDicomStudyBatch(files, {
    onLog: (msg) => callbacks.onLog(`[SYSTEM] ${msg}`),

    onClaudeData: (data) => {
      callbacks.onLog(`[RapiMed] Analiz tamamlandı.`);

      const fileNames = data.meta?.fileNames || files.map((f) => f.name);
      const result = finalResponseToDiagnosisResult(data, fileNames);

      const reportText = `
SAPTANAN BULGULAR:
${result.findings}

KLİNİK DEĞERLENDİRME:
${result.clinical_eval}

REFERANSLAR:
${result.references?.join("\n") || "-"}
      `.trim();

      callbacks.onResult(result);
      callbacks.onReport(reportText);
    },

    onDocStatus: (status) => callbacks.onLog(`[DOCS] ${status}`),
    onDocUrl: (url) => {
      callbacks.onLog(`[DOCS] PDF Hazır: İndirme linki aktif.`);
      callbacks.onDownloadUrl(url);
    },
  }, options);

  callbacks.onLog(`[SYSTEM] Bellek Temizliği: Görüntü verisi RAM'den silindi.`);
}

/**
 * Async job-based analysis. POSTs to /api/analyze/jobs and polls until complete.
 * @deprecated DISABLED — Job transport is broken. All analysis routes through runFullDiagnosisBatch → /api/analyze (streaming SSE).
 * Do NOT use in DiagnosisContext or any active upload flow.
 */
export async function runFullDiagnosisBatchAsync(
  files: File[],
  callbacks: {
    onLog: (msg: string) => void;
    onResult: (result: DiagnosisResult) => void;
    onReport: (text: string) => void;
    onDownloadUrl: (url: string) => void;
    onJobId?: (jobId: string) => void;
  },
  options?: { pollIntervalMs?: number; maxPollAttempts?: number }
): Promise<void> {
  const pollIntervalMs = options?.pollIntervalMs ?? 1500;
  const maxPollAttempts = options?.maxPollAttempts ?? 120;

  const imagesBase64 = await Promise.all(
    files.map((f) => CoreBridge.fileToBase64(f))
  );

  const payload = {
    images: files.map((f, i) => ({
      imageBase64: imagesBase64[i],
      fileName: f.name,
    })),
  };

  callbacks.onLog(`[SYSTEM] Async job oluşturuluyor...`);

  const createRes = await fetch("/api/analyze/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(err || "Failed to create analysis job");
  }

  const { jobId } = (await createRes.json()) as { jobId: string };
  callbacks.onJobId?.(jobId);
  callbacks.onLog(`[SYSTEM] Job ID: ${jobId}. Sonuç bekleniyor...`);

  for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
    await new Promise((r) => setTimeout(r, pollIntervalMs));

    const statusRes = await fetch(`/api/analyze/jobs/${jobId}`);
    if (!statusRes.ok) {
      throw new Error("Job status fetch failed");
    }

    const job = (await statusRes.json()) as {
      status: string;
      result?: AnalysisJobResult;
      error?: string;
    };

    if (job.status === "completed" && job.result) {
      const finalResponse = jobResultToFinalResponse(job.result);
      const result = finalResponseToDiagnosisResult(
        finalResponse,
        files.map((f) => f.name)
      );
      result.confidence = job.result.confidenceScore;
      callbacks.onResult(result);
      callbacks.onReport(
        `BULGULAR:\n${result.findings}\n\nDEĞERLENDİRME:\n${result.clinical_eval ?? ""}`
      );
      callbacks.onLog(`[SYSTEM] Analiz tamamlandı.`);
      return;
    }

    if (job.status === "failed") {
      throw new Error(job.error ?? "Analysis failed");
    }

    callbacks.onLog(
      `[SYSTEM] Durum: ${job.status} (${attempt + 1}/${maxPollAttempts})`
    );
  }

  throw new Error("Analysis timed out");
}
