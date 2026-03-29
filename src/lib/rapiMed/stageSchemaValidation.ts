/**
 * Zod validation after RapiMed JSON stages — hard rejection when required shape/enums fail.
 */

import { z } from "zod";
import type { UploadCohesionResult } from "../ai/uploadCohesionArbiter";
import type { ProcedureMapperResult } from "../ai/procedureModalityAnatomyMapper";
import type { ImagingAtomicExtractionResult } from "../ai/imagingAtomicExtractor";
import type { LaboratoryReportExtractionResult } from "../ai/laboratoryReportExtractor";
import type { WaveformExtractionResult } from "../ai/waveformExtractor";
import type { EvidenceAdjudicationResult } from "../ai/evidenceAdjudicatorMerger";
import type { FinalReportRenderResult } from "../ai/finalReportRenderer";
import type { ProcedureCapabilityPolicyResult } from "../ai/procedureCapabilityPolicy";

export interface StageValidationResult {
  ok: boolean;
  errors: string[];
}

const zProcessAction = z.enum([
  "cancel",
  "continue",
  "continue_with_quarantine",
  "continue_provisional",
]);
const zGroupType = z.enum([
  "imaging_study_group",
  "lab_report_group",
  "pathology_group",
  "waveform_group",
  "clinical_document_group",
  "mixed_context_bundle",
  "excluded_group",
]);

const zCohesionGroup = z.object({
  group_id: z.string().min(1),
  group_type: zGroupType,
  included_file_ids: z.array(z.string()),
  excluded_file_ids: z.array(z.string()).default([]),
  group_confidence: z.number(),
  group_rationale: z.array(z.string()),
  patient_match_status: z.string(),
  time_match_status: z.string(),
  anatomy_match_status: z.string(),
  family_match_status: z.string(),
  provisional_group: z.boolean().default(false),
});

const zUploadCohesionResult = z.object({
  upload_batch_id: z.string().min(1),
  process_action: zProcessAction,
  overall_reason: z.string(),
  groups: z.array(zCohesionGroup),
  quarantined_files: z.array(
    z.object({
      file_id: z.string(),
      reason: z.string(),
      severity: z.enum(["low", "medium", "high"]),
    })
  ),
  canceled_files: z.array(
    z.object({
      file_id: z.string(),
      reason: z.string(),
    })
  ),
  user_clarification_needed: z.boolean(),
  clarification_questions: z.array(z.string()),
});

const zRoutingTarget = z.enum([
  "imaging_extractor",
  "lab_extractor",
  "waveform_extractor",
  "document_extractor",
  "reject",
]);

const zReportFamily = z.enum([
  "imaging",
  "laboratory",
  "waveform",
  "document",
  "mixed_context",
]);

const zMapperRoutingDecision = z.enum([
  "accept",
  "accept_provisional",
  "reject",
]);

const zProcedureMapperResult = z.object({
  group_id: z.string().min(1),
  procedure_class: z.string().min(1),
  raw_modality_codes: z.array(z.string()),
  study_purpose: z.string(),
  report_family: zReportFamily,
  anatomy: z.object({
    body_region: z.string(),
    organ_system: z.string(),
    primary_structure: z.string(),
    substructures: z.array(z.string()),
    laterality: z.string(),
    level_or_segment: z.string().nullable(),
    location_precision: z.string(),
  }),
  mapping_confidence: z.number(),
  provisional_mapping: z.boolean(),
  mapping_rationale: z.array(z.string()),
  mapping_conflicts: z.array(z.string()),
  routing_decision: zMapperRoutingDecision,
  routing_target: zRoutingTarget,
  content_subtype: z.string(),
  confidence_breakdown: z.object({
    metadata_support: z.number(),
    ocr_support: z.number(),
    visual_support: z.number(),
    cross_file_support: z.number(),
    overall: z.number(),
  }),
});

const zTechnicalOverall = z.enum(["adequate", "limited", "non_diagnostic"]);

const zImagingAtomicResult = z.object({
  group_id: z.string().min(1),
  technical_adequacy: z.object({
    overall: zTechnicalOverall,
    reasons: z.array(z.string()),
    coverage_summary: z.string(),
    motion_or_artifact: z.array(z.string()),
    missing_critical_views_or_series: z.array(z.string()),
  }),
  verified_views_or_series: z.array(z.any()),
  candidate_findings: z.array(z.any()),
  excluded_or_unusable_images: z.array(z.any()),
  quality_flags: z.array(z.string()),
});

const zLabReportType = z.enum([
  "blood_test",
  "urine_test",
  "chemistry",
  "hematology",
  "coagulation",
  "microbiology",
  "pathology_lab",
  "molecular",
  "mixed_lab",
  "unknown",
]);

const zLabQuality = z.enum(["high", "medium", "low"]);

const zLaboratoryReportResult = z.object({
  group_id: z.string().min(1),
  report_type: zLabReportType,
  specimen: z.string().nullable(),
  collection_datetime: z.string().nullable(),
  performing_lab: z.string().nullable(),
  panels: z.array(z.any()),
  report_level_notes: z.array(z.string()),
  extraction_quality: z.object({
    overall: zLabQuality,
    reasons: z.array(z.string()),
  }),
});

const zWaveformType = z.enum(["ecg", "eeg", "emg", "unknown"]);

const zWaveformResult = z.object({
  group_id: z.string().min(1),
  waveform_type: zWaveformType,
  signal_quality: z.object({
    overall: zTechnicalOverall,
    reasons: z.array(z.string()),
  }),
  structured_facts: z.array(z.any()),
  waveform_notes: z.array(z.string()),
  forbidden_to_infer: z.array(z.string()),
});

const zConcern = z.enum(["low", "moderate", "high", "urgent_review"]);

const zEvidenceAdjudicationResult = z.object({
  upload_batch_id: z.string().min(1),
  study_outputs: z
    .array(
      z.object({
        group_id: z.string().min(1),
        content_profile: z.unknown().optional(),
        technical_context: z.unknown().optional(),
        accepted_items: z.array(z.any()),
        uncertain_items: z.array(z.any()),
        cannot_determine_items: z.array(z.any()),
        rejected_items: z.array(z.any()),
        derived_concern_level: zConcern,
        adjudication_summary: z.string(),
      })
    )
    .min(1),
  global_quarantine_summary: z.array(
    z.object({
      file_id: z.string(),
      reason: z.string(),
    })
  ),
});

const zFinalReportType = z.enum([
  "imaging",
  "laboratory",
  "waveform",
  "document",
  "mixed_context",
]);

const zFinalReportRenderResult = z.object({
  group_id: z.string().min(1),
  report_type: zFinalReportType,
  plain_summary: z.string(),
  professional_summary: z.string(),
  concern_level: zConcern,
  report_sections: z.object({
    exam_or_document_overview: z.string(),
    technical_or_source_summary: z.string(),
    key_results: z.array(z.string()),
    detailed_results: z.array(z.string()),
    impression_or_conclusion: z.string(),
    limitations_or_uncertainties: z.array(z.string()),
    recommended_follow_up: z.array(z.string()),
  }),
  important_terms: z.array(z.any()),
  provenance_summary: z.object({
    included_file_ids: z.array(z.string()),
    excluded_file_ids: z.array(z.string()),
    coherent_subset_used: z.boolean(),
  }),
});

const zPublishability = z.enum(["publish", "repair_required", "block"]);

const zValidationCategory = z.object({
  passed: z.boolean(),
  issues: z.array(z.string()),
});

const zFinalReportValidationResult = z.object({
  group_id: z.string().min(1),
  is_valid: z.boolean(),
  publishability: zPublishability,
  validation_results: z.object({
    study_fact_consistency: zValidationCategory,
    evidence_consistency: zValidationCategory,
    concern_consistency: zValidationCategory,
    limitation_consistency: zValidationCategory,
    forbidden_content: zValidationCategory,
  }),
  repair_instructions: z.array(z.string()),
  blocking_reasons: z.array(z.string()),
});

const zCapabilityDecision = z.enum([
  "within_capability",
  "outside_capability",
  "conditionally_within_capability",
  "unknown_capability",
]);

const zProcedureCapabilityPolicyResult = z.object({
  procedure_class: z.string().min(1),
  capability_decisions: z.array(
    z.object({
      label: z.string().min(1),
      decision: zCapabilityDecision,
      reason: z.string(),
    })
  ),
});

function runZod<T>(schema: z.ZodType<T>, data: unknown, label: string): StageValidationResult {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, errors: [] };
  const errs = r.error.issues.map((i) => `${label}:${i.path.join(".")}:${i.message}`);
  return { ok: false, errors: errs };
}

export function validateUploadCohesionResult(data: unknown): StageValidationResult {
  return runZod(zUploadCohesionResult, data, "cohesion");
}

export function validateProcedureMapperResult(data: unknown): StageValidationResult {
  return runZod(zProcedureMapperResult, data, "procedure_mapper");
}

export function validateImagingAtomicExtractionResult(data: unknown): StageValidationResult {
  return runZod(zImagingAtomicResult, data, "imaging_atomic");
}

export function validateLaboratoryReportExtractionResult(data: unknown): StageValidationResult {
  return runZod(zLaboratoryReportResult, data, "laboratory_report");
}

export function validateWaveformExtractionResult(data: unknown): StageValidationResult {
  return runZod(zWaveformResult, data, "waveform");
}

export function validateEvidenceAdjudicationResult(data: unknown): StageValidationResult {
  return runZod(zEvidenceAdjudicationResult, data, "evidence_adjudication");
}

export function validateFinalReportRenderResult(data: unknown): StageValidationResult {
  return runZod(zFinalReportRenderResult, data, "final_report");
}

export function validateFinalReportValidationResult(data: unknown): StageValidationResult {
  return runZod(zFinalReportValidationResult, data, "final_report_validator");
}

const zConstrainedReportRepairResult = z.object({
  group_id: z.string().min(1),
  repaired_report: zFinalReportRenderResult,
  repair_summary: z.array(z.string()),
});

export function validateConstrainedReportRepairResult(data: unknown): StageValidationResult {
  return runZod(zConstrainedReportRepairResult, data, "constrained_report_repairer");
}

export function validateProcedureCapabilityPolicyResult(data: unknown): StageValidationResult {
  return runZod(zProcedureCapabilityPolicyResult, data, "procedure_capability_policy");
}

/** Type-narrowing helpers after successful validation (caller checks ok first). */
export function asValidatedCohesion(data: unknown): UploadCohesionResult {
  return data as UploadCohesionResult;
}
export function asValidatedProcedureMapper(data: unknown): ProcedureMapperResult {
  return data as ProcedureMapperResult;
}
export function asValidatedImagingAtomic(data: unknown): ImagingAtomicExtractionResult {
  return data as ImagingAtomicExtractionResult;
}
export function asValidatedLaboratory(data: unknown): LaboratoryReportExtractionResult {
  return data as LaboratoryReportExtractionResult;
}
export function asValidatedWaveform(data: unknown): WaveformExtractionResult {
  return data as WaveformExtractionResult;
}
export function asValidatedEvidence(data: unknown): EvidenceAdjudicationResult {
  return data as EvidenceAdjudicationResult;
}
export function asValidatedFinalReport(data: unknown): FinalReportRenderResult {
  return data as FinalReportRenderResult;
}
export function asValidatedCapabilityPolicy(data: unknown): ProcedureCapabilityPolicyResult {
  return data as ProcedureCapabilityPolicyResult;
}
