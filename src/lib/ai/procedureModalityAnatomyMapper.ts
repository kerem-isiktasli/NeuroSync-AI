/**
 * RapiMed procedure, modality, and anatomy mapper — one coherent group, no diagnosis/findings.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import {
  fileIdForUploadIndex,
  type CohesionGroup,
  type UploadCohesionResult,
} from "./uploadCohesionArbiter";
import type { PerImageIntakeResult } from "./intakePrompts";
import {
  FHIR_RESOURCE_HINT,
  normalizeDicomModalityCode,
} from "../rapiMed/ontologyRegistries";

export const PROCEDURE_CLASS_VALUES = [
  "projection_radiography",
  "ct",
  "mri",
  "ultrasound",
  "pet_or_nuclear",
  "fluoroscopy_or_angiography",
  "mammography",
  "dental_imaging",
  "ophthalmic_imaging",
  "dermatology_photo",
  "pathology_slide",
  "ecg",
  "eeg",
  "emg",
  "lab_panel",
  "lab_single_report",
  "radiology_report_document",
  "pathology_report_document",
  "clinical_note_document",
  "medication_document",
  "operative_note_document",
  "generic_medical_document",
  "unknown",
] as const;

export type ProcedureClass = (typeof PROCEDURE_CLASS_VALUES)[number];

export type StudyPurpose =
  | "diagnostic"
  | "screening"
  | "follow_up"
  | "pre_op"
  | "post_op"
  | "unknown";

export type LocationPrecision = "broad" | "moderate" | "high" | "exact";

export type AnatomyLaterality =
  | "left"
  | "right"
  | "bilateral"
  | "midline"
  | "none"
  | "unknown";

export type RoutingTarget =
  | "imaging_extractor"
  | "lab_extractor"
  | "waveform_extractor"
  | "document_extractor"
  | "reject";

export type ReportFamily =
  | "imaging"
  | "laboratory"
  | "waveform"
  | "document"
  | "mixed_context";

export type MapperRoutingDecision = "accept" | "accept_provisional" | "reject";

export interface AnatomyHierarchy {
  body_region: string;
  organ_system: string;
  primary_structure: string;
  substructures: string[];
  laterality: AnatomyLaterality;
  level_or_segment: string | null;
  location_precision: LocationPrecision;
}

export interface ConfidenceBreakdown {
  metadata_support: number;
  ocr_support: number;
  visual_support: number;
  cross_file_support: number;
  overall: number;
}

export interface ProcedureMapperInput {
  group_id: string;
  group_type: string;
  family: string;
  all_file_level_metadata: Array<Record<string, unknown>>;
  ocr_text: string | null;
  dicom_tags_if_present: Record<string, unknown> | null;
  prior_intake_signals: Array<Record<string, unknown>>;
  number_of_files: number;
  number_of_pages: number | null;
  number_of_images: number;
  page_thumbnail_summaries: string[] | null;
  source_provenance_quality: Record<string, unknown>;
}

export interface ProcedureMapperResult {
  group_id: string;
  procedure_class: ProcedureClass;
  raw_modality_codes: string[];
  study_purpose: StudyPurpose;
  report_family: ReportFamily;
  anatomy: AnatomyHierarchy;
  mapping_confidence: number;
  provisional_mapping: boolean;
  mapping_rationale: string[];
  mapping_conflicts: string[];
  routing_decision: MapperRoutingDecision;
  /** Derived from procedure_class + report_family when routing_decision is not reject (or from legacy routing_target). */
  routing_target: RoutingTarget;
  /** Legacy auxiliary label for extractors; optional in model JSON, defaulted from procedure_class. */
  content_subtype: string;
  /** Legacy breakdown; overall mirrors mapping_confidence when not supplied by the model. */
  confidence_breakdown: ConfidenceBreakdown;
}

const PROCEDURE_SET = new Set<string>(PROCEDURE_CLASS_VALUES);

const STUDY_PURPOSE_SET = new Set<string>([
  "diagnostic",
  "screening",
  "follow_up",
  "pre_op",
  "post_op",
  "unknown",
]);

const ROUTING_SET = new Set<string>([
  "imaging_extractor",
  "lab_extractor",
  "waveform_extractor",
  "document_extractor",
  "reject",
]);

const REPORT_FAMILY_SET = new Set<string>([
  "imaging",
  "laboratory",
  "waveform",
  "document",
  "mixed_context",
]);

const ROUTING_DECISION_SET = new Set<string>([
  "accept",
  "accept_provisional",
  "reject",
]);

const PROCEDURE_IMAGING = new Set<ProcedureClass>([
  "projection_radiography",
  "ct",
  "mri",
  "ultrasound",
  "pet_or_nuclear",
  "fluoroscopy_or_angiography",
  "mammography",
  "dental_imaging",
  "ophthalmic_imaging",
  "dermatology_photo",
  "pathology_slide",
]);

const PROCEDURE_LAB = new Set<ProcedureClass>(["lab_panel", "lab_single_report"]);

const PROCEDURE_WAVEFORM = new Set<ProcedureClass>(["ecg", "eeg", "emg"]);

const PROCEDURE_DOCUMENT = new Set<ProcedureClass>([
  "radiology_report_document",
  "pathology_report_document",
  "clinical_note_document",
  "medication_document",
  "operative_note_document",
  "generic_medical_document",
]);

export function inferReportFamilyForProcedureClass(
  pc: ProcedureClass
): ReportFamily {
  if (PROCEDURE_IMAGING.has(pc)) return "imaging";
  if (PROCEDURE_LAB.has(pc)) return "laboratory";
  if (PROCEDURE_WAVEFORM.has(pc)) return "waveform";
  if (PROCEDURE_DOCUMENT.has(pc)) return "document";
  return "mixed_context";
}

export function inferRoutingTargetFromProcedureAndFamily(
  pc: ProcedureClass,
  reportFamily: ReportFamily
): RoutingTarget {
  if (PROCEDURE_IMAGING.has(pc)) return "imaging_extractor";
  if (PROCEDURE_LAB.has(pc)) return "lab_extractor";
  if (PROCEDURE_WAVEFORM.has(pc)) return "waveform_extractor";
  if (PROCEDURE_DOCUMENT.has(pc)) return "document_extractor";
  if (pc === "unknown") {
    switch (reportFamily) {
      case "laboratory":
        return "lab_extractor";
      case "waveform":
        return "waveform_extractor";
      case "document":
        return "document_extractor";
      case "imaging":
        return "imaging_extractor";
      default:
        return "imaging_extractor";
    }
  }
  return "imaging_extractor";
}

const LATERALITY_SET = new Set<string>([
  "left",
  "right",
  "bilateral",
  "midline",
  "none",
  "unknown",
]);

const LOC_PREC_SET = new Set<string>(["broad", "moderate", "high", "exact"]);

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export const MAPPER_SYSTEM_EN = `You are the RapiMed Procedure, Modality, and Anatomy Mapper.

Your job is to map one coherent or provisionally coherent medical group into:
- procedure_class
- report_family
- anatomy hierarchy
- routing suitability (routing_decision)

You do not diagnose.
You do not reject a clearly medical rendered-image group only because metadata is sparse.
You do not let filenames outweigh medical-image coherence.

INPUTS (INPUTS_JSON):
- group_id, group_type, family
- all_file_level_metadata, prior_intake_signals
- ocr_text, dicom_tags_if_present, page_thumbnail_summaries (often null)
- number_of_files, number_of_pages, number_of_images
- source_provenance_quality (may include cohesion_action, group_confidence, provisional_group)

PRIMARY GOAL:
Map plausible rendered medical groups provisionally instead of rejecting them when the absence of metadata is the main weakness.

NON-NEGOTIABLE RULES:
1. Missing DICOM tags is NOT enough to reject procedure mapping.
2. Missing OCR text is NOT enough to reject procedure mapping.
3. Missing page thumbnail summaries is NOT enough to reject procedure mapping.
4. Missing patient identifiers is NOT enough to reject procedure mapping.
5. Missing study identifiers is NOT enough to reject procedure mapping.
6. Low-confidence intake metadata is NOT enough to reject procedure mapping if the group is still plausibly medical and coherent.
7. Conflicting or uninformative filenames are weak evidence and must not outweigh strong medical-image coherence.
8. If the group is provisionally coherent and visually consistent with rendered radiology, prefer provisional procedure mapping over reject.
9. Use the strongest available signals first: prior intake signals, group type, family, file-level metadata, upload cohesion.
10. Keep anatomy broad rather than wrong.
11. If fine-grained modality cannot be determined safely, map to the nearest reliable procedure class rather than rejecting a clearly medical group.
12. Only reject when the content cannot be mapped to any reliable medical procedure family at all.

PROCEDURE_CLASS ENUM:
projection_radiography | ct | mri | ultrasound | pet_or_nuclear | fluoroscopy_or_angiography | mammography | dental_imaging | ophthalmic_imaging | dermatology_photo | pathology_slide | ecg | eeg | emg | lab_panel | lab_single_report | radiology_report_document | pathology_report_document | clinical_note_document | medication_document | operative_note_document | generic_medical_document | unknown

REPORT_FAMILY ENUM:
imaging | laboratory | waveform | document | mixed_context

ANATOMY RULES:
1. Use broad anatomy when certainty is limited.
2. Do not infer disease to infer anatomy.
3. Do not force exact laterality or exact substructure unless directly supported.
4. If the group appears to be chest radiography or likely chest radiography, broad chest / respiratory / lungs mapping is preferred over reject.
5. If the content is medical but exact procedure class is uncertain, choose a broader still-medical class instead of reject when safe.

REJECTION RULES:
Reject (routing_decision="reject") only when one or more of these are true:
- content is not clearly medical
- group is strongly contradictory
- procedure family cannot be medically mapped even broadly
- the available signals are too weak to distinguish between medical and non-medical content

DO NOT reject for these reasons alone:
- no DICOM
- no OCR
- null page summaries
- weak filenames
- low-confidence intake metadata
- missing patient/date/study IDs

PROVISIONAL MAPPING RULE:
If the group is likely a rendered radiology subset, map provisionally to the nearest safe imaging procedure class and broad anatomy, then let later stages keep findings narrow. Set provisional_mapping true and routing_decision accept_provisional when appropriate.

Signal priority when present: DICOM and clear report headers outrank weak visual guess; keep raw modality codes in raw_modality_codes separate from procedure_class.

RETURN JSON ONLY — exactly this shape (no markdown fences, no prose outside JSON):
{
  "group_id": "string",
  "procedure_class": "projection_radiography | ct | mri | ultrasound | pet_or_nuclear | fluoroscopy_or_angiography | mammography | dental_imaging | ophthalmic_imaging | dermatology_photo | pathology_slide | ecg | eeg | emg | lab_panel | lab_single_report | radiology_report_document | pathology_report_document | clinical_note_document | medication_document | operative_note_document | generic_medical_document | unknown",
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
  },
  "mapping_confidence": 0.0,
  "provisional_mapping": false,
  "mapping_rationale": ["string"],
  "mapping_conflicts": ["string"],
  "routing_decision": "accept | accept_provisional | reject"
}

FAIL-SAFE:
If the group is clearly medical but exact mapping is weak, choose accept_provisional with broad anatomy and the nearest safe procedure class; set provisional_mapping true.
Use reject only when no reliable medical mapping is possible at all.`;

export const MAPPER_SYSTEM_TR = `Sen RapiMed Prosedür, Modalite ve Anatomi Eşleyicisisin.

Görevin: tek tutarlı veya provizyonel tutarlı tıbbi grubu procedure_class, report_family, anatomi hiyerarşisi ve routing_decision ile eşlemek.

Tanı koymazsın. Seyrek meta veri yüzünden açıkça tıbbi render görüntü grubunu reddetme. Dosya adları tıbbi-görsel tutarlılığı yenemez.

PRIMARY GOAL: Ana zayıflık meta veri eksikliğiyse provizyonel eşleme; gereksiz reject yok.

İHMAL EDİLEMEZ (1–12, EN ile aynı): DICOM/OCR/sayfa özeti/hasta-çalışma kimliği/tarih veya düşük güvenli intake tek başına reject değil; provizyonel tutarlı + render radyoloji uyumu → provizyonel eşleme; önce intake, grup tipi, aile, dosya meta, cohesion; anatomi yanlış daraltma yerine geniş; güvenli modalite belirsizse en yakın güvenli prosedür sınıfı; yalnızca hiç güvenilir tıbbi prosedür ailesine eşlenemiyorsa reject.

report_family: imaging | laboratory | waveform | document | mixed_context
routing_decision: accept | accept_provisional | reject

ANATOMİ: belirsizlikte geniş; hastalıktan anatomi çıkarma; lateralite/alt yapı zorlama yok; olası göğüs grafisi → geniş göğüs/solunum/akciğer tercih, reject değil.

REDDETME: tıbbi değil; güçlü çelişki; geniş bile olsa prosedür ailesi eşlenemiyor; tıbbi/tıbbi olmayan ayrımı için sinyal çok zayıf. DICOM/OCR/null özet/zayıf dosya adı/düşük güven eksik kimlik tek başına reject değil.

PROVİZYONEL: olası render radyoloji alt kümesi → en yakın güvenli görüntüleme procedure_class + geniş anatomi; provisional_mapping true, routing_decision accept_provisional uygunsa.

ÇIKTI: Yalnızca geçerli JSON; EN şeması ile birebir anahtarlar (İngilizce enumlar).

FAIL-SAFE: açıkça tıbbi ama zayıf kesinlik → accept_provisional, geniş anatomi, en yakın güvenli sınıf; reject yalnızca güvenilir tıbbi eşleme hiç mümkün değilse.`;

export function buildProcedureMapperPrompt(
  language: "tr" | "en",
  input: ProcedureMapperInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? MAPPER_SYSTEM_TR : MAPPER_SYSTEM_EN;
  return `${discipline}${spec}

Return ONLY valid JSON matching the schema. No markdown fences. Use group_id from INPUTS_JSON.

INPUTS_JSON:
${JSON.stringify(input, null, 2)}`;
}

export function parseAnatomy(raw: unknown): AnatomyHierarchy {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lat = String(d.laterality ?? "unknown");
  const lp = String(d.location_precision ?? "broad");
  return {
    body_region: String(d.body_region ?? ""),
    organ_system: String(d.organ_system ?? ""),
    primary_structure: String(d.primary_structure ?? ""),
    substructures: Array.isArray(d.substructures) ? d.substructures.map(String) : [],
    laterality: LATERALITY_SET.has(lat) ? (lat as AnatomyLaterality) : "unknown",
    level_or_segment:
      d.level_or_segment == null || d.level_or_segment === "" ? null : String(d.level_or_segment),
    location_precision: LOC_PREC_SET.has(lp) ? (lp as LocationPrecision) : "broad",
  };
}

function parseConfidence(raw: unknown): ConfidenceBreakdown {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    metadata_support: clamp01(Number(d.metadata_support)),
    ocr_support: clamp01(Number(d.ocr_support)),
    visual_support: clamp01(Number(d.visual_support)),
    cross_file_support: clamp01(Number(d.cross_file_support)),
    overall: clamp01(Number(d.overall)),
  };
}

function parseReportFamily(v: unknown): ReportFamily | null {
  const s = String(v ?? "");
  return REPORT_FAMILY_SET.has(s) ? (s as ReportFamily) : null;
}

function parseRoutingDecision(v: unknown): MapperRoutingDecision | null {
  const s = String(v ?? "");
  return ROUTING_DECISION_SET.has(s) ? (s as MapperRoutingDecision) : null;
}

function synthesizeConfidenceBreakdown(overall: number, legacy: unknown): ConfidenceBreakdown {
  const base = legacy ? parseConfidence(legacy) : null;
  const o = clamp01(overall);
  if (base) {
    return { ...base, overall: o };
  }
  return {
    metadata_support: 0,
    ocr_support: 0,
    visual_support: o,
    cross_file_support: 0,
    overall: o,
  };
}

export function parseProcedureMapperResult(
  raw: unknown,
  fallbackGroupId: string
): ProcedureMapperResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pc = String(o.procedure_class ?? "");
  if (!PROCEDURE_SET.has(pc)) return null;
  const procedureClass = pc as ProcedureClass;
  const sp = String(o.study_purpose ?? "unknown");
  const studyPurpose = STUDY_PURPOSE_SET.has(sp) ? (sp as StudyPurpose) : "unknown";

  let reportFamily = parseReportFamily(o.report_family);
  if (!reportFamily) {
    reportFamily = inferReportFamilyForProcedureClass(procedureClass);
  }

  const legacyRt = String(o.routing_target ?? "");
  const explicitDecision = parseRoutingDecision(o.routing_decision);

  let routingDecision: MapperRoutingDecision;
  let routingTarget: RoutingTarget;

  if (explicitDecision != null) {
    routingDecision = explicitDecision;
    routingTarget =
      routingDecision === "reject"
        ? "reject"
        : inferRoutingTargetFromProcedureAndFamily(procedureClass, reportFamily);
  } else if (ROUTING_SET.has(legacyRt)) {
    routingTarget = legacyRt as RoutingTarget;
    routingDecision = legacyRt === "reject" ? "reject" : "accept";
  } else {
    routingDecision = "accept_provisional";
    routingTarget = inferRoutingTargetFromProcedureAndFamily(procedureClass, reportFamily);
  }

  let mappingConfidence: number;
  if (
    typeof o.mapping_confidence === "number" ||
    (typeof o.mapping_confidence === "string" && String(o.mapping_confidence).trim() !== "")
  ) {
    mappingConfidence = clamp01(Number(o.mapping_confidence));
    if (Number.isNaN(mappingConfidence)) mappingConfidence = 0.45;
  } else if (o.confidence_breakdown && typeof o.confidence_breakdown === "object") {
    mappingConfidence = clamp01(parseConfidence(o.confidence_breakdown).overall);
    if (Number.isNaN(mappingConfidence)) mappingConfidence = 0.45;
  } else {
    mappingConfidence = 0.45;
  }

  const provisionalMapping =
    typeof o.provisional_mapping === "boolean"
      ? o.provisional_mapping
      : routingDecision === "accept_provisional";

  const contentSubtype =
    String(o.content_subtype ?? "").trim() ||
    (procedureClass === "unknown" ? "unmapped" : procedureClass);

  return {
    group_id: String(o.group_id ?? fallbackGroupId),
    procedure_class: procedureClass,
    raw_modality_codes: Array.isArray(o.raw_modality_codes)
      ? o.raw_modality_codes.map(String)
      : [],
    study_purpose: studyPurpose,
    report_family: reportFamily,
    anatomy: parseAnatomy(o.anatomy),
    mapping_confidence: mappingConfidence,
    provisional_mapping: provisionalMapping,
    mapping_rationale: Array.isArray(o.mapping_rationale)
      ? o.mapping_rationale.map(String)
      : [],
    mapping_conflicts: Array.isArray(o.mapping_conflicts)
      ? o.mapping_conflicts.map(String)
      : [],
    routing_decision: routingDecision,
    routing_target: routingTarget,
    content_subtype: contentSubtype,
    confidence_breakdown: synthesizeConfidenceBreakdown(
      mappingConfidence,
      o.confidence_breakdown
    ),
  };
}

export function defaultProcedureMapperResult(
  groupId: string,
  perImageIntake: PerImageIntakeResult[]
): ProcedureMapperResult {
  const families = [...new Set(perImageIntake.map((p) => p.intake_family ?? p.upload_type))].join(
    ", "
  );
  const reportFamily: ReportFamily = "imaging";
  const mappingConfidence = 0.25;
  return {
    group_id: groupId,
    procedure_class: "unknown",
    raw_modality_codes: [],
    study_purpose: "unknown",
    report_family: reportFamily,
    anatomy: {
      body_region: "",
      organ_system: "",
      primary_structure: "",
      substructures: [],
      laterality: "unknown",
      level_or_segment: null,
      location_precision: "broad",
    },
    mapping_confidence: mappingConfidence,
    provisional_mapping: true,
    mapping_rationale: ["mapper_unavailable_or_parse_failed", `families:${families}`],
    mapping_conflicts: [],
    routing_decision: "accept_provisional",
    routing_target: inferRoutingTargetFromProcedureAndFamily("unknown", reportFamily),
    content_subtype: "unmapped",
    confidence_breakdown: synthesizeConfidenceBreakdown(mappingConfidence, null),
  };
}

/**
 * Primary group for mapping: first imaging_study_group, else first non-excluded group, else synthetic merged_batch over all upload indices.
 */
export function pickPrimaryGroupForProcedureMapping(
  cohesion: UploadCohesionResult,
  totalFiles: number
): CohesionGroup {
  const groups = cohesion.groups;
  const imaging = groups.find((g) => g.group_type === "imaging_study_group");
  if (imaging) return imaging;
  const nonExcluded = groups.find((g) => g.group_type !== "excluded_group");
  if (nonExcluded) return nonExcluded;
  const ids = Array.from({ length: totalFiles }, (_, i) => fileIdForUploadIndex(i));
  return {
    group_id: "merged_batch",
    group_type: "mixed_context_bundle",
    included_file_ids: ids,
    excluded_file_ids: [],
    group_confidence: 0.35,
    group_rationale: ["procedure_mapper_merged_batch_fallback"],
    patient_match_status: "unknown",
    time_match_status: "unknown",
    anatomy_match_status: "unknown",
    family_match_status: "mixed_but_supported",
    provisional_group: false,
  };
}

export function buildProcedureMapperInputFromPipeline(params: {
  cohesion: UploadCohesionResult | null;
  perImageIntake: PerImageIntakeResult[];
  preparedImages: Array<{
    fileName: string;
    originalMimeType: string;
    cleanBase64: string;
  }>;
}): ProcedureMapperInput {
  const { cohesion, perImageIntake, preparedImages } = params;
  const primary =
    cohesion != null
      ? pickPrimaryGroupForProcedureMapping(cohesion, preparedImages.length)
      : null;
  const group_id = primary?.group_id ?? "batch-unified";
  const group_type = primary?.group_type ?? "imaging_study_group";

  const families = [
    ...new Set(perImageIntake.map((p) => p.intake_family ?? p.upload_type)),
  ];
  const family = families.join("|") || "unknown";

  const all_file_level_metadata = preparedImages.map((img, i) => {
    const intake = perImageIntake.find((p) => p.imageIndex === i);
    const dicom_modality_routing_truth = normalizeDicomModalityCode(
      intake?.modality_guess
    );
    return {
      file_index: i,
      fileName: img.fileName,
      mime_type: img.originalMimeType,
      file_size_bytes: Math.max(0, Math.floor((img.cleanBase64.length * 3) / 4)),
      upload_type: intake?.upload_type,
      intake_family: intake?.intake_family,
      diagnostic_value: intake?.diagnostic_value,
      confidence: intake?.confidence,
      reasons: intake?.reasons,
      dicom_modality_routing_truth,
      fhir_storage_hint_primary: dicom_modality_routing_truth
        ? FHIR_RESOURCE_HINT.imaging_study
        : FHIR_RESOURCE_HINT.document_reference,
    };
  });

  const prior_intake_signals = perImageIntake.map((p) => ({
    imageIndex: p.imageIndex,
    fileName: p.fileName,
    upload_type: p.upload_type,
    intake_family: p.intake_family,
    diagnostic_value: p.diagnostic_value,
    contains_report_text: p.contains_report_text,
    quarantine_suggested: p.quarantine_suggested,
  }));

  return {
    group_id,
    group_type,
    family,
    all_file_level_metadata,
    ocr_text: null,
    dicom_tags_if_present: null,
    prior_intake_signals,
    number_of_files: preparedImages.length,
    number_of_pages: null,
    number_of_images: preparedImages.length,
    page_thumbnail_summaries: null,
    source_provenance_quality: {
      cohesion_action: cohesion?.process_action ?? "unknown",
      group_confidence: primary?.group_confidence ?? null,
      provisional_group: primary?.provisional_group ?? false,
    },
  };
}
