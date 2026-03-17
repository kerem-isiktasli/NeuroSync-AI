/**
 * Universal Medical Intake — Type definitions.
 * Used for per-file and batch-level classification.
 */

// ─── FILE-LEVEL CLASSIFICATION ────────────────────────────────────────────

export type FileKind =
  | "dicom"
  | "medical-image"
  | "report-image"
  | "pdf-document"
  | "lab-document"
  | "pathology-document"
  | "unknown";

export type ModalityGuess =
  | "CT"
  | "MRI"
  | "XRAY"
  | "US"
  | "PET"
  | "DOCUMENT"
  | "LAB"
  | "PATHOLOGY"
  | "UNKNOWN";

export type DocumentTypeGuess =
  | "radiology-report"
  | "pathology-report"
  | "lab-report"
  | "clinical-note"
  | "unknown";

export type DiagnosticValue = "high" | "medium" | "low" | "none";

export interface PerFileClassification {
  fileIndex: number;
  fileName: string;
  mimeType: string;
  extension: string;
  fileKind: FileKind;
  modalityGuess: ModalityGuess;
  anatomicalRegionGuess: string;
  documentTypeGuess?: DocumentTypeGuess;
  containsUiOverlay: boolean;
  containsDenseText: boolean;
  isLikelyLocalizer: boolean;
  diagnosticValue: DiagnosticValue;
  confidence: number;
  signals: string[];
}

// ─── BATCH-LEVEL CLASSIFICATION ───────────────────────────────────────────

export type BatchType =
  | "dicom-study"
  | "image-study"
  | "report-only"
  | "lab-only"
  | "pathology-only"
  | "mixed-image-report"
  | "mixed-document-set"
  | "unsupported"
  | "unknown";

// ─── ADEQUACY TIERS ────────────────────────────────────────────────────────

export type AdequacyTier =
  | "insufficient"
  | "limited"
  | "interpretable"
  | "strong";

export type StudyAdequacyTier = AdequacyTier;

export type DocumentAdequacyTier = AdequacyTier;

// ─── PIPELINE TYPES ────────────────────────────────────────────────────────

export type PipelineType =
  | "dicom-study"
  | "image-study"
  | "report-only"
  | "lab-only"
  | "pathology-only"
  | "mixed-image-report"
  | "mixed-document-set"
  | "insufficient-data"
  | "unsupported";

export interface BatchClassification {
  batchType: BatchType;
  pipeline: PipelineType;
  adequacyTier: AdequacyTier;
  confidence: number;
  perFile: PerFileClassification[];
  diagnosticImageCount: number;
  reportImageCount: number;
  documentCount: number;
  labDocumentCount: number;
  pathologyDocumentCount: number;
  localizerCount: number;
  signals: string[];
}
