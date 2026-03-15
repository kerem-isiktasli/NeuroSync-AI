// src/services/core-bridge.ts
// Unified API Bridge for NeuroSync.ai

import { DiagnosisResult } from "@/types/diagnosis";

/** Backend FinalResponse schema (from /api/analyze) */
type FinalResponse = {
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
  const confidence = typeof data.meta?.confidence === "number" ? data.meta.confidence : 0;

  return {
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
  };
}

function logDataToString(data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "message" in data) {
    return String((data as { message?: string }).message ?? JSON.stringify(data));
  }
  return String(data);
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

  // Call our Next.js API route - handles status, log, result, error events
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
    console.log("[CoreBridge] Calling Analysis Pipeline...");

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64, fileName: file.name }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Analysis failed");
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

  static async generateReport(diagnosisData: DiagnosisResult, docUrl: string): Promise<string> {
    // Return the PDF download link generated by the backend
    return docUrl;
  }

  static async analyzeWithPipelineBatch(
    files: File[],
    imagesBase64: string[],
    callbacks: {
      onLog: (msg: string) => void;
      onClaudeData: (data: FinalResponse) => void;
      onDocStatus: (status: string) => void;
      onDocUrl: (url: string) => void;
    }
  ): Promise<void> {
    console.log("[CoreBridge] Calling Analysis Pipeline - Batch...");

    const payload = {
      images: files.map((f, i) => ({
        imageBase64: imagesBase64[i],
        fileName: f.name,
      })),
    };

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Analysis failed");
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
  }
): Promise<void> {
  console.log("[NeuroSync] Starting Analysis Pipeline...");
  
  // 1. Convert to Base64 (In-Memory)
  const imageBase64 = await CoreBridge.fileToBase64(file);
  
  // 2. Run Pipeline (Streamed)
  await CoreBridge.analyzeWithPipeline(file, imageBase64, {
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
  });

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
  }
): Promise<void> {
  console.log("[NeuroSync] Starting Analysis Pipeline (Batch)...");

  const imagesBase64 = await Promise.all(files.map((f) => CoreBridge.fileToBase64(f)));

  await CoreBridge.analyzeWithPipelineBatch(files, imagesBase64, {
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
  });

  callbacks.onLog(`[SYSTEM] Bellek Temizliği: Görüntü verisi RAM'den silindi.`);
}
