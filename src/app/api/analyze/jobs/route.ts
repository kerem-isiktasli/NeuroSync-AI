/**
 * POST /api/analyze/jobs — Create async analysis job.
 * Returns 202 with jobId. Processing runs in background.
 */
import { NextResponse } from "next/server";
import { createJob } from "@/lib/analysisJobStore";
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

    const job = createJob();

    setImmediate(() => {
      void runDicomAnalysisJob(job.id, {
        images,
        language: body.language || "en",
      });
    });

    return NextResponse.json(
      { jobId: job.id, status: "pending" },
      { status: 202 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
