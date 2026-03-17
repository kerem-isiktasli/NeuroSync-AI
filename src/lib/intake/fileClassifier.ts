/**
 * Per-file classification using extension + MIME + optional content signals.
 * Does NOT use only extension or only MIME — combines both.
 */

import type { PerFileClassification, FileKind, ModalityGuess, DocumentTypeGuess } from "./types";

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|gif|bmp|tiff?)$/i;
const DICOM_EXT = /\.(dcm|dicom|dicomdir)$/i;
const PDF_EXT = /\.pdf$/i;

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
]);

const DICOM_MIMES = new Set([
  "application/dicom",
  "image/dicom",
  "application/octet-stream",
]);

const PDF_MIME = "application/pdf";

/** Lab report filename hints */
const LAB_HINTS = /(lab|blood|chemistry|cbc|metabolic|lipid|thyroid|hb1ac|glucose|bun|creatinine|alt|ast|urinalysis)/i;

/** Pathology report filename hints */
const PATHOLOGY_HINTS = /(pathology|biopsy|histology|specimen|surgical|margin)/i;

/** Radiology report filename hints */
const RADIOLOGY_HINTS = /(radiology|mri|ct|xray|report|finding|impression)/i;

function getExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
}

function getMimeType(mimeOrDataUri?: string): string {
  if (!mimeOrDataUri) return "";
  if (mimeOrDataUri.startsWith("data:")) {
    const m = mimeOrDataUri.match(/^data:([^;]+)/);
    return m ? m[1].toLowerCase().trim() : "";
  }
  return mimeOrDataUri.toLowerCase().trim();
}

/**
 * Classify a single file using extension + MIME.
 * Content-based classification (LLM) can augment this later.
 */
export function classifyFile(
  fileIndex: number,
  fileName: string,
  mimeTypeOrDataUri: string,
  options?: { isDicomBuffer?: boolean }
): PerFileClassification {
  const ext = getExtension(fileName);
  const mime = getMimeType(mimeTypeOrDataUri);
  const nameLower = fileName.toLowerCase();
  const signals: string[] = [];

  let fileKind: FileKind = "unknown";
  let modalityGuess: ModalityGuess = "UNKNOWN";
  let documentTypeGuess: DocumentTypeGuess | undefined;
  let containsUiOverlay = false;
  let containsDenseText = false;
  let isLikelyLocalizer = false;
  let diagnosticValue: PerFileClassification["diagnosticValue"] = "none";
  let confidence = 50;

  // DICOM — extension takes priority over generic octet-stream for images
  if (
    options?.isDicomBuffer ||
    DICOM_EXT.test(fileName) ||
    (mime.includes("dicom") && !IMAGE_EXT.test(fileName)) ||
    ((DICOM_MIMES.has(mime) || mime.includes("dicom")) && !IMAGE_EXT.test(fileName))
  ) {
    fileKind = "dicom";
    modalityGuess = "UNKNOWN";
    signals.push("dicom-ext-or-mime");
    if (options?.isDicomBuffer) signals.push("dicom-magic-bytes");
    confidence = 95;
  }
  // PDF
  else if (PDF_EXT.test(fileName) || mime === PDF_MIME) {
    fileKind = "pdf-document";
    modalityGuess = "DOCUMENT";
    containsDenseText = true;
    signals.push("pdf-ext-or-mime");

    if (LAB_HINTS.test(fileName) || LAB_HINTS.test(nameLower)) {
      documentTypeGuess = "lab-report";
      confidence = 85;
      signals.push("lab-filename-hint");
    } else if (PATHOLOGY_HINTS.test(fileName) || PATHOLOGY_HINTS.test(nameLower)) {
      documentTypeGuess = "pathology-report";
      confidence = 85;
      signals.push("pathology-filename-hint");
    } else if (RADIOLOGY_HINTS.test(fileName) || RADIOLOGY_HINTS.test(nameLower)) {
      documentTypeGuess = "radiology-report";
      confidence = 85;
      signals.push("radiology-filename-hint");
    } else {
      documentTypeGuess = "radiology-report";
      confidence = 60;
      signals.push("pdf-default-radiology");
    }
  }
  // Image — explicit image ext or MIME wins over octet-stream
  else if (IMAGE_EXT.test(fileName) || IMAGE_MIMES.has(mime) || mime.startsWith("image/")) {
    // Cannot distinguish report-image vs medical-image from extension/MIME alone.
    // Default to medical-image; LLM intake can override to report-image.
    fileKind = "medical-image";
    modalityGuess = "UNKNOWN";
    signals.push("image-ext-or-mime");
    confidence = 70;
  }
  // Unknown
  else {
    signals.push("unknown-format");
    confidence = 20;
  }

  return {
    fileIndex,
    fileName,
    mimeType: mime || "unknown",
    extension: ext,
    fileKind,
    modalityGuess,
    anatomicalRegionGuess: "",
    documentTypeGuess,
    containsUiOverlay,
    containsDenseText,
    isLikelyLocalizer,
    diagnosticValue,
    confidence,
    signals,
  };
}
