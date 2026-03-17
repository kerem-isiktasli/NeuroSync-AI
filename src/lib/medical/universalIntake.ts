/**
 * Universal Intake Classification — Phase 1.
 * Classifies each upload before downstream analysis.
 * Supports: dicom-study, diagnostic-image, viewer-screenshot, report-image,
 * pdf-report, pathology/lab-document, mixed, unknown.
 */

export type UploadType =
  | "dicom-study"
  | "diagnostic-image"
  | "localizer"
  | "viewer-screenshot"
  | "report-image"
  | "pdf-report"
  | "pathology-lab-document"
  | "non-diagnostic"
  | "mixed"
  | "unknown";

export type DocumentTypeGuess =
  | "radiology-report"
  | "pathology-report"
  | "lab-report"
  | "clinical-note"
  | "imaging-study"
  | "unknown";

export type IntakeDiagnosticValue = "high" | "medium" | "low" | "none";

export type IntakeImagePlane = "sagittal" | "axial" | "coronal" | "oblique" | "unknown";

export interface UniversalIntakeResult {
  upload_type: UploadType;
  modality_guess: string;
  anatomical_region_guess: string;
  document_type_guess?: DocumentTypeGuess;
  image_plane?: IntakeImagePlane;
  diagnostic_value: IntakeDiagnosticValue;
  contains_ui_overlay?: boolean;
  contains_report_text?: boolean;
  confidence: number;
  reasons: string[];
}

/** Resolve upload type from raw string (e.g. from LLM). */
export function resolveUploadType(raw?: string): UploadType {
  const v = String(raw ?? "").trim().toLowerCase();
  const valid: UploadType[] = [
    "dicom-study",
    "diagnostic-image",
    "localizer",
    "viewer-screenshot",
    "report-image",
    "pdf-report",
    "pathology-lab-document",
    "non-diagnostic",
    "mixed",
    "unknown",
  ];
  if (valid.includes(v as UploadType)) return v as UploadType;
  if (v.includes("dicom") || v.includes("study")) return "dicom-study";
  if (v.includes("pdf")) return "pdf-report";
  if (v.includes("pathology") || v.includes("lab")) return "pathology-lab-document";
  if (v.includes("report") || v.includes("text") || v.includes("document")) return "report-image";
  if (v.includes("localiz") || v.includes("scout")) return "localizer";
  if (v.includes("viewer") || v.includes("screenshot") || v.includes("pacs"))
    return "viewer-screenshot";
  if (v.includes("diagnostic") || v.includes("image")) return "diagnostic-image";
  if (v.includes("non") || v.includes("low") || v.includes("poor"))
    return "non-diagnostic";
  return "unknown";
}

/** Resolve document type from raw string. */
export function resolveDocumentTypeGuess(raw?: string): DocumentTypeGuess {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v.includes("radiology") || v.includes("imaging")) return "radiology-report";
  if (v.includes("pathology") || v.includes("biopsy")) return "pathology-report";
  if (v.includes("lab") || v.includes("blood") || v.includes("chemistry"))
    return "lab-report";
  if (v.includes("clinical") || v.includes("note")) return "clinical-note";
  if (v.includes("study") || v.includes("dicom")) return "imaging-study";
  return "unknown";
}
