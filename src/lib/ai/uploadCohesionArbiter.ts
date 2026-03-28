/**
 * RapiMed upload cohesion and grouping router — batch-level grouping, quarantine, process_action.
 * Text-only Vertex call; no diagnosis or final report.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type { PerImageIntakeResult } from "./intakePrompts";

export type ProcessAction =
  | "cancel"
  | "continue"
  | "continue_with_quarantine"
  | "continue_provisional";

export type CohesionGroupType =
  | "imaging_study_group"
  | "lab_report_group"
  | "pathology_group"
  | "waveform_group"
  | "clinical_document_group"
  | "mixed_context_bundle"
  | "excluded_group";

export type CohesionPatientMatch =
  | "matched"
  | "partially_matched"
  | "unknown"
  | "conflicting";

export type CohesionTimeMatch =
  | "matched"
  | "approximate"
  | "unknown"
  | "conflicting";

export type CohesionAnatomyMatch =
  | "matched"
  | "related"
  | "unknown"
  | "conflicting";

export type CohesionFamilyMatch =
  | "matched"
  | "mixed_but_supported"
  | "conflicting";

export interface ArbiterIntakeResultRow {
  file_id: string;
  original_filename: string;
  image_index: number;
  is_medical: boolean;
  family: string;
  confidence_overall: number;
  quarantine_suggested: boolean;
  quarantine_reason: string | null;
  upload_type: string;
  diagnostic_value: string;
  reasons: string[];
}

export interface NormalizedFileMeta {
  file_id: string;
  original_filename: string;
  mime_type: string;
  extension: string;
  file_size_bytes: number;
  upload_order_index: number;
}

export interface UploadCohesionArbiterInput {
  upload_batch_id: string;
  intake_results: ArbiterIntakeResultRow[];
  normalized_metadata_per_file: NormalizedFileMeta[];
  extracted_dates: string[] | null;
  /** Patient linkage clues when available (names, MRN fragments, etc.). */
  patient_identifiers: string[] | null;
  /** Study linkage clues when available (accession, study UID hints, etc.). */
  study_identifiers: string[] | null;
  /** Per-file OCR summaries. */
  page_level_ocr_summaries: Array<{ file_id: string; summary: string }> | null;
  /** Per-file quick visual summaries when available (same shape as OCR summaries). */
  quick_visual_summaries: Array<{ file_id: string; summary: string }> | null;
  upload_count: number;
  original_file_order: string[];
}

export interface CohesionGroup {
  group_id: string;
  group_type: CohesionGroupType;
  included_file_ids: string[];
  /** File IDs scoped to this grouping context but explicitly not in the coherent subset for this group. */
  excluded_file_ids: string[];
  group_confidence: number;
  group_rationale: string[];
  patient_match_status: CohesionPatientMatch;
  time_match_status: CohesionTimeMatch;
  anatomy_match_status: CohesionAnatomyMatch;
  family_match_status: CohesionFamilyMatch;
  /** True when grouping is allowed to proceed but linkage evidence is weaker than full confidence. */
  provisional_group: boolean;
}

export interface QuarantinedFileRef {
  file_id: string;
  reason: string;
  severity: "low" | "medium" | "high";
}

export interface CanceledFileRef {
  file_id: string;
  reason: string;
}

export interface UploadCohesionResult {
  upload_batch_id: string;
  process_action: ProcessAction;
  overall_reason: string;
  groups: CohesionGroup[];
  quarantined_files: QuarantinedFileRef[];
  canceled_files: CanceledFileRef[];
  user_clarification_needed: boolean;
  clarification_questions: string[];
}

export function fileIdForUploadIndex(imageIndex: number): string {
  return `upload-${imageIndex}`;
}

const GROUP_TYPES = new Set<string>([
  "imaging_study_group",
  "lab_report_group",
  "pathology_group",
  "waveform_group",
  "clinical_document_group",
  "mixed_context_bundle",
  "excluded_group",
]);

const PROCESS_ACTIONS = new Set<string>([
  "cancel",
  "continue",
  "continue_with_quarantine",
  "continue_provisional",
]);

const CLASSIFIER_EXCLUDED_FAMILIES = new Set([
  "administrative_nonclinical",
  "non_medical",
  "corrupted_or_unreadable",
]);

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function familyToDefaultGroupType(family: string): CohesionGroupType {
  if (
    family === "dicom_imaging" ||
    family === "rendered_radiology_image" ||
    family === "rendered_pathology_image" ||
    family === "diagnostic-image" ||
    family === "viewer-screenshot" ||
    family === "localizer"
  ) {
    return "imaging_study_group";
  }
  if (family === "pathology_report") return "pathology_group";
  if (family === "lab_report") return "lab_report_group";
  if (family.startsWith("waveform_")) return "waveform_group";
  if (family === "report-image") return "clinical_document_group";
  return "clinical_document_group";
}

/**
 * Single-file batch: no LLM; deterministic cohesion from intake only.
 */
export function synthesizeCohesionSingleFile(
  input: UploadCohesionArbiterInput
): UploadCohesionResult {
  const row = input.intake_results[0]!;
  const fid = row.file_id;
  const excluded =
    !row.is_medical ||
    CLASSIFIER_EXCLUDED_FAMILIES.has(row.family) ||
    row.upload_type === "non-diagnostic";

  if (excluded) {
    return {
      upload_batch_id: input.upload_batch_id,
      process_action: "cancel",
      overall_reason:
        "Single file is non-medical, excluded, or non-diagnostic; no coherent study to analyze.",
      groups: [
        {
          group_id: "g_excluded_0",
          group_type: "excluded_group",
          included_file_ids: [fid],
          excluded_file_ids: [],
          group_confidence: clamp01(row.confidence_overall),
          group_rationale: row.reasons.slice(0, 4),
          patient_match_status: "unknown",
          time_match_status: "unknown",
          anatomy_match_status: "unknown",
          family_match_status: "conflicting",
          provisional_group: false,
        },
      ],
      quarantined_files: [],
      canceled_files: [{ file_id: fid, reason: "excluded_or_non_medical" }],
      user_clarification_needed: false,
      clarification_questions: [],
    };
  }

  const gt = familyToDefaultGroupType(row.family);
  return {
    upload_batch_id: input.upload_batch_id,
    process_action: "continue",
    overall_reason: "Single coherent upload; no cross-file merge required.",
    groups: [
      {
        group_id: "g0",
        group_type: gt,
        included_file_ids: [fid],
        excluded_file_ids: [],
        group_confidence: clamp01(row.confidence_overall),
        group_rationale: ["single_file", ...row.reasons.slice(0, 3)],
        patient_match_status: "unknown",
        time_match_status: "unknown",
        anatomy_match_status: "unknown",
        family_match_status: "matched",
        provisional_group: false,
      },
    ],
    quarantined_files: [],
    canceled_files: [],
    user_clarification_needed: false,
    clarification_questions: [],
  };
}

export function buildUploadCohesionArbiterInput(params: {
  upload_batch_id: string;
  perImageIntake: PerImageIntakeResult[];
  preparedImages: Array<{
    fileName: string;
    originalMimeType: string;
    cleanBase64: string;
  }>;
}): UploadCohesionArbiterInput {
  const { upload_batch_id, perImageIntake, preparedImages } = params;
  const intake_results: ArbiterIntakeResultRow[] = perImageIntake.map((p) => {
    const file_id = fileIdForUploadIndex(p.imageIndex);
    return {
      file_id,
      original_filename: p.fileName,
      image_index: p.imageIndex,
      is_medical: p.intake_is_medical ?? p.upload_type !== "non-diagnostic",
      family: p.intake_family ?? p.upload_type,
      confidence_overall: Math.min(1, Math.max(0, (p.confidence ?? 0) / 100)),
      quarantine_suggested: p.quarantine_suggested ?? false,
      quarantine_reason: p.quarantine_reason ?? null,
      upload_type: p.upload_type,
      diagnostic_value: p.diagnostic_value,
      reasons: p.reasons ?? [],
    };
  });

  const normalized_metadata_per_file: NormalizedFileMeta[] = preparedImages.map((img, i) => {
    const dot = img.fileName.lastIndexOf(".");
    return {
      file_id: fileIdForUploadIndex(i),
      original_filename: img.fileName,
      mime_type: img.originalMimeType,
      extension: dot >= 0 ? img.fileName.slice(dot).toLowerCase() : "",
      file_size_bytes: Math.max(0, Math.floor((img.cleanBase64.length * 3) / 4)),
      upload_order_index: i,
    };
  });

  return {
    upload_batch_id,
    intake_results,
    normalized_metadata_per_file,
    extracted_dates: null,
    patient_identifiers: null,
    study_identifiers: null,
    page_level_ocr_summaries: null,
    quick_visual_summaries: null,
    upload_count: preparedImages.length,
    original_file_order: preparedImages.map((_, i) => fileIdForUploadIndex(i)),
  };
}

const ARBITER_SYSTEM_EN = `You are the RapiMed Upload Cohesion and Grouping Router.

You do not diagnose.
You do not write the final report.
You do not invent file relationships.

You only decide:
- whether the upload contains usable medical material
- which files form coherent groups
- which files should be quarantined
- whether processing should continue, continue_with_quarantine, continue_provisional, or cancel

INPUTS (see INPUTS_JSON; field names in JSON may use snake_case equivalents):
- upload_batch_id
- intake_results[] from Single-File Intake Classifier
- normalized_metadata_per_file
- OCR summaries (e.g. page_level_ocr_summaries)
- quick visual summaries (e.g. quick_visual_summaries) when present
- extracted dates if available (extracted_dates)
- patient linkage clues if available (patient_identifiers)
- study linkage clues if available (study_identifiers)
- upload_count
- original file order (original_file_order)

GROUP TYPES:
imaging_study_group | lab_report_group | pathology_group | waveform_group | clinical_document_group | mixed_context_bundle | excluded_group

PROCESS ACTION ENUM:
continue | continue_with_quarantine | continue_provisional | cancel

KEY DISTINCTIONS (these are NOT the same):
1) medical validity  2) grouping confidence  3) patient/study identity certainty

PRIMARY RESPONSIBILITY:
Avoid false merge and avoid false cancel.
If a plausible coherent medical subset exists, preserve it.

CRITICAL RULES:
1. Missing patient name, accession number, study ID, or date does NOT by itself justify cancel.
2. Rendered medical images frequently lack DICOM metadata and still must be processed when they form a plausible coherent subset.
3. If two or more files are visually medical, share the same likely anatomy or procedure family, and were uploaded together, prefer provisional grouping over cancel unless strong contradictory evidence exists.
4. Cancel only when there is no usable coherent medical subset.
5. If at least one coherent medical subset exists, prefer continue_with_quarantine or continue_provisional over cancel.
6. Administrative absence is not the same as medical incoherence.
7. A random accidental file must not poison the entire upload set.
8. Identity conflicts, explicit anatomy conflicts, or explicit family conflicts are stronger than missing metadata.
9. Imaging plus a related report can be grouped as mixed_context_bundle only when evidence directly supports linkage.
10. Non-medical or administrative files must never influence medical grouping.
11. If two files are likely frontal/lateral or otherwise complementary views of one rendered radiology study, group them even if DICOM metadata is absent.
12. If multiple unrelated valid studies exist, split them. Do not force one report.
13. If intake weakness appears caused by missing OCR or missing visual summary rather than contradictory evidence, prefer continue_provisional over cancel when files are still plausibly coherent medical images.
14. Low diagnostic utility is not the same as non-groupable.
15. Unknown linkability is not equivalent to contradiction.

GROUPING EVIDENCE PRIORITY (strongest first):
1. Same explicit study or patient identifiers
2. Same family and same procedure class
3. Same anatomy
4. Complementary view relationship
5. Same upload session and strong visual consistency
6. Similar OCR or overlay wording
7. Same institution or report header

NEGATIVE EVIDENCE:
- clearly different anatomy
- clearly different modality/procedure class
- clearly different patient identifiers
- clearly different time/course information
- non-medical content
- contradictory report headers

GROUPABILITY LOGIC (use these ideas internally; do not output):
- medical_visual_match
- anatomy_consistency
- modality_or_procedure_consistency
- upload_session_proximity
- complementary_view_likelihood
- metadata_linkage

Missing metadata should weaken confidence, not force cancel.

PROCESS ACTION SEMANTICS:
- cancel: no usable coherent medical subset or contradictions too strong
- continue: coherent groups with strong evidence; no provisional caveat needed
- continue_with_quarantine: coherent subset plus explicit quarantine or exclusions
- continue_provisional: coherent subset is plausible but linkage/identity evidence is limited; set provisional_group true on affected groups

RETURN EXACTLY THIS JSON:
{
  "upload_batch_id": "string",
  "process_action": "continue | continue_with_quarantine | continue_provisional | cancel",
  "overall_reason": "string",
  "groups": [
    {
      "group_id": "string",
      "group_type": "imaging_study_group | lab_report_group | pathology_group | waveform_group | clinical_document_group | mixed_context_bundle | excluded_group",
      "included_file_ids": ["string"],
      "excluded_file_ids": ["string"],
      "group_confidence": 0.0,
      "group_rationale": ["string"],
      "patient_match_status": "matched | partially_matched | unknown | conflicting",
      "time_match_status": "matched | approximate | unknown | conflicting",
      "anatomy_match_status": "matched | related | unknown | conflicting",
      "family_match_status": "matched | mixed_but_supported | conflicting",
      "provisional_group": false
    }
  ],
  "quarantined_files": [
    { "file_id": "string", "reason": "string", "severity": "low | medium | high" }
  ],
  "canceled_files": [{ "file_id": "string", "reason": "string" }],
  "user_clarification_needed": false,
  "clarification_questions": ["string"]
}

CANCEL ONLY WHEN:
- all files are non-medical, corrupted, or excluded
- no coherent medical subset can be formed
- contradictions are too strong for safe grouping
- upload is dominated by unrelated noise with no usable medical group

FORBIDDEN: diagnosis; findings summary; disease inference; hidden grouping assumptions.`;

const ARBITER_SYSTEM_TR = `Sen RapiMed Yükleme Uyumu ve Gruplama Yönlendiricisin (Router).

Tanı koymazsın; nihai raporu yazmazsın; dosya ilişkisi uydurmazsın.

Yalnızca: kullanılabilir tıbbi içerik, tutarlı gruplar, karantina, process_action (continue | continue_with_quarantine | continue_provisional | cancel).

GİRDİLER: INPUTS_JSON — upload_batch_id, intake_results[], normalized_metadata_per_file, OCR özetleri (page_level_ocr_summaries), quick_visual_summaries, extracted_dates, hasta bağlantı ipuçları (patient_identifiers), çalışma bağlantı ipuçları (study_identifiers), upload_count, original_file_order.

GRUP TÜRLERİ ve İngilizce enum değerleri EN şema ile aynı.

ANA SORUMLULUK: Yanlış birleştirmeden ve yanlış iptalden kaçın; olası tutarlı tıbbi alt küme varsa koru.

ÖNEMLİ AYRIMLAR: tıbbi geçerlilik ≠ gruplama güveni ≠ hasta/çalışma kimlik kesinliği.

İLKELER (1–15, EN ile aynı mantık): Eksik tanımlayıcılar tek başına cancel değildir; render görüntüler DICOM olmadan işlenebilir; birlikte yüklenen uyumlu tıbbi dosyalarda güçlü çelişki yoksa cancel yerine continue_provisional yeğlenir; tutarlı alt küme yoksa cancel; varsa continue_with_quarantine veya continue_provisional; idari eksiklik ≠ tıbbi tutarsızlık; tek yanlış dosya tüm seti zehirlemez; kimlik/anatomi/aile çelişkisi eksik üst veriden güçlüdür; mixed_context yalnızca doğrudan bağlantı kanıtıyla; idari dosyalar tıbbi gruplamayı etkilemez; tamamlayıcı görünümler DICOM olmadan gruplanabilir; ilişkisiz çalışmalar ayrılır; eksik OCR/görsel özet çelişki değilse ve dosyalar hâlâ tutarlı tıbbi görüntü ise continue_provisional yeğlenir; düşük tanısal yarar ≠ gruplanamaz; bilinmeyen bağlanabilirlik ≠ çelişki.

NEGATİF KANIT: belirgin farklı anatomi/modalite/hasta/zaman seyri; tıbbi olmayan içerik; çelişkili rapor başlıkları.

GRUPLANABİLİRLİK (içsel, çıktıya yazma): medical_visual_match, anatomy_consistency, modality_or_procedure_consistency, upload_session_proximity, complementary_view_likelihood, metadata_linkage — eksik metadata güveni düşürür, zorla cancel ettirmez.

ÇIKTI: Yukarıdaki İngilizce JSON şeması ile birebir aynı anahtarlar ve enum değerleri (yalnızca JSON).`;

export function buildUploadCohesionArbiterPrompt(
  language: "tr" | "en",
  input: UploadCohesionArbiterInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? ARBITER_SYSTEM_TR : ARBITER_SYSTEM_EN;
  return `${discipline}${spec}

Return ONLY valid JSON matching the schema above. No markdown fences. Use the upload_batch_id from INPUTS_JSON.

INPUTS_JSON:
${JSON.stringify(input, null, 2)}`;
}

const PATIENT_MATCH = new Set<string>([
  "matched",
  "partially_matched",
  "unknown",
  "conflicting",
]);
const TIME_MATCH = new Set<string>([
  "matched",
  "approximate",
  "unknown",
  "conflicting",
]);
const ANATOMY_MATCH = new Set<string>([
  "matched",
  "related",
  "unknown",
  "conflicting",
]);
const FAMILY_MATCH = new Set<string>([
  "matched",
  "mixed_but_supported",
  "conflicting",
]);

function parsePatientMatch(v: unknown): CohesionPatientMatch {
  const s = String(v ?? "unknown");
  return PATIENT_MATCH.has(s) ? (s as CohesionPatientMatch) : "unknown";
}

function parseTimeMatch(v: unknown): CohesionTimeMatch {
  const s = String(v ?? "unknown");
  return TIME_MATCH.has(s) ? (s as CohesionTimeMatch) : "unknown";
}

function parseAnatomyMatch(v: unknown): CohesionAnatomyMatch {
  const s = String(v ?? "unknown");
  return ANATOMY_MATCH.has(s) ? (s as CohesionAnatomyMatch) : "unknown";
}

function parseFamilyMatch(v: unknown): CohesionFamilyMatch {
  const s = String(v ?? "mixed_but_supported");
  return FAMILY_MATCH.has(s) ? (s as CohesionFamilyMatch) : "mixed_but_supported";
}

export function parseUploadCohesionResult(raw: unknown): UploadCohesionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const process_action = String(o.process_action ?? "");
  if (!PROCESS_ACTIONS.has(process_action)) return null;

  const groupsRaw = Array.isArray(o.groups) ? o.groups : [];
  const groups: CohesionGroup[] = [];
  for (const g of groupsRaw) {
    if (!g || typeof g !== "object") continue;
    const gr = g as Record<string, unknown>;
    const gt = String(gr.group_type ?? "");
    if (!GROUP_TYPES.has(gt)) continue;
    const excludedInGroup = new Set(
      Array.isArray(gr.excluded_file_ids) ? gr.excluded_file_ids.map(String) : []
    );
    const includedRaw = Array.isArray(gr.included_file_ids)
      ? gr.included_file_ids.map(String)
      : [];
    const included_file_ids = includedRaw.filter((id) => !excludedInGroup.has(id));
    groups.push({
      group_id: String(gr.group_id ?? "group"),
      group_type: gt as CohesionGroupType,
      included_file_ids,
      excluded_file_ids: Array.isArray(gr.excluded_file_ids)
        ? gr.excluded_file_ids.map(String)
        : [],
      group_confidence: clamp01(Number(gr.group_confidence)),
      group_rationale: Array.isArray(gr.group_rationale)
        ? gr.group_rationale.map(String)
        : [],
      patient_match_status: parsePatientMatch(gr.patient_match_status),
      time_match_status: parseTimeMatch(gr.time_match_status),
      anatomy_match_status: parseAnatomyMatch(gr.anatomy_match_status),
      family_match_status: parseFamilyMatch(gr.family_match_status),
      provisional_group: gr.provisional_group === true,
    });
  }

  const quarantined: QuarantinedFileRef[] = [];
  if (Array.isArray(o.quarantined_files)) {
    for (const q of o.quarantined_files) {
      if (!q || typeof q !== "object") continue;
      const qr = q as Record<string, unknown>;
      const sev = String(qr.severity ?? "medium");
      const severity =
        sev === "low" || sev === "high" || sev === "medium" ? sev : "medium";
      quarantined.push({
        file_id: String(qr.file_id ?? ""),
        reason: String(qr.reason ?? ""),
        severity,
      });
    }
  }

  const canceled: CanceledFileRef[] = [];
  if (Array.isArray(o.canceled_files)) {
    for (const c of o.canceled_files) {
      if (!c || typeof c !== "object") continue;
      const cr = c as Record<string, unknown>;
      canceled.push({
        file_id: String(cr.file_id ?? ""),
        reason: String(cr.reason ?? ""),
      });
    }
  }

  return {
    upload_batch_id: String(o.upload_batch_id ?? ""),
    process_action: process_action as ProcessAction,
    overall_reason: String(o.overall_reason ?? ""),
    groups,
    quarantined_files: quarantined,
    canceled_files: canceled,
    user_clarification_needed: o.user_clarification_needed === true,
    clarification_questions: Array.isArray(o.clarification_questions)
      ? o.clarification_questions.map(String)
      : [],
  };
}

/** File IDs that must not drive analysis (quarantine + cancel lists + excluded_group). */
export function cohesionExcludedFileIds(result: UploadCohesionResult): Set<string> {
  const out = new Set<string>();
  for (const q of result.quarantined_files) {
    if (q.file_id) out.add(q.file_id);
  }
  for (const c of result.canceled_files) {
    if (c.file_id) out.add(c.file_id);
  }
  for (const g of result.groups) {
    if (g.group_type === "excluded_group") {
      for (const id of g.included_file_ids) out.add(id);
    }
  }
  return out;
}

/** File IDs in non-excluded groups (coherent subsets). */
export function cohesionAllowedFileIds(result: UploadCohesionResult): Set<string> {
  const out = new Set<string>();
  for (const g of result.groups) {
    if (g.group_type === "excluded_group") continue;
    for (const id of g.included_file_ids) out.add(id);
  }
  return out;
}

export function parseFileIdUploadIndex(fileId: string): number | null {
  const m = /^upload-(\d+)$/.exec(String(fileId).trim());
  if (!m) return null;
  return parseInt(m[1]!, 10);
}

/**
 * Image indices to keep for downstream analysis after cohesion.
 * `cancel` → empty. `continue` → all indices whose file_id is not globally excluded.
 * `continue_with_quarantine` and `continue_provisional` → intersection with allowed group file_ids (fail-open if allowed empty).
 */
export function computeKeepIndicesForCohesion(
  cohesion: UploadCohesionResult,
  imageCount: number
): number[] {
  const excluded = cohesionExcludedFileIds(cohesion);
  if (cohesion.process_action === "cancel") return [];

  if (cohesion.process_action === "continue") {
    const out: number[] = [];
    for (let i = 0; i < imageCount; i++) {
      const fid = fileIdForUploadIndex(i);
      if (!excluded.has(fid)) out.push(i);
    }
    return out;
  }

  // continue_with_quarantine | continue_provisional
  let allowed = cohesionAllowedFileIds(cohesion);
  if (allowed.size === 0) {
    allowed = new Set(
      Array.from({ length: imageCount }, (_, i) => fileIdForUploadIndex(i))
    );
  }
  const out: number[] = [];
  for (let i = 0; i < imageCount; i++) {
    const fid = fileIdForUploadIndex(i);
    if (excluded.has(fid)) continue;
    if (allowed.has(fid)) out.push(i);
  }
  return out;
}
