/**
 * Batch-level classification — groups files and determines pipeline.
 * Combines per-file classifications with optional LLM augmentation.
 */

import type {
  BatchClassification,
  BatchType,
  PipelineType,
  AdequacyTier,
  PerFileClassification,
} from "./types";
import { classifyFile } from "./fileClassifier";

export type FileInput = {
  fileName: string;
  mimeType?: string;
  dataUri?: string;
  isDicomBuffer?: boolean;
};

/**
 * Classify an upload batch and determine pipeline.
 * Uses extension + MIME; content signals from LLM can augment per-file later.
 */
export function classifyBatch(
  files: FileInput[],
  options?: { augmentedPerFile?: Partial<PerFileClassification>[] }
): BatchClassification {
  if (!files.length) {
    return {
      batchType: "unknown",
      pipeline: "unsupported",
      adequacyTier: "insufficient",
      confidence: 0,
      perFile: [],
      diagnosticImageCount: 0,
      reportImageCount: 0,
      documentCount: 0,
      labDocumentCount: 0,
      pathologyDocumentCount: 0,
      localizerCount: 0,
      signals: ["empty-batch"],
    };
  }

  const perFile: PerFileClassification[] = files.map((f, i) => {
    const mime = f.mimeType ?? (f.dataUri ? f.dataUri.split(";")[0]?.replace("data:", "") : "");
    const base = classifyFile(i, f.fileName, mime || f.dataUri || "", {
      isDicomBuffer: f.isDicomBuffer,
    });
    const aug = options?.augmentedPerFile?.[i];
    if (aug) {
      return { ...base, ...aug } as PerFileClassification;
    }
    return base;
  });

  const dicomCount = perFile.filter((p) => p.fileKind === "dicom").length;
  const imageCount = perFile.filter(
    (p) => p.fileKind === "medical-image" || p.fileKind === "report-image"
  ).length;
  const pdfCount = perFile.filter((p) => p.fileKind === "pdf-document").length;
  const labCount = perFile.filter(
    (p) => p.documentTypeGuess === "lab-report" || p.fileKind === "lab-document"
  ).length;
  const pathologyCount = perFile.filter(
    (p) =>
      p.documentTypeGuess === "pathology-report" || p.fileKind === "pathology-document"
  ).length;
  const reportImageCount = perFile.filter((p) => p.fileKind === "report-image").length;
  const diagnosticImageCount = perFile.filter(
    (p) =>
      p.fileKind === "medical-image" &&
      p.diagnosticValue !== "none" &&
      !p.isLikelyLocalizer
  ).length;
  const localizerCount = perFile.filter((p) => p.isLikelyLocalizer).length;

  const signals: string[] = [];
  let batchType: BatchType = "unknown";
  let pipeline: PipelineType = "unsupported";
  let adequacyTier: AdequacyTier = "insufficient";
  let confidence = 50;

  // Mixed: DICOM + images, or DICOM + PDF
  if (dicomCount > 0 && (imageCount > 0 || pdfCount > 0)) {
    batchType = "mixed-image-report";
    pipeline = "mixed-image-report";
    adequacyTier = "interpretable";
    confidence = 85;
    signals.push("dicom-plus-other");
  }
  // DICOM-only
  else if (dicomCount === files.length && dicomCount > 0) {
    batchType = "dicom-study";
    pipeline = "dicom-study";
    adequacyTier = files.length >= 3 ? "interpretable" : files.length >= 1 ? "limited" : "insufficient";
    confidence = 95;
    signals.push("dicom-only-batch");
  }
  // Multiple non-image documents (PDFs)
  else if (pdfCount >= 2 && imageCount === 0 && dicomCount === 0) {
    batchType = "mixed-document-set";
    pipeline = "mixed-document-set";
    adequacyTier = "limited";
    confidence = 80;
    signals.push("multiple-documents");
  }
  // PDF-only (single)
  else if (pdfCount > 0 && imageCount === 0 && dicomCount === 0) {
    if (labCount >= pathologyCount && labCount >= 1) {
      batchType = "lab-only";
      pipeline = "lab-only";
      adequacyTier = "limited";
      signals.push("lab-document-dominant");
    } else if (pathologyCount >= labCount && pathologyCount >= 1) {
      batchType = "pathology-only";
      pipeline = "pathology-only";
      adequacyTier = "limited";
      signals.push("pathology-document-dominant");
    } else {
      batchType = "report-only";
      pipeline = "report-only";
      adequacyTier = "interpretable";
      signals.push("pdf-report-only");
    }
    confidence = 85;
  }
  // Mixed: images + documents (PDF)
  else if (imageCount > 0 && pdfCount > 0) {
    batchType = "mixed-image-report";
    pipeline = "mixed-image-report";
    adequacyTier = "interpretable";
    confidence = 85;
    signals.push("mixed-image-pdf");
  }
  // Multiple non-image documents
  else if (pdfCount >= 2 && imageCount === 0) {
    batchType = "mixed-document-set";
    pipeline = "mixed-document-set";
    adequacyTier = "limited";
    confidence = 80;
    signals.push("multiple-documents");
  }
  // Image-only
  else if (imageCount > 0 && dicomCount === 0 && pdfCount === 0) {
    if (reportImageCount >= imageCount * 0.8 && diagnosticImageCount === 0) {
      batchType = "report-only";
      pipeline = "report-only";
      adequacyTier = "limited";
      signals.push("report-images-only");
    } else if (diagnosticImageCount >= 1 || (imageCount >= 1 && reportImageCount < imageCount)) {
      batchType = "image-study";
      pipeline = "image-study";
      if (localizerCount >= imageCount * 0.8 && diagnosticImageCount === 0) {
        adequacyTier = "insufficient";
        signals.push("localizer-heavy");
      } else if (diagnosticImageCount >= 3) {
        adequacyTier = "strong";
        signals.push("multiple-diagnostic-images");
      } else if (diagnosticImageCount >= 1) {
        adequacyTier = "interpretable";
        signals.push("some-diagnostic-images");
      } else {
        adequacyTier = "limited";
        signals.push("few-diagnostic-images");
      }
      confidence = 80;
    } else {
      batchType = "unknown";
      pipeline = "insufficient-data";
      adequacyTier = "insufficient";
      signals.push("no-diagnostic-images");
    }
  }
  // Fallback
  else {
    batchType = "unknown";
    pipeline = "unsupported";
    adequacyTier = "insufficient";
    signals.push("unclassified-batch");
    confidence = 30;
  }

  return {
    batchType,
    pipeline,
    adequacyTier,
    confidence,
    perFile,
    diagnosticImageCount,
    reportImageCount,
    documentCount: pdfCount,
    labDocumentCount: labCount,
    pathologyDocumentCount: pathologyCount,
    localizerCount,
    signals,
  };
}
