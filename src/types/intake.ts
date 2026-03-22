/**
 * Intake type system for RapiMed — v2.
 *
 * Two-object model:
 *   OBJECT 1: PatientProfile — stored per user, reusable, editable in settings
 *   OBJECT 2: AnalysisIntake — stored per report/analysis, specific to one upload
 *
 * Both feed into CombinedRoutingContext for pipeline selection.
 */

// ─── Shared enums / literals ────────────────────────────────────────

export type BodyRegion =
  | "brain"
  | "c-spine"
  | "t-spine"
  | "l-spine"
  | "chest"
  | "abdomen"
  | "pelvis"
  | "shoulder"
  | "elbow"
  | "wrist-hand"
  | "hip"
  | "knee"
  | "ankle-foot"
  | "whole-body"
  | "other";

export type FileType =
  | "mri"
  | "ct"
  | "x-ray"
  | "ultrasound"
  | "blood-test"
  | "pathology"
  | "doctor-report"
  | "mixed"
  | "not-sure";

export type UploadFormat =
  | "dicom"
  | "screenshots"
  | "pdf-report"
  | "images-and-report"
  | "mixed"
  | "not-sure";

export type SymptomDuration =
  | "today"
  | "days"
  | "weeks"
  | "months"
  | "chronic";

export type SymptomTrend = "worse" | "better" | "same" | "not-sure";

export type OutputPreference =
  | "simple-explanation"
  | "findings-summary"
  | "comparison"
  | "possible-meaning"
  | "doctor-questions";

export type StudyCompleteness = "full-study" | "selected-images" | "not-sure";

export type StudyTimeline = "first" | "follow-up" | "not-sure";

export type YesNoUnsure = "yes" | "no" | "not-sure";

// ═══════════════════════════════════════════════════════════════════
// OBJECT 1: PatientProfile — stored per user, reusable
// ═══════════════════════════════════════════════════════════════════

export interface PatientProfile {
  // GROUP A1 — Required fields (gate upload)
  dateOfBirth: string | null;
  sexAtBirth: "male" | "female" | "other" | null;
  knownDiagnoses: string[];
  chronicConditions: string[];
  priorSurgeries: string[];

  // GROUP A2 — Saved medical context (optional, reusable)
  activeFollowUpDiagnoses: string[];
  doctorSummary: string;
  priorReportsAvailable: boolean | null;
  commonBodyRegions: BodyRegion[];
  defaultReportPreference: OutputPreference | null;

  /** Display nickname; uniqueness enforced via Firestore `nicknames` registry (server API). */
  nickname: string | null;
  /** Firebase Storage download URL for profile photo. */
  avatarUrl: string | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export const EMPTY_PATIENT_PROFILE: PatientProfile = {
  dateOfBirth: null,
  sexAtBirth: null,
  knownDiagnoses: [],
  chronicConditions: [],
  priorSurgeries: [],
  activeFollowUpDiagnoses: [],
  doctorSummary: "",
  priorReportsAvailable: null,
  commonBodyRegions: [],
  defaultReportPreference: null,
  nickname: null,
  avatarUrl: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Validates that all required profile fields are filled */
export function validateProfileRequired(p: PatientProfile): string[] {
  const missing: string[] = [];
  if (!p.dateOfBirth) missing.push("dateOfBirth");
  if (!p.sexAtBirth) missing.push("sexAtBirth");
  return missing;
}

export function isProfileComplete(p: PatientProfile): boolean {
  return validateProfileRequired(p).length === 0;
}

// ═══════════════════════════════════════════════════════════════════
// OBJECT 2: AnalysisIntake — stored per report/analysis
// ═══════════════════════════════════════════════════════════════════

export interface AnalysisIntake {
  // GROUP B1 — Required per-upload fields (gate upload)
  fileType: FileType | null;
  bodyRegion: BodyRegion | null;
  primaryConcern: string;
  symptomDuration: SymptomDuration | null;
  symptomTrend: SymptomTrend | null;
  studyTimeline: StudyTimeline | null;
  uploadFormat: UploadFormat | null;
  studyCompleteness: StudyCompleteness | null;
  hasWrittenReport: YesNoUnsure | null;
  /** Display name of attached doctor report file from intake form (not uploaded to server separately). */
  doctorReportFile?: string;
  desiredOutput: OutputPreference[];

  // GROUP B2 — Conditional fields (shown based on answers)
  contrastUsed: YesNoUnsure | null;
  doctorReviewed: YesNoUnsure | null;
  doctorReviewSummary: string;
  priorRelatedStudies: YesNoUnsure | null;
  priorStudyChangeSummary: string;
  laterality: "left" | "right" | "bilateral" | "midline" | null;

  // Spine-specific
  spineRegion: "cervical" | "thoracic" | "lumbar" | null;
  hasRadiatingPain: boolean | null;
  radiationSide: "left" | "right" | "bilateral" | null;
  hasNumbness: boolean | null;
  hasWeakness: boolean | null;
  hasBalanceIssues: boolean | null;
  hasBowelBladderChanges: boolean | null;
  hasSaddleNumbness: boolean | null;
  priorSpineSurgery: boolean | null;
  recentSpineInjury: boolean | null;

  // Brain-specific
  brainSymptoms: string[];
  brainOnsetType: "sudden" | "gradual" | null;
  brainPriorHistory: boolean | null;

  // Chest-specific
  chestSymptoms: string[];
  chestHasFever: boolean | null;
  chestKnownLungDisease: boolean | null;
  chestMassFollowUp: boolean | null;

  // Abdomen-specific
  abdomenSymptoms: string[];
  abdomenSide: "left" | "right" | "diffuse" | null;
  abdomenFeverNauseaVomiting: boolean | null;
  abdomenWeightLoss: boolean | null;
  abdomenPriorSurgery: boolean | null;
  abdomenPregnancyContext: boolean | null;

  // Lab-specific
  labTestPurpose: "routine" | "symptom-driven" | null;
  labTestCategory: string;
  labPriorAvailable: boolean | null;
  labAbnormalOnly: boolean | null;

  // Pathology-specific
  pathologyOrgan: string;
  pathologyBiopsyOrSurgery: "biopsy" | "surgery" | null;
  pathologySuspectedDiagnosis: string;
  pathologyRelatedImaging: boolean | null;

  // Report-only-specific
  reportType: "radiology" | "discharge" | "consultation" | "pathology" | "other" | null;
  reportWantsType: "summary" | "explanation" | "doctor-questions" | null;
  reportRelatedImages: boolean | null;

  // Screenshot-specific
  screenshotFromPhoneViewer: boolean | null;
  screenshotCutOff: boolean | null;

  // Metadata
  analysisId: string | null;
  userId: string | null;
  createdAt: string;
}

export const EMPTY_ANALYSIS_INTAKE: AnalysisIntake = {
  fileType: null,
  bodyRegion: null,
  primaryConcern: "",
  symptomDuration: null,
  symptomTrend: null,
  studyTimeline: null,
  uploadFormat: null,
  studyCompleteness: null,
  hasWrittenReport: null,
  doctorReportFile: undefined,
  desiredOutput: [],
  contrastUsed: null,
  doctorReviewed: null,
  doctorReviewSummary: "",
  priorRelatedStudies: null,
  priorStudyChangeSummary: "",
  laterality: null,
  spineRegion: null,
  hasRadiatingPain: null,
  radiationSide: null,
  hasNumbness: null,
  hasWeakness: null,
  hasBalanceIssues: null,
  hasBowelBladderChanges: null,
  hasSaddleNumbness: null,
  priorSpineSurgery: null,
  recentSpineInjury: null,
  brainSymptoms: [],
  brainOnsetType: null,
  brainPriorHistory: null,
  chestSymptoms: [],
  chestHasFever: null,
  chestKnownLungDisease: null,
  chestMassFollowUp: null,
  abdomenSymptoms: [],
  abdomenSide: null,
  abdomenFeverNauseaVomiting: null,
  abdomenWeightLoss: null,
  abdomenPriorSurgery: null,
  abdomenPregnancyContext: null,
  labTestPurpose: null,
  labTestCategory: "",
  labPriorAvailable: null,
  labAbnormalOnly: null,
  pathologyOrgan: "",
  pathologyBiopsyOrSurgery: null,
  pathologySuspectedDiagnosis: "",
  pathologyRelatedImaging: null,
  reportType: null,
  reportWantsType: null,
  reportRelatedImages: null,
  screenshotFromPhoneViewer: null,
  screenshotCutOff: null,
  analysisId: null,
  userId: null,
  createdAt: new Date().toISOString(),
};

/** Validates that all required intake fields for upload are filled */
export function validateIntakeRequired(i: AnalysisIntake): string[] {
  const missing: string[] = [];
  if (!i.fileType) missing.push("fileType");
  if (!i.bodyRegion) missing.push("bodyRegion");
  if (!i.primaryConcern || i.primaryConcern.trim().length < 3) missing.push("primaryConcern");
  if (!i.symptomDuration) missing.push("symptomDuration");
  if (!i.symptomTrend) missing.push("symptomTrend");
  if (!i.studyTimeline) missing.push("studyTimeline");
  if (!i.uploadFormat) missing.push("uploadFormat");
  if (!i.studyCompleteness) missing.push("studyCompleteness");
  if (!i.hasWrittenReport) missing.push("hasWrittenReport");
  if (i.desiredOutput.length === 0) missing.push("desiredOutput");
  return missing;
}

export function isIntakeComplete(i: AnalysisIntake): boolean {
  return validateIntakeRequired(i).length === 0;
}

// ─── FILE INSPECTION CONTEXT (from actual upload analysis) ──────────

export interface FileInspectionContext {
  actualMimeTypes: string[];
  dicomDetected: boolean;
  pdfDetected: boolean;
  screenshotDetected: boolean;
  fileCount: number;
  detectedSeriesType: string | null;
  detectedBodyRegionGuess: string | null;
  detectedBodyRegionConfidence: number;
  technicalQualityEstimate: "high" | "medium" | "low" | "unknown";
}

// ─── COMBINED ROUTING CONTEXT ───────────────────────────────────────

export interface CombinedRoutingContext {
  profile: PatientProfile;
  intake: AnalysisIntake;
  fileInspection: FileInspectionContext;
}

// ─── ROUTING DECISION OUTPUT ────────────────────────────────────────

export type RoutingPipeline =
  | "image-analysis"
  | "dicom-study"
  | "document-report"
  | "limited-image-analysis";

export interface RoutingDecision {
  pipeline: RoutingPipeline;
  domain: string;
  confidenceLevel: "high" | "medium" | "low";
  bodyRegionSource: "intake" | "file-inspection" | "profile-history" | "unknown";
  reportStyle: "full" | "limited" | "explanation" | "comparison";
  safetyLevel: "standard" | "elevated";
  reasons: string[];
  conflicts: string[];
}
