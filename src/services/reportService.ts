import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { DiagnosisResult } from "@/types/diagnosis";

export type ReportStatus = "uploaded" | "processing" | "complete" | "failed";

export interface ReportDoc {
  reportId: string;
  userId: string;
  /** LOCALIZER_DETECTED when images were localizer-only; else DIAGNOSTIC. */
  reportType?: "DIAGNOSTIC" | "LOCALIZER_DETECTED";
  /** Standardized report mode (full interpretation, metadata-only, etc.). */
  reportMode?: string;
  title: string;
  fileName: string;
  fileType: string;
  createdAt: string;
  updatedAt: string;
  status: ReportStatus;
  modality: string;
  anatomicalRegion: string;
  concernLevel: string;
  summary: string;
  keyFindings: string[];
  importantTerms: Array<{ term: string; plain_explanation: string }>;
  questionsForDoctor: string[];
  followUpConsiderations: string[];
  medicalDisclaimer: string;
  professionalReportMarkdown: string;
  lastOpenedAt: string;
  errorMessage: string;
  diagnosisResult: DiagnosisResult | null;
}

const COLLECTION = "reports";

function tsToIso(ts: unknown): string {
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === "string") return ts;
  return new Date().toISOString();
}

function docToReport(data: Record<string, unknown>, id: string): ReportDoc {
  return {
    reportId: id,
    userId: (data.userId as string) ?? "",
    reportType: (data.reportType as "DIAGNOSTIC" | "LOCALIZER_DETECTED") ?? (data.diagnosisResult as DiagnosisResult | undefined)?.reportType,
    reportMode: ((data.reportMode as string) ?? (data.diagnosisResult as DiagnosisResult | undefined)?.reportMode) || undefined,
    title: (data.title as string) ?? "",
    fileName: (data.fileName as string) ?? "",
    fileType: (data.fileType as string) ?? "",
    createdAt: tsToIso(data.createdAt),
    updatedAt: tsToIso(data.updatedAt),
    status: (data.status as ReportStatus) ?? "uploaded",
    modality: (data.modality as string) ?? "",
    anatomicalRegion: (data.anatomicalRegion as string) ?? "",
    concernLevel: (data.concernLevel as string) ?? "",
    summary: (data.summary as string) ?? "",
    keyFindings: Array.isArray(data.keyFindings) ? data.keyFindings : [],
    importantTerms: Array.isArray(data.importantTerms) ? data.importantTerms : [],
    questionsForDoctor: Array.isArray(data.questionsForDoctor) ? data.questionsForDoctor : [],
    followUpConsiderations: Array.isArray(data.followUpConsiderations) ? data.followUpConsiderations : [],
    medicalDisclaimer: (data.medicalDisclaimer as string) ?? "",
    professionalReportMarkdown: (data.professionalReportMarkdown as string) ?? "",
    lastOpenedAt: tsToIso(data.lastOpenedAt),
    errorMessage: (data.errorMessage as string) ?? "",
    diagnosisResult: (data.diagnosisResult as DiagnosisResult) ?? null,
  };
}

export async function createReport(
  userId: string,
  fileName: string,
  fileType: string
): Promise<string> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ReportService] createReport called for uid=${userId.slice(0, 8)}..., fileName=${fileName}`);
  }
  const ref = doc(collection(db, COLLECTION));
  const now = serverTimestamp();
  try {
  await setDoc(ref, {
    userId,
    title: fileName,
    fileName,
    fileType,
    createdAt: now,
    updatedAt: now,
    status: "uploaded" as ReportStatus,
    modality: "",
    anatomicalRegion: "",
    concernLevel: "",
    summary: "",
    keyFindings: [],
    importantTerms: [],
    questionsForDoctor: [],
    followUpConsiderations: [],
    medicalDisclaimer: "",
    professionalReportMarkdown: "",
    lastOpenedAt: now,
    errorMessage: "",
    diagnosisResult: null,
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ReportService] createReport succeeded: reportId=${ref.id}`);
  }
  return ref.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    console.error("[ReportService] createReport DENIED:", {
      path: "reports/" + ref.id,
      operation: "setDoc",
      message: msg,
      code: code ?? "unknown",
    });
    if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("insufficient")) {
      console.error("[ReportService] EXACT DENIED PATH: reports/ (create). UserId must match request.auth.uid. Deploy: firebase deploy --only firestore");
    }
    throw err;
  }
}

export async function updateReportStatus(
  reportId: string,
  status: ReportStatus,
  errorMessage?: string
) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ReportService] updateReportStatus: reportId=${reportId}, status=${status}`);
  }
  const ref = doc(db, COLLECTION, reportId);
  const update: Record<string, unknown> = {
    status,
    updatedAt: serverTimestamp(),
  };
  if (errorMessage !== undefined) update.errorMessage = errorMessage;
  try {
    await updateDoc(ref, update);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    console.error("[ReportService] updateReportStatus DENIED:", {
      path: "reports/" + reportId,
      operation: "updateDoc",
      message: msg,
      code: code ?? "unknown",
    });
    throw err;
  }
}

export async function updateReportWithResults(
  reportId: string,
  result: DiagnosisResult
) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ReportService] markComplete called for reportId=${reportId}`);
  }
  const ref = doc(db, COLLECTION, reportId);
  const cleaned = JSON.parse(JSON.stringify(result));
  try {
  await updateDoc(ref, {
    status: "complete" as ReportStatus,
    updatedAt: serverTimestamp(),
    reportType: result.reportType ?? "DIAGNOSTIC",
    ...(result.reportMode !== undefined && { reportMode: result.reportMode }),
    modality: result.modality ?? "",
    anatomicalRegion: result.anatomical_region ?? "",
    concernLevel: result.concern_level ?? "",
    summary: result.diagnosis ?? "",
    keyFindings: result.key_findings ?? [],
    importantTerms: result.important_terms ?? [],
    questionsForDoctor: result.questions_for_doctor ?? [],
    followUpConsiderations: result.follow_up_considerations ?? [],
    medicalDisclaimer: result.medical_disclaimer ?? "",
    professionalReportMarkdown: result.professional_report_markdown ?? "",
    diagnosisResult: cleaned,
  });
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ReportService] markComplete succeeded for reportId=${reportId}`);
  }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string })?.code;
    const lower = msg.toLowerCase();
    if (lower.includes("unsupported field value") || lower.includes("invalid data")) {
      console.error("[ReportService] VALIDATION ERROR - invalid field value, not a permissions issue:", msg);
    } else {
      console.error("[ReportService] markComplete DENIED:", {
        path: "reports/" + reportId,
        operation: "updateDoc",
        message: msg,
        code: code ?? "unknown",
      });
      if (lower.includes("permission") || lower.includes("insufficient")) {
        console.error("[ReportService] EXACT DENIED PATH: reports/" + reportId + " (update). Rule: resource.data.userId == request.auth.uid");
      }
    }
    throw err;
  }
}

export async function updateReportLastOpened(reportId: string) {
  const ref = doc(db, COLLECTION, reportId);
  await updateDoc(ref, { lastOpenedAt: serverTimestamp() });
}

export async function deleteReport(reportId: string) {
  await deleteDoc(doc(db, COLLECTION, reportId));
}

/**
 * Subscribe to user reports. Requires composite index on (userId ASC, updatedAt DESC).
 * Deploy with: firebase deploy --only firestore
 */
export function subscribeToUserReports(
  userId: string,
  onReports: (reports: ReportDoc[]) => void,
  onError?: (err: { code: string; message: string }) => void
): Unsubscribe {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[ReportService] subscribeToUserReports uid=${userId.slice(0, 8)}...`);
  }
  const q = query(
    collection(db, COLLECTION),
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const reports = snapshot.docs.map((d) =>
        docToReport(d.data() as Record<string, unknown>, d.id)
      );
      if (process.env.NODE_ENV !== "production") {
        console.log(`[ReportService] onSnapshot: ${reports.length} reports for uid=${userId.slice(0, 8)}...`);
      }
      onReports(reports);
    },
    (err: { code?: string; message?: string }) => {
      const code = err?.code ?? "unknown";
      const message = err?.message ?? "Firestore read failed";
      console.error("[ReportService] subscribeToUserReports DENIED:", {
        path: "reports (query where userId, orderBy updatedAt)",
        operation: "onSnapshot",
        message,
        code,
      });
      if (message?.toLowerCase().includes("permission") || message?.toLowerCase().includes("insufficient")) {
        console.error("[ReportService] EXACT DENIED PATH: reports collection query. Rule: resource.data.userId == request.auth.uid. Deploy: firebase deploy --only firestore");
      }
      if (message?.toLowerCase().includes("index")) {
        console.error("[ReportService] Composite index required. Deploy: firebase deploy --only firestore:indexes");
      }
      onReports([]);
      onError?.({ code, message });
    }
  );
}
