/**
 * BullMQ worker: processes `neurosync-analysis` jobs (jobId in Redis payload only).
 *
 * Requires: REDIS_URL, FIREBASE_APPLICATION_CREDENTIALS (same as API for Firestore jobs),
 * Vertex/Anthropic envs for analysis.
 *
 * Concurrency: ANALYSIS_WORKER_CONCURRENCY (default 1) — raise only within Vertex quota.
 */
import { Worker } from "bullmq";
import Redis from "ioredis";
import { ANALYSIS_QUEUE_NAME } from "@/lib/analysisQueue";
import { runDicomAnalysisJob } from "@/lib/runDicomAnalysisJob";

const url = process.env.REDIS_URL?.trim();
if (!url) {
  console.error("[analysis-worker] REDIS_URL is required");
  process.exit(1);
}

const connection = new Redis(url, { maxRetriesPerRequest: null });
const concurrency = Math.max(
  1,
  Math.min(
    32,
    parseInt(process.env.ANALYSIS_WORKER_CONCURRENCY ?? "1", 10) || 1
  )
);

const worker = new Worker(
  ANALYSIS_QUEUE_NAME,
  async (job) => {
    const { jobId } = job.data as { jobId: string };
    if (!jobId) {
      throw new Error("Missing jobId in queue payload");
    }
    await runDicomAnalysisJob(jobId);
  },
  { connection, concurrency }
);

worker.on("completed", (j) => {
  console.log(`[analysis-worker] completed job ${j.id} (analysis ${String(j.data?.jobId ?? "")})`);
});

worker.on("failed", (j, err) => {
  console.error(
    `[analysis-worker] failed job ${j?.id ?? "?"}:`,
    err instanceof Error ? err.message : err
  );
});

async function shutdown() {
  console.log("[analysis-worker] shutting down...");
  await worker.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

console.log(
  `[analysis-worker] listening on ${ANALYSIS_QUEUE_NAME} concurrency=${concurrency}`
);
