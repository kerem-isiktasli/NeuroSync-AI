/**
 * RapiMed Study Fact Locker — deterministic lock of adjudicated metadata into one record.
 * No LLM; no diagnosis; accepted/rejected finding lists do not alter locked facts (rules 8–9).
 */

import type { ProcedureMapperResult } from "./procedureModalityAnatomyMapper";
import type { UploadCohesionResult } from "./uploadCohesionArbiter";
import type {
  AdjudicationContentProfile,
  DerivedConcernLevel,
  StudyAdjudicationOutput,
} from "./evidenceAdjudicatorMerger";

export type LockedReportFamily =
  | "imaging"
  | "laboratory"
  | "waveform"
  | "document"
  | "mixed_context";

export type LockedStudyPurpose =
  | "diagnostic"
  | "screening"
  | "follow_up"
  | "pre_op"
  | "post_op"
  | "unknown";

export type LockedTechnicalQuality =
  | "adequate"
  | "limited"
  | "non_diagnostic"
  | "unknown";

export type LockedConcernLevel = DerivedConcernLevel;

export type MaxAllowedConcernLevel =
  | LockedConcernLevel
  | "unknown";

export type CoherenceStatus =
  | "coherent"
  | "provisional"
  | "quarantine_partial"
  | "mixed"
  | "unknown";

export interface LockedAnatomyFacts {
  body_region: string;
  organ_system: string;
  primary_structure: string;
  substructures: string[];
  laterality: string;
  level_or_segment: string | null;
  location_precision: string;
}

export interface LockedStudyFacts {
  report_family: LockedReportFamily;
  procedure_class: string;
  raw_modality_codes: string[];
  study_purpose: LockedStudyPurpose;
  image_count: number | null;
  verified_views_or_series: string[];
  anatomy: LockedAnatomyFacts;
  coherent_subset_used: boolean;
  included_file_ids: string[];
  excluded_file_ids: string[];
  technical_quality: LockedTechnicalQuality;
  derived_concern_level_from_adjudication: LockedConcernLevel;
  max_allowed_concern_level: MaxAllowedConcernLevel;
}

export interface StudyFactLockerResult {
  group_id: string;
  locked_study_facts: LockedStudyFacts;
  locked_fact_warnings: string[];
}

const REPORT_FAMILY_SET = new Set<string>([
  "imaging",
  "laboratory",
  "waveform",
  "document",
  "mixed_context",
]);

const STUDY_PURPOSE_SET = new Set<string>([
  "diagnostic",
  "screening",
  "follow_up",
  "pre_op",
  "post_op",
  "unknown",
]);

const TECH_QUALITY_SET = new Set<string>([
  "adequate",
  "limited",
  "non_diagnostic",
  "unknown",
]);

const CONCERN_SET = new Set<string>([
  "low",
  "moderate",
  "high",
  "urgent_review",
]);

const EMPTY_ANATOMY: LockedAnatomyFacts = {
  body_region: "unknown",
  organ_system: "unknown",
  primary_structure: "unknown",
  substructures: [],
  laterality: "unknown",
  level_or_segment: null,
  location_precision: "broad",
};

function parseReportFamily(v: string | undefined): LockedReportFamily {
  const s = String(v ?? "").trim();
  return REPORT_FAMILY_SET.has(s) ? (s as LockedReportFamily) : "mixed_context";
}

function parseStudyPurpose(v: string | undefined): LockedStudyPurpose {
  const s = String(v ?? "").trim();
  return STUDY_PURPOSE_SET.has(s) ? (s as LockedStudyPurpose) : "unknown";
}

function parseTechnicalQuality(v: string | undefined): LockedTechnicalQuality {
  const s = String(v ?? "").trim();
  return TECH_QUALITY_SET.has(s) ? (s as LockedTechnicalQuality) : "unknown";
}

function parseConcern(v: string | undefined): LockedConcernLevel {
  const s = String(v ?? "").trim();
  return CONCERN_SET.has(s) ? (s as LockedConcernLevel) : "low";
}

function anatomyFromProfile(
  cp: AdjudicationContentProfile | undefined
): LockedAnatomyFacts {
  const a = cp?.anatomy;
  if (!a) return { ...EMPTY_ANATOMY };
  return {
    body_region: String(a.body_region ?? "unknown").trim() || "unknown",
    organ_system: String(a.organ_system ?? "unknown").trim() || "unknown",
    primary_structure: String(a.primary_structure ?? "unknown").trim() || "unknown",
    substructures: Array.isArray(a.substructures) ? a.substructures.map(String) : [],
    laterality: String(a.laterality ?? "unknown").trim() || "unknown",
    level_or_segment:
      a.level_or_segment == null || a.level_or_segment === ""
        ? null
        : String(a.level_or_segment),
    location_precision: String(a.location_precision ?? "broad").trim() || "broad",
  };
}

function anatomyFromMapper(m: ProcedureMapperResult): LockedAnatomyFacts {
  const a = m.anatomy;
  return {
    body_region: String(a.body_region ?? "unknown").trim() || "unknown",
    organ_system: String(a.organ_system ?? "unknown").trim() || "unknown",
    primary_structure: String(a.primary_structure ?? "unknown").trim() || "unknown",
    substructures: Array.isArray(a.substructures) ? [...a.substructures] : [],
    laterality: String(a.laterality ?? "unknown").trim() || "unknown",
    level_or_segment:
      a.level_or_segment == null || a.level_or_segment === ""
        ? null
        : String(a.level_or_segment),
    location_precision: String(a.location_precision ?? "broad").trim() || "broad",
  };
}

/**
 * Derive pipeline coherence label from cohesion only (not from adjudicated findings).
 */
export function deriveCoherenceStatusFromCohesion(
  cohesion: UploadCohesionResult,
  coherentSubsetUsed: boolean
): CoherenceStatus {
  const pa = cohesion.process_action;
  if (pa === "continue_provisional") return "provisional";
  if (pa === "continue_with_quarantine") return "quarantine_partial";
  const primary =
    cohesion.groups.find((g) => g.group_type !== "excluded_group") ??
    cohesion.groups[0];
  if (primary?.group_type === "mixed_context_bundle") return "mixed";
  if (primary?.provisional_group) return "provisional";
  if (coherentSubsetUsed) return "quarantine_partial";
  if (pa === "continue") return "coherent";
  return "unknown";
}

export interface BuildLockedStudyFactsParams {
  study_output: StudyAdjudicationOutput;
  procedure_mapper_fallback: ProcedureMapperResult | null;
  included_file_ids: string[];
  excluded_file_ids: string[];
  coherent_subset_used: boolean;
  /** Pipeline coherence label (logged in locked_fact_warnings, not merged into anatomy/procedure). */
  coherence_status: CoherenceStatus;
  /** Exact count when known; null if deliberately unknown. */
  image_count_if_known: number | null;
  /** View/series names from imaging atomic only; null if not applicable / unknown. */
  verified_views_or_series_if_known: string[] | null;
  /**
   * Optional upstream cap (e.g. policy). When omitted, stored as "unknown" (no cap asserted).
   */
  max_allowed_concern_level_upstream?: MaxAllowedConcernLevel;
}

/**
 * Locks study facts from adjudicated content_profile + technical_context and file scope.
 * Does not read accepted_items, uncertain_items, cannot_determine_items, or rejected_items.
 */
export function buildLockedStudyFactsRecord(
  params: BuildLockedStudyFactsParams
): StudyFactLockerResult {
  const {
    study_output,
    procedure_mapper_fallback,
    included_file_ids,
    excluded_file_ids,
    coherent_subset_used,
    coherence_status,
    image_count_if_known,
    verified_views_or_series_if_known,
    max_allowed_concern_level_upstream,
  } = params;

  const warnings: string[] = [];
  const cp = study_output.content_profile;

  let reportFamily = parseReportFamily(cp?.report_family);
  let procedureClass = String(cp?.procedure_class ?? "").trim();
  let rawCodes = Array.isArray(cp?.raw_modality_codes)
    ? cp!.raw_modality_codes.map(String)
    : [];
  let studyPurpose = parseStudyPurpose(cp?.study_purpose);

  const mapper = procedure_mapper_fallback;
  if (!cp) {
    warnings.push("content_profile_missing_used_procedure_mapper_fallback");
  }
  if (!procedureClass && mapper) {
    procedureClass = mapper.procedure_class;
    warnings.push("procedure_class_filled_from_procedure_mapper");
  }
  if (
    rawCodes.length === 0 &&
    mapper?.raw_modality_codes?.length &&
    (!cp || cp.raw_modality_codes === undefined)
  ) {
    rawCodes = [...mapper.raw_modality_codes];
    warnings.push("raw_modality_codes_filled_from_procedure_mapper");
  }
  if (
    (cp?.study_purpose === undefined ||
      cp?.study_purpose === null ||
      String(cp.study_purpose).trim() === "") &&
    mapper?.study_purpose
  ) {
    studyPurpose = parseStudyPurpose(mapper.study_purpose);
    warnings.push("study_purpose_filled_from_procedure_mapper");
  }
  if (
    (!cp?.report_family || !REPORT_FAMILY_SET.has(String(cp.report_family))) &&
    mapper?.report_family &&
    REPORT_FAMILY_SET.has(mapper.report_family)
  ) {
    reportFamily = mapper.report_family as LockedReportFamily;
    warnings.push("report_family_filled_from_procedure_mapper");
  }

  let anatomy: LockedAnatomyFacts;
  if (cp?.anatomy) {
    anatomy = anatomyFromProfile(cp);
  } else if (mapper) {
    anatomy = anatomyFromMapper(mapper);
    warnings.push("anatomy_missing_from_content_profile_used_procedure_mapper");
  } else {
    anatomy = { ...EMPTY_ANATOMY };
    warnings.push("anatomy_unknown_no_fallback");
  }

  if (!study_output.technical_context) {
    warnings.push("technical_context_missing_technical_quality_unknown");
  }

  const technicalQuality = parseTechnicalQuality(
    study_output.technical_context?.overall_quality
  );

  const derivedConcern = parseConcern(study_output.derived_concern_level);

  const maxAllowed: MaxAllowedConcernLevel =
    max_allowed_concern_level_upstream ?? "unknown";

  const verified =
    verified_views_or_series_if_known != null
      ? [...verified_views_or_series_if_known]
      : [];

  if (
    verified_views_or_series_if_known == null &&
    image_count_if_known != null &&
    image_count_if_known > 0
  ) {
    warnings.push("verified_views_or_series_not_supplied");
  }

  if (image_count_if_known == null) {
    warnings.push("image_count_unknown");
  }

  warnings.push(`coherence_status:${coherence_status}`);

  return {
    group_id: study_output.group_id,
    locked_study_facts: {
      report_family: reportFamily,
      procedure_class: procedureClass || "unknown",
      raw_modality_codes: rawCodes,
      study_purpose: studyPurpose,
      image_count:
        image_count_if_known != null && Number.isFinite(image_count_if_known)
          ? Math.max(0, Math.floor(image_count_if_known))
          : null,
      verified_views_or_series: verified,
      anatomy,
      coherent_subset_used,
      included_file_ids: [...included_file_ids],
      excluded_file_ids: [...excluded_file_ids],
      technical_quality: technicalQuality,
      derived_concern_level_from_adjudication: derivedConcern,
      max_allowed_concern_level: maxAllowed,
    },
    locked_fact_warnings: warnings,
  };
}
