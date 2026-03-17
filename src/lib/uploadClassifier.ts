/**
 * Upload Batch Classifier — Client-side pipeline routing.
 * Uses extension + MIME. Server performs full intake classification.
 * Compatible with legacy UploadBatchType for DiagnosisContext.
 */
import { classifyBatch } from "./intake";

export type UploadBatchType =
  | "dicom-study"
  | "image-batch"
  | "report-image"
  | "pdf-report"
  | "mixed"
  | "unknown";

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|bmp)$/i;
const DICOM_EXT = /\.(dcm|dicom)$/i;
const PDF_EXT = /\.pdf$/i;

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
]);

const DICOM_MIMES = new Set([
  "application/dicom",
  "image/dicom",
]);

const PDF_MIME = "application/pdf";

function looksLikeImage(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return IMAGE_EXT.test(name) || IMAGE_MIMES.has(type);
}

function looksLikeDicom(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  const hasDicomExt = DICOM_EXT.test(name);
  const hasDicomMime = DICOM_MIMES.has(type) || type.includes("dicom");
  return hasDicomExt || hasDicomMime;
}

function looksLikePdf(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return PDF_EXT.test(name) || type === PDF_MIME;
}

/** Map intake batch type to legacy UploadBatchType for DiagnosisContext routing */
function toLegacyType(batch: { batchType: string; documentCount: number }): UploadBatchType {
  if (batch.batchType === "dicom-study") return "dicom-study";
  if (batch.batchType === "pdf-report" || batch.batchType === "lab-only" || batch.batchType === "pathology-only")
    return "pdf-report";
  if (batch.batchType === "report-only") return batch.documentCount > 0 ? "pdf-report" : "image-batch";
  if (batch.batchType === "mixed-image-report" || batch.batchType === "mixed-document-set") return "mixed";
  if (batch.batchType === "image-study") return "image-batch";
  return "unknown";
}

/**
 * Classify an upload batch to determine the correct pipeline.
 * Uses universal intake classifier when possible; falls back to extension+MIME.
 */
export function classifyUploadBatch(files: File[]): UploadBatchType {
  if (!files.length) return "unknown";

  const imageCount = files.filter(looksLikeImage).length;
  const dicomCount = files.filter(looksLikeDicom).length;
  const pdfCount = files.filter(looksLikePdf).length;

  const fileInputs = files.map((f) => ({
    fileName: f.name,
    mimeType: f.type || "",
  }));
  const batch = classifyBatch(fileInputs);
  const legacy = toLegacyType(batch);

  if (process.env.NODE_ENV !== "production") {
    files.forEach((f, i) => {
      console.log(
        `[UploadClassifier] File ${i + 1}: name=${f.name}, type=${f.type || "(empty)"}, size=${f.size}, ` +
          `image=${looksLikeImage(f)}, dicom=${looksLikeDicom(f)}, pdf=${looksLikePdf(f)}`
      );
    });
    console.log(
      `[UploadClassifier] batchType=${batch.batchType}, pipeline=${batch.pipeline}, legacy=${legacy}, ` +
        `counts: image=${imageCount}, dicom=${dicomCount}, pdf=${pdfCount}`
    );
  }

  return legacy;
}
