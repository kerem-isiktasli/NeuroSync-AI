/**
 * Pipeline Router — Maps batch classification to the correct processing pipeline.
 * Ensures explicit routing; never silently falls into wrong path.
 */

import type { BatchClassification, PipelineType } from "./types";

export interface PipelineRoute {
  pipeline: PipelineType;
  apiPath: "dicom" | "analyze" | "document";
  requiresPdfHandling: boolean;
  requiresImageHandling: boolean;
  requiresDocumentExtraction: boolean;
  reason: string;
}

/**
 * Route a classified batch to the correct pipeline.
 * Returns explicit route; never ambiguous.
 */
export function routeToPipeline(classification: BatchClassification): PipelineRoute {
  const { batchType, pipeline, perFile } = classification;
  const hasPdf = perFile.some((p) => p.fileKind === "pdf-document");
  const hasImages = perFile.some(
    (p) =>
      p.fileKind === "medical-image" ||
      p.fileKind === "report-image"
  );
  const hasDicom = perFile.some((p) => p.fileKind === "dicom");

  switch (pipeline) {
    case "dicom-study":
      return {
        pipeline: "dicom-study",
        apiPath: "dicom",
        requiresPdfHandling: false,
        requiresImageHandling: false,
        requiresDocumentExtraction: false,
        reason: "DICOM-only batch → DICOM pipeline",
      };

    case "report-only":
      return {
        pipeline: "report-only",
        apiPath: "analyze",
        requiresPdfHandling: hasPdf,
        requiresImageHandling: hasImages,
        requiresDocumentExtraction: true,
        reason: hasPdf
          ? "PDF report(s) → document extraction pipeline"
          : "Report image(s) → OCR pipeline",
      };

    case "lab-only":
      return {
        pipeline: "lab-only",
        apiPath: "analyze",
        requiresPdfHandling: hasPdf,
        requiresImageHandling: hasImages,
        requiresDocumentExtraction: true,
        reason: "Lab document(s) → lab extraction pipeline",
      };

    case "pathology-only":
      return {
        pipeline: "pathology-only",
        apiPath: "analyze",
        requiresPdfHandling: hasPdf,
        requiresImageHandling: hasImages,
        requiresDocumentExtraction: true,
        reason: "Pathology document(s) → pathology extraction pipeline",
      };

    case "mixed-image-report":
      return {
        pipeline: "mixed-image-report",
        apiPath: "analyze",
        requiresPdfHandling: hasPdf,
        requiresImageHandling: true,
        requiresDocumentExtraction: hasPdf || classification.reportImageCount > 0,
        reason: "Mixed images + report → fusion pipeline",
      };

    case "mixed-document-set":
      return {
        pipeline: "mixed-document-set",
        apiPath: "analyze",
        requiresPdfHandling: hasPdf,
        requiresImageHandling: hasImages,
        requiresDocumentExtraction: true,
        reason: "Multiple documents → document merge pipeline",
      };

    case "image-study":
      return {
        pipeline: "image-study",
        apiPath: "analyze",
        requiresPdfHandling: false,
        requiresImageHandling: true,
        requiresDocumentExtraction: false,
        reason: "Diagnostic image(s) → image analysis pipeline",
      };

    case "insufficient-data":
      return {
        pipeline: "insufficient-data",
        apiPath: "analyze",
        requiresPdfHandling: false,
        requiresImageHandling: true,
        requiresDocumentExtraction: false,
        reason: "Insufficient diagnostic content → limited response pipeline",
      };

    case "unsupported":
    default:
      return {
        pipeline: "unsupported",
        apiPath: "analyze",
        requiresPdfHandling: false,
        requiresImageHandling: false,
        requiresDocumentExtraction: false,
        reason: "Unsupported or unknown batch → rejection pipeline",
      };
  }
}
