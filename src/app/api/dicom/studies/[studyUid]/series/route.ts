/**
 * GET /api/dicom/studies/[studyUid]/series — Get series list for a study.
 */
import { NextResponse } from "next/server";
import { getStudySeries } from "@/lib/googleHealthcare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studyUid: string }> }
) {
  const { studyUid } = await params;
  if (!studyUid) {
    return NextResponse.json({ error: "studyUid required" }, { status: 400 });
  }

  try {
    const series = await getStudySeries(studyUid);
    return NextResponse.json(series);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch series";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
