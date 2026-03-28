/**
 * RapiMed evidence adjudicator and merger — gatekeeper for candidate facts; no new findings, no final report.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import {
  dedupeImagingCandidateFindings,
  type ImagingAtomicExtractionResult,
} from "./imagingAtomicExtractor";
import type { LaboratoryReportExtractionResult } from "./laboratoryReportExtractor";
import type { ProcedureMapperResult } from "./procedureModalityAnatomyMapper";
import { fileIdForUploadIndex, type UploadCohesionResult } from "./uploadCohesionArbiter";
import type { PerImageIntakeResult } from "./intakePrompts";
import type { WaveformExtractionResult } from "./waveformExtractor";
import type { ProcedureCapabilityPolicyResult } from "./procedureCapabilityPolicy";
import {
  FHIR_RESOURCE_HINT,
  RSNA_RAD_REPORT_SECTION_KEYS,
} from "../rapiMed/ontologyRegistries";

export type AdjudicationItemStatus =
  | "accepted"
  | "accepted_hedged"
  | "uncertain"
  | "cannot_determine"
  | "rejected";

export type DerivedConcernLevel = "low" | "moderate" | "high" | "urgent_review";

export type AdjudicationEvidenceType =
  | "imaging_finding"
  | "lab_test_result"
  | "waveform_fact"
  | "document_stated_fact"
  | "technical_quality_fact";

export interface AdjudicationContentProfileAnatomy {
  body_region: string;
  organ_system: string;
  primary_structure: string;
  substructures: string[];
  laterality: string;
  level_or_segment: string | null;
  location_precision: string;
}

/** Step A content profile inside each study_output (adjudicator + extractor). */
export interface AdjudicationContentProfile {
  procedure_class: string;
  raw_modality_codes: string[];
  study_purpose: string;
  report_family: string;
  anatomy: AdjudicationContentProfileAnatomy;
  /** Optional routing hint from the model (e.g. extractor subtype). */
  routing_subtype?: string;
}

export interface AdjudicationTechnicalContext {
  overall_quality: string;
  quality_reasons: string[];
  coverage_summary: string;
}

export interface AdjudicationItemLocation {
  body_region: string;
  primary_structure: string;
  substructure: string | null;
  laterality: string;
  level_or_segment: string | null;
  precision: string;
}

export interface SupportBreakdown {
  file_type_match: number;
  anatomy_match: number;
  provenance_quality: number;
  cross_file_agreement: number;
  localization_precision: number;
  extractor_confidence: number;
}

export interface AdjudicationProvenance {
  source_file_ids: string[];
  source_group_ids: string[];
}

export interface AcceptedAdjudicationItem {
  item_id: string;
  source_stage: "imaging" | "lab" | "waveform" | "document";
  /** Present when the model used the Study Extractor evidence_type vocabulary. */
  evidence_type?: AdjudicationEvidenceType | string;
  label: string;
  status: "accepted" | "accepted_hedged";
  total_support_score: number;
  support_breakdown: SupportBreakdown;
  provenance: AdjudicationProvenance;
  source_views_or_pages?: string[];
  adjudication_location?: AdjudicationItemLocation;
  item_rationale?: string;
  rendering_text_safe: string;
  can_drive_concern: boolean;
}

export interface UncertainAdjudicationItem {
  item_id: string;
  label: string;
  reason: string;
  total_support_score: number;
  provenance: AdjudicationProvenance;
}

export interface CannotDetermineAdjudicationItem {
  item_id: string;
  label: string;
  reason: string;
  provenance: AdjudicationProvenance;
}

export interface RejectedAdjudicationItem {
  item_id: string;
  label: string;
  reason: string;
  provenance: AdjudicationProvenance;
}

export interface StudyAdjudicationOutput {
  group_id: string;
  content_profile?: AdjudicationContentProfile;
  technical_context?: AdjudicationTechnicalContext;
  accepted_items: AcceptedAdjudicationItem[];
  uncertain_items: UncertainAdjudicationItem[];
  cannot_determine_items: CannotDetermineAdjudicationItem[];
  rejected_items: RejectedAdjudicationItem[];
  derived_concern_level: DerivedConcernLevel;
  adjudication_summary: string;
}

export interface GlobalQuarantineEntry {
  file_id: string;
  reason: string;
}

export interface EvidenceAdjudicationResult {
  upload_batch_id: string;
  study_outputs: StudyAdjudicationOutput[];
  global_quarantine_summary: GlobalQuarantineEntry[];
}

export interface EvidenceAdjudicatorInput {
  upload_batch_id: string;
  grouped_studies_and_metadata: unknown[];
  routing_outputs: Record<string, unknown>;
  imaging_candidate_findings: unknown[] | null;
  lab_extracted_entries: unknown[] | null;
  waveform_extracted_facts: unknown[] | null;
  document_extracted_facts: unknown[] | null;
  provenance_quality_metrics: Record<string, unknown>;
  cross_file_agreement_metrics: Record<string, unknown>;
  deterministic_application_rules: Record<string, unknown>;
  capability_rules: Record<string, unknown>;
  concern_level_policy: Record<string, unknown>;
  global_quarantine_summary: GlobalQuarantineEntry[];
  /** When wired, per-file OCR snippets for included files. */
  ocr_summaries_per_file?: Array<{ file_id: string; summary: string }> | null;
  /** When wired, per-file quick visual summaries for included files. */
  quick_visual_summaries_per_file?: Array<{ file_id: string; summary: string }> | null;
  /** Structured table extraction from upstream stages, if any. */
  table_extractions?: unknown | null;
  /** Normalized file metadata snapshot for the batch (optional). */
  normalized_metadata_per_file?: unknown | null;
  /** Intake classifier rows for files in the primary coherent group (when provided). */
  intake_results_for_included_files?: unknown[] | null;
  /** True when upstream multimodal extractors inspected attached images/pages for this batch. */
  raw_image_or_document_content_if_available?: boolean | null;
  /** DICOM tag snapshot when available (often null for rendered-only uploads). */
  dicom_tags_if_present?: unknown | null;
}

const CONCERN_SET = new Set<string>(["low", "moderate", "high", "urgent_review"]);

const ACCEPTED_STATUS = new Set<string>(["accepted", "accepted_hedged"]);

/** Vertex/IO failure — final renderer must not run. */
export const EVIDENCE_ADJUDICATION_VERTEX_FAILURE_SUMMARY =
  "evidence_adjudication_parse_failed_or_vertex_error";

/** Zod / structural rejection after parse — final renderer must not run. */
export const EVIDENCE_ADJUDICATION_SCHEMA_FAILURE_SUMMARY =
  "evidence_adjudication_schema_validation_failed";

const PIPELINE_UNTRUSTED_ADJUDICATION = new Set([
  EVIDENCE_ADJUDICATION_VERTEX_FAILURE_SUMMARY,
  EVIDENCE_ADJUDICATION_SCHEMA_FAILURE_SUMMARY,
]);

export function isEvidenceAdjudicationTrustedForFinalRender(
  r: EvidenceAdjudicationResult
): boolean {
  const first = r.study_outputs[0];
  if (!first) return false;
  return !PIPELINE_UNTRUSTED_ADJUDICATION.has(first.adjudication_summary);
}

/**
 * Accepted items must have file or group provenance; duplicates collapsed; stragglers → rejected.
 */
export function sanitizeAdjudicationProvenanceAndDedupe(
  r: EvidenceAdjudicationResult
): EvidenceAdjudicationResult {
  const NO_PROV = "pipeline_rejection_missing_provenance";
  return {
    ...r,
    study_outputs: r.study_outputs.map((s) => {
      const good: AcceptedAdjudicationItem[] = [];
      const bad: RejectedAdjudicationItem[] = [];
      const seenAccept = new Set<string>();
      for (const a of s.accepted_items) {
        const hasProv =
          (a.provenance.source_file_ids?.length ?? 0) > 0 ||
          (a.provenance.source_group_ids?.length ?? 0) > 0;
        if (!hasProv) {
          bad.push({
            item_id: a.item_id || "unknown",
            label: a.label,
            reason: NO_PROV,
            provenance: a.provenance,
          });
          continue;
        }
        const key = `${a.item_id}|${a.label}|${a.status}|${[...a.provenance.source_file_ids].sort().join(",")}`;
        if (seenAccept.has(key)) continue;
        seenAccept.add(key);
        good.push(a);
      }
      return {
        ...s,
        accepted_items: good,
        rejected_items: [...s.rejected_items, ...bad],
      };
    }),
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function parseProvenance(raw: unknown): AdjudicationProvenance {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    source_file_ids: Array.isArray(d.source_file_ids)
      ? d.source_file_ids.map(String)
      : [],
    source_group_ids: Array.isArray(d.source_group_ids)
      ? d.source_group_ids.map(String)
      : [],
  };
}

function parseSupportBreakdown(raw: unknown): SupportBreakdown {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    file_type_match: clamp01(Number(d.file_type_match)),
    anatomy_match: clamp01(Number(d.anatomy_match)),
    provenance_quality: clamp01(Number(d.provenance_quality)),
    cross_file_agreement: clamp01(Number(d.cross_file_agreement)),
    localization_precision: clamp01(Number(d.localization_precision)),
    extractor_confidence: clamp01(Number(d.extractor_confidence)),
  };
}

function defaultFailureContentProfile(): AdjudicationContentProfile {
  return {
    procedure_class: "unknown",
    raw_modality_codes: [],
    study_purpose: "unknown",
    report_family: "mixed_context",
    anatomy: {
      body_region: "unknown",
      organ_system: "unknown",
      primary_structure: "unknown",
      substructures: [],
      laterality: "unknown",
      level_or_segment: null,
      location_precision: "broad",
    },
  };
}

function defaultFailureTechnicalContext(reason: string): AdjudicationTechnicalContext {
  return {
    overall_quality: "unknown",
    quality_reasons: [reason],
    coverage_summary: "unable to safely determine study type",
  };
}

function parseContentProfile(raw: unknown): AdjudicationContentProfile | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const anatomyRaw = c.anatomy;
  if (!anatomyRaw || typeof anatomyRaw !== "object") return undefined;
  const a = anatomyRaw as Record<string, unknown>;
  return {
    procedure_class: String(c.procedure_class ?? "unknown"),
    raw_modality_codes: Array.isArray(c.raw_modality_codes)
      ? c.raw_modality_codes.map(String)
      : [],
    study_purpose: String(c.study_purpose ?? "unknown"),
    report_family: String(c.report_family ?? "mixed_context"),
    routing_subtype:
      c.routing_subtype != null && c.routing_subtype !== ""
        ? String(c.routing_subtype)
        : undefined,
    anatomy: {
      body_region: String(a.body_region ?? "unknown"),
      organ_system: String(a.organ_system ?? "unknown"),
      primary_structure: String(a.primary_structure ?? "unknown"),
      substructures: Array.isArray(a.substructures) ? a.substructures.map(String) : [],
      laterality: String(a.laterality ?? "unknown"),
      level_or_segment:
        a.level_or_segment === undefined || a.level_or_segment === null
          ? null
          : String(a.level_or_segment),
      location_precision: String(a.location_precision ?? "broad"),
    },
  };
}

function parseTechnicalContext(raw: unknown): AdjudicationTechnicalContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const t = raw as Record<string, unknown>;
  return {
    overall_quality: String(t.overall_quality ?? "unknown"),
    quality_reasons: Array.isArray(t.quality_reasons)
      ? t.quality_reasons.map(String)
      : [],
    coverage_summary: String(t.coverage_summary ?? ""),
  };
}

function parseItemLocation(raw: unknown): AdjudicationItemLocation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const d = raw as Record<string, unknown>;
  return {
    body_region: String(d.body_region ?? ""),
    primary_structure: String(d.primary_structure ?? ""),
    substructure:
      d.substructure === undefined || d.substructure === null
        ? null
        : String(d.substructure),
    laterality: String(d.laterality ?? "unknown"),
    level_or_segment:
      d.level_or_segment === undefined || d.level_or_segment === null
        ? null
        : String(d.level_or_segment),
    precision: String(d.precision ?? "broad"),
  };
}

function evidenceTypeToSourceStage(
  et: string
): AcceptedAdjudicationItem["source_stage"] | null {
  switch (et) {
    case "imaging_finding":
    case "technical_quality_fact":
      return "imaging";
    case "lab_test_result":
      return "lab";
    case "waveform_fact":
      return "waveform";
    case "document_stated_fact":
      return "document";
    default:
      return null;
  }
}

/** Merge legacy provenance object with top-level source_file_ids; optionally tag group_id. */
function mergeFileProvenance(
  o: Record<string, unknown>,
  groupId: string | undefined,
  attachGroupId: boolean
): AdjudicationProvenance {
  const base = parseProvenance(o.provenance);
  const fromTop = Array.isArray(o.source_file_ids) ? o.source_file_ids.map(String) : [];
  const ids = base.source_file_ids.length > 0 ? base.source_file_ids : fromTop;
  const groupIds = [...base.source_group_ids];
  if (attachGroupId && groupId && !groupIds.includes(groupId)) {
    groupIds.push(groupId);
  }
  return { source_file_ids: ids, source_group_ids: groupIds };
}

const ADJUDICATOR_EN = `You are the RapiMed Study Extractor and Evidence Adjudicator.

You analyze exactly ONE coherent group per study_outputs[] entry (typically one object).
You do not write the final polished report.
You do not browse.
You do not reward verbosity.

You only:
1. determine the study/procedure content profile (Step A)
2. extract atomic evidence from the supplied candidates (Step B)
3. adjudicate that evidence (Step C)
4. return accepted, hedged, uncertain, cannot_determine, and rejected items with provenance

INPUTS (INPUTS_JSON), including when present:
- grouped_studies_and_metadata: group_id, group_type, included_file_ids[], excluded_file_ids[], group_confidence, match fields
- intake_results_for_included_files: per-file intake signals for included uploads
- routing_outputs (procedure mapper hints) and deterministic_application_rules
- ocr_summaries_per_file, quick_visual_summaries_per_file, normalized_metadata_per_file, table_extractions
- raw_image_or_document_content_if_available — when true, upstream extractors inspected attached pixels/pages; treat candidates as grounded on that inspection
- dicom_tags_if_present (often null for rendered-only content)
- imaging_candidate_findings, lab_extracted_entries, waveform_extracted_facts, document_extracted_facts
- provenance_quality_metrics, cross_file_agreement_metrics
- capability_rules (including procedure_capability_policy when present)
- concern_level_policy
- global_quarantine_summary — file_ids that must NEVER support accepted or accepted_hedged items

STEP A — CONTENT PROFILE
Determine procedure_class, raw_modality_codes, study_purpose, report_family, anatomy hierarchy, routing_subtype (optional string on content_profile when helpful).
PROCEDURE_CLASS ENUM (use exactly one):
projection_radiography | ct | mri | ultrasound | pet_or_nuclear | fluoroscopy_or_angiography | mammography | dental_imaging | ophthalmic_imaging | dermatology_photo | pathology_slide | ecg | eeg | emg | lab_panel | lab_single_report | radiology_report_document | pathology_report_document | clinical_note_document | medication_document | operative_note_document | generic_medical_document | unknown

ANATOMY (content_profile.anatomy):
body_region, organ_system, primary_structure, substructures[], laterality (left | right | bilateral | midline | none | unknown), level_or_segment (string or null), location_precision (broad | moderate | high | exact)

CONTENT PROFILE RULES:
1. DICOM metadata outranks OCR and visual guess.
2. Clear report titles outrank weak visual impressions.
3. If anatomy is uncertain, keep it broad rather than wrong.
4. Do not infer disease to infer anatomy.
5. Lab: anatomy may be systemic or specimen-specific.
6. Generic medical document: do not force precise anatomy.
7. If routing cannot be established safely, use the FAILURE JSON shape for that study object (see below).

STEP B — ATOMIC EVIDENCE
ALLOWED EVIDENCE TYPES: imaging_finding | lab_test_result | waveform_fact | document_stated_fact | technical_quality_fact
- Imaging: atomic candidate findings only; no long narrative; no diagnosis invention; no duplicate weak splits.
- Lab: atomic tests only; never invent unit, reference range, or flag; preserve raw value text.
- Waveform: clearly supported structured facts only; no unsupported arrhythmia/seizure/neuropathy labels.
- Documents: document-stated facts only; preserve negation and certainty as written.

STEP C — EVIDENCE ADJUDICATION
For every extracted item, assign exactly one bucket: accepted | accepted_hedged | uncertain | cannot_determine | rejected.
Scoring axes (each 0.0–1.0): file_type_match, anatomy_match, provenance_quality, cross_file_agreement, localization_precision, extractor_confidence.
WEIGHTS: file_type_match 0.22, anatomy_match 0.18, provenance_quality 0.20, cross_file_agreement 0.18, localization_precision 0.12, extractor_confidence 0.10 — total_support_score = weighted sum.

DECISION DEFAULTS:
- accepted: >= 0.80
- accepted_hedged: 0.65–0.79
- uncertain: 0.50–0.64
- cannot_determine: outside capability, unsupported by study type, or structurally indeterminable
- rejected: < 0.50, contradictory, non-traceable, duplicate noise, unsupported, OR any source from global_quarantine_summary

CRITICAL ADJUDICATION RULES:
1. Low confidence alone must not be the only safety mechanism.
2. Strong provenance and cross-file agreement may allow accepted_hedged with moderate extractor confidence.
3. Poor file-type match or anatomy match blocks acceptance even if confidence is high.
4. Rejected or quarantined files must never support accepted items.
5. A document-stated fact remains document evidence unless matched by primary evidence.
6. Duplicate weak claims must not reinforce each other.
7. Accepted and accepted_hedged items only may drive concern (can_drive_concern).
8. Uncertain and cannot_determine belong in limitations later, not definitive conclusions.
9. Missing metadata is not enough to reject clearly visible, traceable, coherent evidence.
10. Outside-capability items must become cannot_determine, not accepted.
11. Do not over-reject coherent rendered medical images merely because patient identifiers are absent.
12. Do not promote weak plausibility into a diagnosis.
13. Do not let a single vague visual impression generate multiple labels.
14. If two candidate items are redundant, preserve the stronger one and reject the weaker duplicate.
15. Technical inadequacy belongs in technical_context, not in invented pathology.

CONCERN RULES:
- Derive derived_concern_level from accepted and accepted_hedged items only.
- uncertain, cannot_determine, and rejected items must not escalate concern.
- If no accepted or accepted_hedged items remain, concern must stay low or moderate according to evidence and study quality.
- Do not escalate concern from generic speculation.

WRAPPER — RETURN EXACTLY THIS JSON (one study object inside study_outputs unless the pipeline sends multiple groups):
{
  "upload_batch_id": "string",
  "study_outputs": [
    {
      "group_id": "string",
      "content_profile": {
        "procedure_class": "string",
        "raw_modality_codes": ["string"],
        "study_purpose": "diagnostic | screening | follow_up | pre_op | post_op | unknown",
        "report_family": "imaging | laboratory | waveform | document | mixed_context",
        "anatomy": {
          "body_region": "string",
          "organ_system": "string",
          "primary_structure": "string",
          "substructures": ["string"],
          "laterality": "left | right | bilateral | midline | none | unknown",
          "level_or_segment": null,
          "location_precision": "broad | moderate | high | exact"
        }
      },
      "technical_context": {
        "overall_quality": "adequate | limited | non_diagnostic | unknown",
        "quality_reasons": ["string"],
        "coverage_summary": "string"
      },
      "accepted_items": [
        {
          "item_id": "string",
          "evidence_type": "imaging_finding | lab_test_result | waveform_fact | document_stated_fact | technical_quality_fact",
          "label": "string",
          "status": "accepted | accepted_hedged",
          "total_support_score": 0.0,
          "support_breakdown": {
            "file_type_match": 0.0,
            "anatomy_match": 0.0,
            "provenance_quality": 0.0,
            "cross_file_agreement": 0.0,
            "localization_precision": 0.0,
            "extractor_confidence": 0.0
          },
          "rendering_text_safe": "string",
          "source_file_ids": ["string"],
          "source_views_or_pages": ["string"],
          "location": {
            "body_region": "string",
            "primary_structure": "string",
            "substructure": null,
            "laterality": "left | right | bilateral | midline | none | unknown",
            "level_or_segment": null,
            "precision": "broad | moderate | high | exact"
          },
          "rationale": "string",
          "can_drive_concern": false
        }
      ],
      "uncertain_items": [
        {
          "item_id": "string",
          "label": "string",
          "reason": "string",
          "total_support_score": 0.0,
          "source_file_ids": ["string"]
        }
      ],
      "cannot_determine_items": [
        { "item_id": "string", "label": "string", "reason": "string", "source_file_ids": ["string"] }
      ],
      "rejected_items": [
        { "item_id": "string", "label": "string", "reason": "string", "source_file_ids": ["string"] }
      ],
      "derived_concern_level": "low | moderate | high | urgent_review",
      "adjudication_summary": "string"
    }
  ],
  "global_quarantine_summary": [{ "file_id": "string", "reason": "string" }]
}

FAILURE JSON for a study object when profiling is unsafe (still wrap in study_outputs[]; echo upload_batch_id):
Use the same outer wrapper. Inner study object: content_profile with procedure_class "unknown", raw_modality_codes [], study_purpose "unknown", report_family "mixed_context", anatomy with body_region/organ_system/primary_structure "unknown", substructures [], laterality "unknown", level_or_segment null, location_precision "broad"; technical_context overall_quality "unknown", quality_reasons ["content profiling failed"], coverage_summary "unable to safely determine study type"; accepted_items, uncertain_items, cannot_determine_items, rejected_items all []; derived_concern_level "low"; adjudication_summary "study extraction failed safely".

FORBIDDEN: final polished report; diagnosis invention; verbosity; acceptance without non-empty source_file_ids on accepted paths; using quarantined files as support.`;

const ADJUDICATOR_TR = `Sen RapiMed Çalışma Çıkarıcısı ve Kanıt Hakemisin.

study_outputs içinde tipik olarak tek tutarlı grup.
Nihai cilalı rapor yazmazsın; tarama yapmazsın; ödüllendirici uzunluk üretmezsin.

Adımlar: A) içerik profili B) atom kanıt C) hakemlik (accepted / accepted_hedged / uncertain / cannot_determine / rejected).

GİRDİLER: INPUTS_JSON — grup meta, intake_results_for_included_files, OCR/görsel özetler, raw_image_or_document_content_if_available, dicom_tags_if_present, aday bulgular, kapasite kuralları, global_quarantine_summary.

İçerik kuralları 1–9 ve hakem kuralları 1–15 EN ile aynı mantık. Zayıf olasılığı tanıya yükseltme; tek belirsiz görüntüden çok etiket; mükerrer adayda güçlüyü tut zayıfı reddet; teknik yetersizlik technical_context’te, uydurma patoloji değil.

Altı eksen ve ağırlıklar İngilizce şemadakiyle aynı. global_quarantine_summary dosyaları asla kabul yolu için kaynak olamaz.

Çıktı: upload_batch_id + study_outputs + global_quarantine_summary; şema ve enumlar İngilizce, yalnızca geçerli JSON.`;

export function buildEvidenceAdjudicatorPrompt(
  language: "tr" | "en",
  input: EvidenceAdjudicatorInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? ADJUDICATOR_TR : ADJUDICATOR_EN;
  return `${discipline}${spec}

Return ONLY valid JSON matching the schema. No markdown fences. Echo upload_batch_id from INPUTS_JSON.

INPUTS_JSON:
${JSON.stringify(input, null, 2)}`;
}

function parseAccepted(
  raw: unknown,
  groupId: string | undefined
): AcceptedAdjudicationItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const st = String(o.status ?? "");
  if (!ACCEPTED_STATUS.has(st)) return null;
  let stage = String(o.source_stage ?? "");
  if (!["imaging", "lab", "waveform", "document"].includes(stage)) {
    const mapped = evidenceTypeToSourceStage(String(o.evidence_type ?? ""));
    if (!mapped) return null;
    stage = mapped;
  }
  const prov = mergeFileProvenance(o, groupId, true);
  if (prov.source_file_ids.length === 0) return null;
  const loc = parseItemLocation(o.location);
  const views = Array.isArray(o.source_views_or_pages)
    ? o.source_views_or_pages.map(String)
    : undefined;
  const rationale = o.rationale != null ? String(o.rationale) : undefined;
  const et = o.evidence_type != null ? String(o.evidence_type) : undefined;
  return {
    item_id: String(o.item_id ?? ""),
    label: String(o.label ?? ""),
    source_stage: stage as AcceptedAdjudicationItem["source_stage"],
    ...(et ? { evidence_type: et } : {}),
    status: st as "accepted" | "accepted_hedged",
    total_support_score: clamp01(Number(o.total_support_score)),
    support_breakdown: parseSupportBreakdown(o.support_breakdown),
    provenance: prov,
    ...(views && views.length > 0 ? { source_views_or_pages: views } : {}),
    ...(loc ? { adjudication_location: loc } : {}),
    ...(rationale !== undefined && rationale !== "" ? { item_rationale: rationale } : {}),
    rendering_text_safe: String(o.rendering_text_safe ?? ""),
    can_drive_concern: o.can_drive_concern === true,
  };
}

function parseUncertain(
  raw: unknown,
  groupId: string | undefined
): UncertainAdjudicationItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    item_id: String(o.item_id ?? ""),
    label: String(o.label ?? ""),
    reason: String(o.reason ?? ""),
    total_support_score: clamp01(Number(o.total_support_score)),
    provenance: mergeFileProvenance(o, groupId, false),
  };
}

function parseCannot(
  raw: unknown,
  groupId: string | undefined
): CannotDetermineAdjudicationItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    item_id: String(o.item_id ?? ""),
    label: String(o.label ?? ""),
    reason: String(o.reason ?? ""),
    provenance: mergeFileProvenance(o, groupId, false),
  };
}

function parseRejected(
  raw: unknown,
  groupId: string | undefined
): RejectedAdjudicationItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    item_id: String(o.item_id ?? ""),
    label: String(o.label ?? ""),
    reason: String(o.reason ?? ""),
    provenance: mergeFileProvenance(o, groupId, false),
  };
}

function parseStudyOutput(raw: unknown): StudyAdjudicationOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const gid = String(o.group_id ?? "");
  const concern = String(o.derived_concern_level ?? "low");
  const content_profile = parseContentProfile(o.content_profile);
  const technical_context = parseTechnicalContext(o.technical_context);
  const accepted: AcceptedAdjudicationItem[] = [];
  if (Array.isArray(o.accepted_items)) {
    for (const x of o.accepted_items) {
      const p = parseAccepted(x, gid || undefined);
      if (p) accepted.push(p);
    }
  }
  const uncertain: UncertainAdjudicationItem[] = [];
  if (Array.isArray(o.uncertain_items)) {
    for (const x of o.uncertain_items) {
      const p = parseUncertain(x, gid || undefined);
      if (p) uncertain.push(p);
    }
  }
  const cannot: CannotDetermineAdjudicationItem[] = [];
  if (Array.isArray(o.cannot_determine_items)) {
    for (const x of o.cannot_determine_items) {
      const p = parseCannot(x, gid || undefined);
      if (p) cannot.push(p);
    }
  }
  const rejected: RejectedAdjudicationItem[] = [];
  if (Array.isArray(o.rejected_items)) {
    for (const x of o.rejected_items) {
      const p = parseRejected(x, gid || undefined);
      if (p) rejected.push(p);
    }
  }
  return {
    group_id: gid,
    ...(content_profile ? { content_profile } : {}),
    ...(technical_context ? { technical_context } : {}),
    accepted_items: accepted,
    uncertain_items: uncertain,
    cannot_determine_items: cannot,
    rejected_items: rejected,
    derived_concern_level: CONCERN_SET.has(concern)
      ? (concern as DerivedConcernLevel)
      : "low",
    adjudication_summary: String(o.adjudication_summary ?? ""),
  };
}

export function parseEvidenceAdjudicationResult(
  raw: unknown,
  fallbackUploadBatchId: string
): EvidenceAdjudicationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const studies: StudyAdjudicationOutput[] = [];
  if (Array.isArray(o.study_outputs)) {
    for (const s of o.study_outputs) {
      const p = parseStudyOutput(s);
      if (p) studies.push(p);
    }
  }
  const quarantine: GlobalQuarantineEntry[] = [];
  if (Array.isArray(o.global_quarantine_summary)) {
    for (const q of o.global_quarantine_summary) {
      if (!q || typeof q !== "object") continue;
      const r = q as Record<string, unknown>;
      quarantine.push({
        file_id: String(r.file_id ?? ""),
        reason: String(r.reason ?? ""),
      });
    }
  }
  return {
    upload_batch_id: String(o.upload_batch_id ?? fallbackUploadBatchId),
    study_outputs: studies,
    global_quarantine_summary: quarantine,
  };
}

export function primaryGroupIdFromAdjudicatorInput(
  input: EvidenceAdjudicatorInput
): string {
  for (const g of input.grouped_studies_and_metadata) {
    if (g && typeof g === "object") {
      const o = g as Record<string, unknown>;
      if (o.group_type !== "excluded_group" && o.group_id != null) {
        return String(o.group_id);
      }
    }
  }
  const first = input.grouped_studies_and_metadata[0];
  if (first && typeof first === "object" && (first as Record<string, unknown>).group_id != null) {
    return String((first as Record<string, unknown>).group_id);
  }
  return "default";
}

export function defaultEvidenceAdjudicationResult(
  uploadBatchId: string,
  groupId: string,
  reason: string
): EvidenceAdjudicationResult {
  return {
    upload_batch_id: uploadBatchId,
    study_outputs: [
      {
        group_id: groupId,
        accepted_items: [],
        uncertain_items: [],
        cannot_determine_items: [],
        rejected_items: [],
        derived_concern_level: "low",
        adjudication_summary: reason,
      },
    ],
    global_quarantine_summary: [],
  };
}

export function buildEvidenceAdjudicatorInput(params: {
  upload_batch_id: string;
  cohesion: UploadCohesionResult;
  procedureMapper: ProcedureMapperResult;
  intakeSummary: { studyAdequacy: string; adequacyTier?: string; recommendedPipeline: string };
  imagingAtomic: ImagingAtomicExtractionResult | null;
  labExtraction: LaboratoryReportExtractionResult | null;
  waveformExtraction: WaveformExtractionResult | null;
  documentFacts?: unknown[] | null;
  crossFileSummary?: string | null;
  capabilityPolicy?: ProcedureCapabilityPolicyResult | null;
  perImageIntake?: PerImageIntakeResult[] | null;
}): EvidenceAdjudicatorInput {
  const { cohesion, procedureMapper } = params;

  const primaryGroup =
    cohesion.groups.find((g) => g.group_id === procedureMapper.group_id) ??
    cohesion.groups.find((g) => g.group_type !== "excluded_group");
  const allowedIds = new Set(primaryGroup?.included_file_ids ?? []);

  const intake_results_for_included_files =
    params.perImageIntake && params.perImageIntake.length > 0
      ? (allowedIds.size > 0
          ? params.perImageIntake.filter((p) =>
              allowedIds.has(fileIdForUploadIndex(p.imageIndex))
            )
          : params.perImageIntake
        ).map((p) => ({
          file_id: fileIdForUploadIndex(p.imageIndex),
          fileName: p.fileName,
          image_index: p.imageIndex,
          upload_type: p.upload_type,
          intake_family: p.intake_family,
          intake_is_medical: p.intake_is_medical,
          confidence: p.confidence,
          diagnostic_value: p.diagnostic_value,
          reasons: (p.reasons ?? []).slice(0, 14),
        }))
      : null;

  const raw_image_or_document_content_if_available =
    params.imagingAtomic != null ||
    params.labExtraction != null ||
    params.waveformExtraction != null;

  const grouped_studies_and_metadata = cohesion.groups.map((g) => ({
    group_id: g.group_id,
    group_type: g.group_type,
    included_file_ids: g.included_file_ids,
    excluded_file_ids: g.excluded_file_ids,
    provisional_group: g.provisional_group,
    group_confidence: g.group_confidence,
    group_rationale: g.group_rationale,
    patient_match_status: g.patient_match_status,
    time_match_status: g.time_match_status,
    anatomy_match_status: g.anatomy_match_status,
    family_match_status: g.family_match_status,
  }));

  const imagingAtomicForCandidates =
    params.imagingAtomic == null
      ? null
      : {
          ...params.imagingAtomic,
          candidate_findings: dedupeImagingCandidateFindings(
            params.imagingAtomic.candidate_findings
          ),
        };

  const global_quarantine_summary: GlobalQuarantineEntry[] = [];
  for (const q of cohesion.quarantined_files) {
    global_quarantine_summary.push({ file_id: q.file_id, reason: q.reason });
  }
  for (const c of cohesion.canceled_files) {
    global_quarantine_summary.push({ file_id: c.file_id, reason: c.reason });
  }
  for (const g of cohesion.groups) {
    if (g.group_type === "excluded_group") {
      for (const fid of g.included_file_ids) {
        global_quarantine_summary.push({
          file_id: fid,
          reason: "excluded_group",
        });
      }
    }
  }

  const imaging_candidate_findings =
    imagingAtomicForCandidates?.candidate_findings?.map((f) => ({
      finding_id: f.finding_id,
      label_normalized: f.label_normalized,
      label_source_text: f.label_source_text,
      assertion: f.assertion,
      support_score_estimate: f.support_score_estimate,
      support_type: f.support_type,
      source_file_ids: f.source_file_ids,
      could_drive_concern: f.could_drive_concern,
      location: f.location,
      rationale: f.rationale,
    })) ?? null;

  const lab_extracted_entries =
    params.labExtraction?.panels?.flatMap((panel) =>
      panel.tests.map((t) => ({
        test_id: t.test_id,
        test_name_raw: t.test_name_raw,
        value_raw: t.value_raw,
        flag: t.flag,
        source_file_ids: t.source_file_ids,
        panel_name: panel.panel_name,
      }))
    ) ?? null;

  const waveform_extracted_facts =
    params.waveformExtraction?.structured_facts?.map((f) => ({
      fact_id: f.fact_id,
      label: f.label,
      value_raw: f.value_raw,
      confidence: f.confidence,
      source_file_ids: f.source_file_ids,
    })) ?? null;

  return {
    upload_batch_id: params.upload_batch_id,
    grouped_studies_and_metadata,
    routing_outputs: {
      procedure_class: procedureMapper.procedure_class,
      routing_target: procedureMapper.routing_target,
      study_purpose: procedureMapper.study_purpose,
      anatomy: procedureMapper.anatomy,
      raw_modality_codes: procedureMapper.raw_modality_codes,
      fhir_primary_resource_hint:
        procedureMapper.routing_target === "imaging_extractor"
          ? FHIR_RESOURCE_HINT.imaging_study
          : procedureMapper.routing_target === "lab_extractor" ||
              procedureMapper.routing_target === "waveform_extractor"
            ? FHIR_RESOURCE_HINT.observation
            : procedureMapper.routing_target === "document_extractor"
              ? FHIR_RESOURCE_HINT.document_reference
              : FHIR_RESOURCE_HINT.document_reference,
    },
    imaging_candidate_findings,
    lab_extracted_entries:
      lab_extracted_entries && lab_extracted_entries.length > 0
        ? lab_extracted_entries
        : null,
    waveform_extracted_facts:
      waveform_extracted_facts && waveform_extracted_facts.length > 0
        ? waveform_extracted_facts
        : null,
    document_extracted_facts: params.documentFacts ?? null,
    provenance_quality_metrics: {
      procedure_mapper_overall: procedureMapper.confidence_breakdown?.overall,
    },
    cross_file_agreement_metrics: {
      summary: params.crossFileSummary ?? null,
    },
    deterministic_application_rules: {
      studyAdequacy: params.intakeSummary.studyAdequacy,
      adequacyTier: params.intakeSummary.adequacyTier,
      recommendedPipeline: params.intakeSummary.recommendedPipeline,
      rsna_rad_report_section_vocabulary: [...RSNA_RAD_REPORT_SECTION_KEYS],
    },
    capability_rules: {
      note: "Apply modality and intake family limits from prior stages.",
      procedure_capability_policy:
        params.capabilityPolicy &&
        params.capabilityPolicy.capability_decisions.length > 0
          ? params.capabilityPolicy
          : null,
    },
    concern_level_policy: {
      cxr_lte2_images_max: "moderate_unless_obvious_emergency",
      only_accepted_drive_concern: true,
    },
    global_quarantine_summary,
    ocr_summaries_per_file: null,
    quick_visual_summaries_per_file: null,
    table_extractions: null,
    normalized_metadata_per_file: null,
    intake_results_for_included_files,
    raw_image_or_document_content_if_available,
    dicom_tags_if_present: null,
  };
}
