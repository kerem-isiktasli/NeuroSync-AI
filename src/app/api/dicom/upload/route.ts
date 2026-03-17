/**
 * DICOM Upload API — UI → backend → Healthcare API → DICOM store.
 *
 * POST /api/dicom/upload
 * Content-Type: multipart/form-data with DICOM files
 */
import { NextResponse } from "next/server";
import { uploadDicomStudy } from "@/lib/googleHealthcare";
import { isDicomBuffer } from "@/lib/dicom";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { MAX_DICOM_FILES, MAX_STUDY_SIZE_BYTES } from "@/lib/dicom";

const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB per file

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const entries = Array.from(formData.entries()).filter(
      ([, v]) => v instanceof File
    ) as Array<[string, File]>;

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No DICOM files provided. Use multipart/form-data with file fields." },
        { status: 400 }
      );
    }

    if (entries.length > MAX_DICOM_FILES) {
      return NextResponse.json(
        { error: `Too many files. Maximum ${MAX_DICOM_FILES} files per upload.` },
        { status: 400 }
      );
    }

    const files: Array<{ buffer: Buffer; fileName?: string }> = [];
    let totalBytes = 0;

    for (const [, file] of entries) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: `File ${file.name} exceeds ${MAX_FILE_BYTES / 1024 / 1024}MB limit.` },
          { status: 400 }
        );
      }
      totalBytes += file.size;
      if (totalBytes > MAX_STUDY_SIZE_BYTES) {
        return NextResponse.json(
          {
            error: `Study size would exceed ${MAX_STUDY_SIZE_BYTES / (1024 * 1024 * 1024)}GB limit.`,
          },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!isDicomBuffer(buffer)) {
        return NextResponse.json(
          { error: `File ${file.name} is not a valid DICOM Part 10 file.` },
          { status: 400 }
        );
      }

      files.push({ buffer, fileName: file.name });
    }

    const result = await uploadDicomStudy(files);

    return NextResponse.json({
      success: true,
      studyUid: result.studyUid,
      seriesUids: result.seriesUids,
      instanceCount: result.instanceCount,
      retrieveUrl: result.retrieveUrl,
      message: `Uploaded ${result.instanceCount} instance(s) to study ${result.studyUid}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    console.error("[dicom/upload]", message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
