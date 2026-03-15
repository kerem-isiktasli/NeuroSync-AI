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
}

export interface DiagnosisResult {
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
    recommendedPipeline?: string;
    uploadTypesPresent?: string[];
    diagnosticImageCount?: number;
    localizerCount?: number;
    reportImageCount?: number;
    hasMixedUpload?: boolean;
  } | null;
}

export interface DiagnosisState {
  selectedOrgan: string | null;
  diagnosisResult: DiagnosisResult | null;
  isAnalyzing: boolean;
  error: string | null;
  reportText?: string | null;
}
