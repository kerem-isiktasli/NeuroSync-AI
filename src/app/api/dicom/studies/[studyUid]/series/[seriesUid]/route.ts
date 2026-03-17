/**
 * GET /api/dicom/studies/[studyUid]/series/[seriesUid] — Download series as multipart DICOM.
 */
import { NextResponse } from "next/server";
import { downloadSeries } from "@/lib/googleHealthcare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ studyUid: string; seriesUid: string }> }
) {
  const { studyUid, seriesUid } = await params;
  if (!studyUid || !seriesUid) {
    return NextResponse.json(
      { error: "studyUid and seriesUid required" },
      { status: 400 }
    );
  }

  try {
    const buffer = await downloadSeries(studyUid, seriesUid);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "multipart/related; type=application/dicom",
        "Content-Disposition": `attachment; filename="series-${seriesUid.slice(-8)}.multipart"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to download series";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
