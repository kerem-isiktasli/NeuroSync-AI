/**
 * BullMQ + Redis: enqueue DICOM/analysis jobs for out-of-process workers.
 * Set REDIS_URL (e.g. redis://localhost:6379). Without it, jobs run inline via setImmediate.
 *
 * Run workers: `npm run worker:analysis` (see ANALYSIS_WORKER_CONCURRENCY).
 */
import { Queue } from "bullmq";
import Redis from "ioredis";

export const ANALYSIS_QUEUE_NAME = "neurosync-analysis";

let sharedConnection: Redis | null = null;
let sharedQueue: Queue | null = null;

export function isAnalysisQueueEnabled(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

/** Shared ioredis client for BullMQ (required: maxRetriesPerRequest: null). */
export function getQueueConnection(): Redis | null {
  if (!isAnalysisQueueEnabled()) return null;
  if (!sharedConnection) {
    sharedConnection = new Redis(process.env.REDIS_URL!, {
      maxRetriesPerRequest: null,
    });
  }
  return sharedConnection;
}

export function getAnalysisQueue(): Queue | null {
  if (!isAnalysisQueueEnabled()) return null;
  if (!sharedQueue) {
    const connection = getQueueConnection();
    if (!connection) return null;
    sharedQueue = new Queue(ANALYSIS_QUEUE_NAME, { connection });
  }
  return sharedQueue;
}

/** Enqueue jobId only; payload lives in Firestore/memory job store. */
export async function enqueueAnalysisJob(jobId: string): Promise<void> {
  const queue = getAnalysisQueue();
  if (!queue) {
    throw new Error("REDIS_URL is not set; cannot enqueue");
  }
  await queue.add(
    "dicom",
    { jobId },
    {
      removeOnComplete: 1000,
      removeOnFail: 5000,
    }
  );
}

export async function closeAnalysisQueue(): Promise<void> {
  if (sharedQueue) {
    await sharedQueue.close();
    sharedQueue = null;
  }
  if (sharedConnection) {
    await sharedConnection.quit();
    sharedConnection = null;
  }
}
