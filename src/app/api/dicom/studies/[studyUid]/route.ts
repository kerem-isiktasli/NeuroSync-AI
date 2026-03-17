/**
 * GET /api/dicom/studies/[studyUid] — Get study metadata.
 */
import { NextResponse } from "next/server";
import { getStudyMetadata } from "@/lib/googleHealthcare";

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
    const metadata = await getStudyMetadata(studyUid);
    if (!metadata) {
      return NextResponse.json({ error: "Study not found" }, { status: 404 });
    }
    return NextResponse.json(metadata);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch study";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
