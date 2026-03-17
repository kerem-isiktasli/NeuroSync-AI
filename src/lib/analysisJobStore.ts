/**
 * In-memory analysis job store for async processing.
 * Jobs persist until process restart. For production, use Redis or DB.
 */

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface AnalysisJob {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
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
  /** Extended data for UI (summary, key_findings, etc.) */
  [key: string]: unknown;
}

const jobs = new Map<string, AnalysisJob>();

function generateId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createJob(): AnalysisJob {
  const id = generateId();
  const now = new Date().toISOString();
  const job: AnalysisJob = {
    id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(id, job);
  return job;
}

export function getJob(id: string): AnalysisJob | undefined {
  return jobs.get(id);
}

export function updateJob(
  id: string,
  updates: Partial<Pick<AnalysisJob, "status" | "result" | "error">>
): void {
  const job = jobs.get(id);
  if (!job) return;
  Object.assign(job, updates, { updatedAt: new Date().toISOString() });
}
