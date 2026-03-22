/**
 * Analysis jobs: Firestore when Firebase Admin is configured, else in-memory Map.
 * Enables API + BullMQ workers on separate processes to share job state.
 */

import { FieldValue } from "firebase-admin/firestore";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface AnalysisJobPayload {
  images: Array<{ imageBase64: string; fileName: string }>;
  language?: "tr" | "en";
}

export interface AnalysisJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  /** Present until processing completes; omitted from reads after completion when cleared. */
  payload?: AnalysisJobPayload;
  result?: AnalysisJobResult;
  error?: string;
}

/** Standard schema every analysis must return. */
export interface AnalysisJobResult {
  studyMetadata: {
    studyUID: string;
    seriesUID: string;
    modality: string;
    sliceCount: number;
  };
  anatomicalRegion: string;
  vertebraMap: Record<string, number>;
  findingsPerVertebra: Array<{ level: string; finding: string }>;
  finalImpression: string;
  confidenceScore: number;
  [key: string]: unknown;
}

const COLLECTION = "analysis_jobs";

const memoryJobs = new Map<string, AnalysisJob>();

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

async function getFirestoreDb(): Promise<
  import("firebase-admin/firestore").Firestore | null
> {
  if (!process.env.FIREBASE_APPLICATION_CREDENTIALS) return null;
  try {
    const { getAdminFirestore } = await import("@/lib/firebaseAdmin");
    return getAdminFirestore();
  } catch {
    return null;
  }
}

function jobFromFirestoreData(
  id: string,
  data: Record<string, unknown>
): AnalysisJob {
  return {
    id,
    status: data.status as JobStatus,
    createdAt: String(data.createdAt ?? ""),
    updatedAt: String(data.updatedAt ?? ""),
    payload: data.payload as AnalysisJobPayload | undefined,
    result: data.result as AnalysisJobResult | undefined,
    error: data.error as string | undefined,
  };
}

/**
 * Create a job with payload (images). Use with BullMQ or inline processing.
 */
export async function createJobWithPayload(
  payload: AnalysisJobPayload
): Promise<AnalysisJob> {
  const id = generateId();
  const now = new Date().toISOString();
  const job: AnalysisJob = {
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
    payload,
  };

  const db = await getFirestoreDb();
  if (db) {
    await db.collection(COLLECTION).doc(id).set({
      id,
      status: job.status,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      payload,
    });
  } else {
    memoryJobs.set(id, { ...job });
  }
  return job;
}

export async function getJob(id: string): Promise<AnalysisJob | undefined> {
  const db = await getFirestoreDb();
  if (db) {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return undefined;
    return jobFromFirestoreData(id, snap.data()!);
  }
  return memoryJobs.get(id);
}

export async function updateJob(
  id: string,
  updates: Partial<Pick<AnalysisJob, "status" | "result" | "error" | "payload">>
): Promise<void> {
  const now = new Date().toISOString();
  const db = await getFirestoreDb();

  if (db) {
    const docRef = db.collection(COLLECTION).doc(id);
    const patch: Record<string, unknown> = { updatedAt: now };
    if (updates.status !== undefined) patch.status = updates.status;
    if (updates.error !== undefined) patch.error = updates.error;
    if (updates.result !== undefined) patch.result = updates.result;
    if (updates.payload !== undefined) {
      patch.payload = updates.payload;
    }
    if (updates.status === "completed" && updates.result !== undefined) {
      patch.payload = FieldValue.delete();
    }
    await docRef.set(patch, { merge: true });
    return;
  }

  const job = memoryJobs.get(id);
  if (!job) return;
  Object.assign(job, updates, { updatedAt: now });
  if (updates.status === "completed" && updates.result !== undefined) {
    delete job.payload;
  }
}
