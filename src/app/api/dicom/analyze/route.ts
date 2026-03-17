/**
 * DICOM Analyze API — Multipart form-data upload + SSE stream.
 *
 * POST /api/dicom/analyze
 * Content-Type: multipart/form-data
 * Fields: files (or files[]), language (optional, default "tr"), scholarData (optional)
 *
 * Returns: SSE stream (data: {type, data}) same format as /api/analyze
 */
import { NextResponse } from "next/server";
import {
  isDicomBuffer,
  MAX_DICOM_FILES,
  MAX_STUDY_SIZE_BYTES,
} from "@/lib/dicom";
import { runDicomAnalysisPipeline } from "@/lib/dicomAnalysisPipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Allow long-running DICOM studies (50+ files) — Vercel Pro: 300s, Hobby: 60s. */
export const maxDuration = 300;

function parseLanguage(value: FormDataEntryValue | null): "tr" | "en" {
  if (typeof value !== "string") return "tr";
  const v = value.toLowerCase().trim();
  return v === "en" ? "en" : "tr";
}

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (type: string, data: unknown) => {
    await writer.write(
      encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`)
    );
  };

  const finalize = async () => {
    try {
      await writer.close();
    } catch {
      /* no-op */
    }
  };

  (async () => {
    try {
      const formData = await req.formData();

      const language = parseLanguage(formData.get("language"));
      const scholarData = (formData.get("scholarData") as string | null) ?? "";

      const files: File[] = [];
      const filesEntry = formData.getAll("files");
      const filesArrayEntry = formData.getAll("files[]");
      const allFileEntries = [...filesEntry, ...filesArrayEntry].filter(
        (v): v is File => v instanceof File
      );
      files.push(...allFileEntries);

      if (files.length === 0) {
        await sendEvent("error", {
          message:
            language === "tr"
              ? "DICOM dosyası bulunamadı."
              : "No DICOM files provided.",
        });
        await sendEvent("done", { success: false });
        return;
      }

      if (files.length > MAX_DICOM_FILES) {
        await sendEvent("error", {
          message:
            language === "tr"
              ? `Maksimum ${MAX_DICOM_FILES} dosya desteklenir.`
              : `Maximum ${MAX_DICOM_FILES} files supported.`,
        });
        await sendEvent("done", { success: false });
        return;
      }

      const dicomFiles: Array<{ buffer: Buffer; fileName: string }> = [];
      let totalBytes = 0;

      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        totalBytes += buffer.byteLength;

        if (totalBytes > MAX_STUDY_SIZE_BYTES) {
          await sendEvent("error", {
            message:
              language === "tr"
                ? `Çalışma boyutu ${(MAX_STUDY_SIZE_BYTES / (1024 * 1024 * 1024)).toFixed(0)}GB limitini aşıyor.`
                : `Study size exceeds ${MAX_STUDY_SIZE_BYTES / (1024 * 1024 * 1024)}GB limit.`,
          });
          await sendEvent("done", { success: false });
          return;
        }

        if (!isDicomBuffer(buffer)) {
          await sendEvent("error", {
            message:
              language === "tr"
                ? `Dosya geçerli DICOM değil: ${file.name}`
                : `File is not valid DICOM: ${file.name}`,
          });
          await sendEvent("done", { success: false });
          return;
        }

        dicomFiles.push({
          buffer,
          fileName: file.name || `file_${dicomFiles.length}.dcm`,
        });
      }

      if (dicomFiles.length === 0) {
        await sendEvent("error", {
          message:
            language === "tr"
              ? "Geçerli DICOM dosyası bulunamadı."
              : "No valid DICOM files found.",
        });
        await sendEvent("done", { success: false });
        return;
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[dicom/analyze] payload size=${totalBytes}, fileCount=${dicomFiles.length}, path=dicom-multipart, scholarData=${scholarData ? "present" : "absent"}`
        );
      }

      await sendEvent("status", {
        step: "received",
        message:
          language === "tr"
            ? "Görüntüler alındı."
            : "Images received successfully.",
      });

      try {
        const { result, meta } = await runDicomAnalysisPipeline({
          dicomFiles,
          language,
          sendEvent,
        });

        await sendEvent("result", { ...result, meta });
        await sendEvent("done", { success: true });
      } catch (dicomErr) {
        const msg =
          dicomErr instanceof Error
            ? dicomErr.message
            : "DICOM pipeline failed";
        console.error("[dicom/analyze] DICOM pipeline error:", msg);
        await sendEvent("error", {
          message:
            language === "tr"
              ? `DICOM işleme hatası: ${msg}`
              : `DICOM processing error: ${msg}`,
        });
        await sendEvent("done", { success: false });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected server error";
      await sendEvent("error", { message });
      await sendEvent("done", { success: false });
    } finally {
      await finalize();
    }
  })();

  return new NextResponse(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
