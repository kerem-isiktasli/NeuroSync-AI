/**
 * POST /api/analyze/jobs — Create async analysis job.
 * Returns 202 with jobId.
 *
 * If REDIS_URL is set: job is enqueued for BullMQ workers (`npm run worker:analysis`).
 * Otherwise: processing runs in-process via setImmediate (dev / single-node).
 *
 * Job state + payload: Firestore `analysis_jobs` when FIREBASE_APPLICATION_CREDENTIALS is set,
 * else in-memory (lost on restart; workers must share Firestore for multi-process).
 */
import { NextResponse } from "next/server";
import { createJobWithPayload } from "@/lib/analysisJobStore";
import { enqueueAnalysisJob, isAnalysisQueueEnabled } from "@/lib/analysisQueue";
import { runDicomAnalysisJob } from "@/lib/runDicomAnalysisJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGES = 500;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const images = Array.isArray(body?.images)
      ? body.images
      : body?.imageBase64
        ? [{ imageBase64: body.imageBase64, fileName: body.fileName || "Image" }]
        : [];

    if (!images.length) {
      return NextResponse.json(
        { error: "No images provided. Send images array or imageBase64." },
        { status: 400 }
      );
    }

    if (images.length > MAX_IMAGES) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IMAGES} files per job.` },
        { status: 400 }
      );
    }

    const languageRaw = body.language || "en";
    const language = languageRaw === "tr" ? "tr" : "en";

    const job = await createJobWithPayload({
      images,
      language,
    });

    if (isAnalysisQueueEnabled()) {
      if (!process.env.FIREBASE_APPLICATION_CREDENTIALS?.trim()) {
        return NextResponse.json(
          {
            error:
              "REDIS_URL is set but FIREBASE_APPLICATION_CREDENTIALS is missing. " +
              "Workers run in separate processes and need Firestore to load job payloads.",
          },
          { status: 503 }
        );
      }
      await enqueueAnalysisJob(job.id);
    } else {
      setImmediate(() => {
        void runDicomAnalysisJob(job.id);
      });
    }

    return NextResponse.json(
      { jobId: job.id, status: "pending" },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
