export type Severity = "low" | "medium" | "high" | "critical";

export interface ImportantTerm {
  term: string;
  plain_explanation: string;
}

export interface DifferentialConsideration {
  label: string;
  likelihood: "high" | "moderate" | "low";
  why_it_matches: string;
  why_not_certain: string;
}

export interface AdditionalDataRequest {
  item: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export interface LiteratureReference {
  title: string;
  source: string;
  year: string;
  relevance: string;
}

export interface ReportSections {
  exam_overview?: string;
  technical_summary?: string;
  detailed_findings?: string[];
  interpretive_impression?: string;
  limitations?: string[];
  next_steps?: string[];
  /** Study adequacy limitations from per-image/intake analysis */
  study_adequacy_summary?: string;
  /** Anatomical level and side-specific detail preserved */
  anatomical_specificity_summary?: string;
  /** Level-by-level findings (e.g. spine per-level) */
  findings_by_level_summary?: string;
  /** What cannot be confidently determined from available evidence */
  what_cannot_be_determined?: string[];
  /** Multi-image agreement/disagreement summary */
  evidence_agreement_summary?: string;
}

/** Report type for UI routing (e.g. localizer vs diagnostic). */
export type ReportType = "DIAGNOSTIC" | "LOCALIZER_DETECTED";

/**
 * Standardized report types — truthfully reflect analysis depth.
 * Every report must clearly state what was analyzed and what was not.
 */
export type ReportMode =
  | "FULL_INTERPRETATION_REPORT"       // Full image analysis + synthesis
  | "LIMITED_IMAGE_ANALYSIS_REPORT"    // Some image analysis, limited coverage/confidence
  | "METADATA_ONLY_REPORT"             // DICOM/metadata only, no pixel analysis
  | "LOCALIZER_DETECTED_REPORT"       // Localizer/scout only — NOT diagnostic
  | "DOCUMENT_EXTRACTION_REPORT"       // Report screenshot/PDF OCR — no image interpretation
  | "FUSION_REPORT"                    // Image findings + official report compared
  | "LIMITED_INTERPRETATION_REPORT"    // Legacy: limited adequacy
  | "LIMITED_METADATA_REPORT"          // Legacy
  | "LIMITED_SCREENSHOT_REPORT";       // Legacy

/**
 * Report labeling — what input was analyzed, what pipeline ran, what could not be determined.
 * Ensures metadata-only reports do not look like final radiology interpretations.
 */
/** "images" = JPG/PNG screenshots; "slices" = DICOM only */
export type ReportDisplayUnit = "images" | "slices";

export interface ReportLabel {
  reportMode: ReportMode;
  inputTypeAnalyzed: string;
  pipelineRan: string;
  whatWasActuallyAnalyzed: string[];
  whatCouldNotBeDetermined: string[];
  analyzedSliceCount?: number;
  analyzedFileCount?: number;
  /** Screenshots = images; DICOM = slices. NEVER use "slices" for JPG/PNG uploads. */
  displayUnit?: ReportDisplayUnit;
  confidenceTier?: "unusable" | "limited" | "interpretable" | "strong";
  adequacyTier?: "unusable" | "limited" | "interpretable" | "strong";
}

/** Localizer report payload — first-class when reportType is LOCALIZER_DETECTED. */
export interface LocalizerReportPayload {
  interpretation: string;
  explanation: string;
  recommendation: string[];
  detectedIndicators: string[];
  confidence: number;
}

export interface DiagnosisResult {
  /** When LOCALIZER_DETECTED, UI/PDF render localizer-specific layout. */
  reportType?: ReportType;
  /** Report mode for honest labeling (metadata-only vs full interpretation). */
  reportMode?: ReportMode;
  /** Structured report labeling — input type, pipeline, what was/couldn't be analyzed. */
  reportLabel?: ReportLabel;
  /** First-class localizer payload; present when reportType === LOCALIZER_DETECTED. */
  localizerReport?: LocalizerReportPayload;
  diagnosis: string;
  severity: Severity;
  recommended_actions: string[];
  references: string[];
  affected_organ: string;
  confidence: number;
  timestamp: string;
  findings: string;
  clinical_eval?: string;
  reasoning?: string;
  isFallback?: boolean;
  fileName?: string;
  fileFormat?: string;

  modality?: string;
  anatomical_region?: string;
  concern_level?: string;
  key_findings?: string[];
  important_terms?: ImportantTerm[];
  questions_for_doctor?: string[];
  follow_up_considerations?: string[];
  medical_disclaimer?: string;
  professional_report_markdown?: string;
  report_sections?: ReportSections;

  differential_considerations?: DifferentialConsideration[];
  additional_data_requested?: AdditionalDataRequest[];
  red_flags?: string[];
  literature_support?: LiteratureReference[];

  confidence_level?: string;
  confidence_reasons?: string[];

  /** Intake classification summary (upload types, study adequacy) */
  intake_summary?: {
    studyAdequacy?: string;
    adequacyTier?: "unusable" | "limited" | "interpretable" | "strong";
    recommendedPipeline?: string;
    uploadTypesPresent?: string[];
    diagnosticImageCount?: number;
    viewableImageCount?: number;
    localizerCount?: number;
    reportImageCount?: number;
    hasMixedUpload?: boolean;
    /** True when report OCR was run successfully (report-only or fusion pipeline) */
    officialReportOcrUsed?: boolean;
  } | null;

  /** Fusion: comparison of AI image findings vs official report (when both present) */
  report_fusion?: {
    official_report_present: boolean;
    report_text_summary: string;
    agreement_points: string[];
    mismatch_points: Array<{ image_finding: string; report_finding: string; note: string }>;
    official_report_priority_note: string;
  };
}

export interface DiagnosisState {
  selectedOrgan: string | null;
  diagnosisResult: DiagnosisResult | null;
  isAnalyzing: boolean;
  error: string | null;
  reportText?: string | null;
}
