/**
 * Per-image intake types and helpers for study aggregation.
 * LLM prompt and parsing: singleFileIntakeClassifier.ts (RapiMed single-file family classifier).
 */

export type UploadType =
  | "diagnostic-image"
  | "localizer"
  | "viewer-screenshot"
  | "report-image"
  | "non-diagnostic"
  | "unknown";

export type IntakeDiagnosticValue = "high" | "medium" | "low" | "none";

export type IntakeImagePlane = "sagittal" | "axial" | "coronal" | "oblique" | "unknown";

/** Set by single-file intake classifier when that path runs. */
export type IntakeReadabilityStatus = "readable" | "partially_readable" | "unreadable";

export type IntakeLinkabilityStatus = "strong" | "moderate" | "weak" | "unknown";

export type IntakeDiagnosticUtilityStatus = "high" | "moderate" | "low" | "unknown";

export interface PerImageIntakeResult {
  imageIndex: number;
  fileName: string;
  upload_type: UploadType;
  modality_guess: string;
  anatomical_region_guess: string;
  image_plane: IntakeImagePlane;
  diagnostic_value: IntakeDiagnosticValue;
  contains_ui_overlay: boolean;
  contains_report_text: boolean;
  confidence: number;
  reasons: string[];
  /** RapiMed single-file intake classifier family enum value (see singleFileIntakeClassifier). */
  intake_family?: string;
  intake_is_medical?: boolean;
  quarantine_suggested?: boolean;
  quarantine_reason?: string | null;
  readability_status?: IntakeReadabilityStatus;
  linkability_status?: IntakeLinkabilityStatus;
  diagnostic_utility_status?: IntakeDiagnosticUtilityStatus;
}

export function resolveUploadType(raw?: string): UploadType {
  const v = String(raw ?? "").trim().toLowerCase();
  const valid: UploadType[] = [
    "diagnostic-image",
    "localizer",
    "viewer-screenshot",
    "report-image",
    "non-diagnostic",
    "unknown",
  ];
  if (valid.includes(v as UploadType)) return v as UploadType;
  if (v.includes("report") || v.includes("text") || v.includes("document"))
    return "report-image";
  if (v.includes("localiz") || v.includes("scout") || v.includes("planning"))
    return "localizer";
  if (v.includes("uncertain") || v.includes("unclear")) return "unknown";
  if (v.includes("viewer") || v.includes("screenshot") || v.includes("pacs"))
    return "viewer-screenshot";
  if (v.includes("diagnostic") || v.includes("image")) return "diagnostic-image";
  if (v.includes("non") || v.includes("low") || v.includes("poor"))
    return "non-diagnostic";
  return "unknown";
}
