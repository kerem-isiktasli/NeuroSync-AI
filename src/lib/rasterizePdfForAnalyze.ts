import sharp from "sharp";
import { pdf } from "pdf-to-img";

/** Single-PDF upload size cap (bytes). */
export const MAX_PDF_BYTES = 25 * 1024 * 1024;

/** Hard cap per PDF file; also limited by remaining batch slots at call site. */
export const MAX_PDF_PAGES_PER_FILE = 20;

const MAX_PAGE_JPEG_BYTES = 20 * 1024 * 1024;

export type PreparedImageLike = {
  fileName: string;
  originalMimeType: string;
  normalizedMimeType: "image/jpeg";
  originalBase64: string;
  cleanBase64: string;
};

/**
 * Rasterize a PDF to normalized JPEG pages for the /api/analyze image pipeline.
 */
export async function rasterizePdfUpload(input: {
  fileName: string;
  pdfBase64: string;
  maxPages: number;
}): Promise<PreparedImageLike[]> {
  const cap = Math.max(1, Math.min(MAX_PDF_PAGES_PER_FILE, input.maxPages));
  const pdfBuffer = Buffer.from(input.pdfBase64, "base64");
  if (pdfBuffer.byteLength > MAX_PDF_BYTES) {
    throw new Error(`PDF too large (max ${MAX_PDF_BYTES / 1024 / 1024}MB).`);
  }

  const doc = await pdf(pdfBuffer, { scale: 2 });
  const baseName = input.fileName.replace(/\.pdf$/i, "") || "document";
  const out: PreparedImageLike[] = [];
  let pageNum = 0;

  for await (const pngBuf of doc) {
    pageNum += 1;
    if (pageNum > cap) break;

    const normalizedBuffer = await sharp(pngBuf)
      .rotate()
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    if (normalizedBuffer.byteLength > MAX_PAGE_JPEG_BYTES) {
      throw new Error(`PDF page ${pageNum} is too large after conversion.`);
    }

    const cleanBase64 = normalizedBuffer.toString("base64");
    out.push({
      fileName: `${baseName} (page ${pageNum}).jpg`,
      originalMimeType: "application/pdf",
      normalizedMimeType: "image/jpeg",
      originalBase64: `data:image/jpeg;base64,${cleanBase64}`,
      cleanBase64,
    });
  }

  if (out.length === 0) {
    throw new Error("PDF has no renderable pages or the file is corrupted.");
  }

  return out;
}
