/**
 * GET /api/analyze/jobs/[jobId] — Poll job status and result.
 */
import { NextResponse } from "next/server";
import { getJob } from "@/lib/analysisJobStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const response: Record<string, unknown> = {
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };

  if (job.error) {
    response.error = job.error;
  }

  if (job.status === "completed" && job.result) {
    response.result = job.result;
  }

  return NextResponse.json(response);
}
