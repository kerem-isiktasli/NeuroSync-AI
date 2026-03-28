/**
 * Hard caps on model output tokens per RapiMed stage (enforced in googleHealthcare).
 */

export const RAPIMED_MAX_OUTPUT_TOKENS = {
  intake_classifier: 1024,
  cohesion_arbiter: 4096,
  procedure_modality_mapper: 2048,
  imaging_atomic_extractor: 8192,
  laboratory_report_extractor: 8192,
  waveform_extractor: 6144,
  evidence_adjudicator: 8192,
  procedure_capability_policy: 4096,
  final_report_renderer: 8192,
} as const;

export type RapiMedStageTokenKey = keyof typeof RAPIMED_MAX_OUTPUT_TOKENS;
