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
  content_subtype: string;
  anatomy: AnatomyHierarchy;
  routing_target: RoutingTarget;
  confidence_breakdown: ConfidenceBreakdown;
  mapping_rationale: string[];
  mapping_conflicts: string[];
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

You inspect exactly ONE coherent file or ONE coherent group.
You do not diagnose.
You do not create findings.
You only classify procedure, modality class, anatomy, location specificity, and study purpose.

INPUTS:
- group_id
- group_type
- family
- all file-level metadata for the group
- OCR text
- DICOM tags if present
- prior intake signals
- number_of_files
- number_of_pages
- number_of_images
- page thumbnails or quick visual summaries
- source provenance quality indicators

PRIMARY OUTPUTS:
1. procedure_class
2. raw_modality_codes if present
3. anatomy hierarchy
4. laterality (inside anatomy object)
5. sub-location precision (location_precision)
6. study purpose and content subtype
7. routing target for the next extractor

PROCEDURE_CLASS ENUM:
- projection_radiography
- ct
- mri
- ultrasound
- pet_or_nuclear
- fluoroscopy_or_angiography
- mammography
- dental_imaging
- ophthalmic_imaging
- dermatology_photo
- pathology_slide
- ecg
- eeg
- emg
- lab_panel
- lab_single_report
- radiology_report_document
- pathology_report_document
- clinical_note_document
- medication_document
- operative_note_document
- generic_medical_document
- unknown

ANATOMY HIERARCHY FORMAT:
{
  "body_region": "string",
  "organ_system": "string",
  "primary_structure": "string",
  "substructures": ["string"],
  "laterality": "left | right | bilateral | midline | none | unknown",
  "level_or_segment": "string or null",
  "location_precision": "broad | moderate | high | exact"
}

RULES:
1. DICOM metadata outranks OCR and visual guess.
2. Clear report titles outrank weak visual impressions.
3. If anatomy is uncertain, keep it broad rather than wrong.
4. Use specific anatomy when directly supported.
5. Do not assign a disease to infer anatomy.
6. If the content is a lab report, anatomy may be "systemic" or specimen-specific rather than organ-specific.
7. If the content is a generic medical document, do not force anatomy.
8. If a radiology image includes multiple visible regions, select the intended primary target if supported; otherwise use the broader region.
9. Keep raw modality codes separate from internal procedure_class.
10. Never force unknown into CT/MR/X-ray without strong evidence.

RETURN EXACTLY THIS JSON:
{
  "group_id": "string",
  "procedure_class": "enum",
  "raw_modality_codes": ["string"],
  "study_purpose": "diagnostic | screening | follow_up | pre_op | post_op | unknown",
  "content_subtype": "string",
  "anatomy": {
    "body_region": "string",
    "organ_system": "string",
    "primary_structure": "string",
    "substructures": ["string"],
    "laterality": "left | right | bilateral | midline | none | unknown",
    "level_or_segment": null,
    "location_precision": "broad | moderate | high | exact"
  },
  "routing_target": "imaging_extractor | lab_extractor | waveform_extractor | document_extractor | reject",
  "confidence_breakdown": {
    "metadata_support": 0.0,
    "ocr_support": 0.0,
    "visual_support": 0.0,
    "cross_file_support": 0.0,
    "overall": 0.0
  },
  "mapping_rationale": [
    "string"
  ],
  "mapping_conflicts": [
    "string"
  ]
}

FAIL SAFE:
If routing is not reliable, set routing_target="reject" and explain why in mapping_conflicts.`;

export const MAPPER_SYSTEM_TR = `Sen RapiMed Prosedür, Modalite ve Anatomi Eşleyicisisin.

Tam olarak TEK tutarlı dosya veya TEK tutarlı grubu incelersin.
Tanı koymazsın.
Bulgu üretmezsin.
Yalnızca prosedür, modalite sınıfı, anatomi, konum özgüllüğü ve çalışma amacını sınıflandırırsın.

Girdiler: group_id, group_type, family, dosya meta verileri, OCR, DICOM (varsa), intake sinyalleri, sayılar, küçük görsel özetler, provenance kalitesi.

procedure_class ve routing_target İngilizce enum değerleriyle JSON döndür.
routing_target: imaging_extractor | lab_extractor | waveform_extractor | document_extractor | reject
Güvenilir değilse reject ve mapping_conflicts içinde gerekçe.

Kurallar (özet): DICOM > OCR > zayıf görsel; belirsiz anatomide geniş tut; hastalıktan anatomi çıkarma; lab için systemic/specimen; generic belgede anatomiyi zorlama; raw modality kodlarını ayrı tut; CT/MR/X-ray için güçlü kanıt olmadan zorlama.`;

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

export function parseProcedureMapperResult(
  raw: unknown,
  fallbackGroupId: string
): ProcedureMapperResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pc = String(o.procedure_class ?? "");
  if (!PROCEDURE_SET.has(pc)) return null;
  const sp = String(o.study_purpose ?? "unknown");
  const studyPurpose = STUDY_PURPOSE_SET.has(sp) ? (sp as StudyPurpose) : "unknown";
  const rt = String(o.routing_target ?? "");
  if (!ROUTING_SET.has(rt)) return null;

  return {
    group_id: String(o.group_id ?? fallbackGroupId),
    procedure_class: pc as ProcedureClass,
    raw_modality_codes: Array.isArray(o.raw_modality_codes)
      ? o.raw_modality_codes.map(String)
      : [],
    study_purpose: studyPurpose,
    content_subtype: String(o.content_subtype ?? ""),
    anatomy: parseAnatomy(o.anatomy),
    routing_target: rt as RoutingTarget,
    confidence_breakdown: parseConfidence(o.confidence_breakdown),
    mapping_rationale: Array.isArray(o.mapping_rationale)
      ? o.mapping_rationale.map(String)
      : [],
    mapping_conflicts: Array.isArray(o.mapping_conflicts)
      ? o.mapping_conflicts.map(String)
      : [],
  };
}

export function defaultProcedureMapperResult(
  groupId: string,
  perImageIntake: PerImageIntakeResult[]
): ProcedureMapperResult {
  const families = [...new Set(perImageIntake.map((p) => p.intake_family ?? p.upload_type))].join(
    ", "
  );
  return {
    group_id: groupId,
    procedure_class: "unknown",
    raw_modality_codes: [],
    study_purpose: "unknown",
    content_subtype: "unmapped",
    anatomy: {
      body_region: "",
      organ_system: "",
      primary_structure: "",
      substructures: [],
      laterality: "unknown",
      level_or_segment: null,
      location_precision: "broad",
    },
    routing_target: "imaging_extractor",
    confidence_breakdown: {
      metadata_support: 0,
      ocr_support: 0,
      visual_support: 0,
      cross_file_support: 0,
      overall: 0.25,
    },
    mapping_rationale: ["mapper_unavailable_or_parse_failed", `families:${families}`],
    mapping_conflicts: [],
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
    },
  };
}
