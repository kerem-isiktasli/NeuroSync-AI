/**
 * RapiMed single-file intake classifier — one file, family enum, JSON-only output.
 * Maps into legacy PerImageIntakeResult for the analyze pipeline.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type {
  IntakeDiagnosticValue,
  IntakeImagePlane,
  PerImageIntakeResult,
  UploadType,
} from "./intakePrompts";

export const INTAKE_FAMILY_VALUES = [
  "dicom_imaging",
  "rendered_radiology_image",
  "rendered_pathology_image",
  "waveform_ecg",
  "waveform_eeg",
  "waveform_emg",
  "lab_report",
  "pathology_report",
  "radiology_report",
  "discharge_or_clinical_note",
  "medication_or_prescription_document",
  "operative_or_procedure_note",
  "generic_medical_document",
  "unknown_medical",
  "administrative_nonclinical",
  "non_medical",
  "corrupted_or_unreadable",
] as const;

export type IntakeFamily = (typeof INTAKE_FAMILY_VALUES)[number];

const FAMILY_SET = new Set<string>(INTAKE_FAMILY_VALUES);

export type IntakeReadabilityStatus = "readable" | "partially_readable" | "unreadable";

export type IntakeLinkabilityStatus = "strong" | "moderate" | "weak" | "unknown";

export type IntakeDiagnosticUtilityStatus = "high" | "moderate" | "low" | "unknown";

export interface SingleFileIntakeContext {
  file_id: string;
  original_filename: string;
  mime_type: string;
  extension: string;
  file_size_bytes: number;
  quick_text_ocr: string | null;
  quick_visual_summary: string | null;
  available_metadata: Record<string, unknown>;
  dicom_tags_if_present: Record<string, unknown> | null;
  image_count_if_media: number | null;
  page_count_if_document: number | null;
  upload_order_index: number;
  /** True when non-empty pixel/document payload is attached for this call (inspect directly if summaries are empty). */
  image_or_document_content_if_available: boolean;
}

export interface FamilyAlternativeRanked {
  family: string;
  confidence: number;
  why_not_selected: string;
}

export interface SingleFileIntakeClassificationResult {
  file_id: string;
  is_medical: boolean;
  family: IntakeFamily;
  confidence_overall: number;
  quarantine_suggested: boolean;
  quarantine_reason: string | null;
  rejection_reason: string | null;
  readability_status: IntakeReadabilityStatus;
  linkability_status: IntakeLinkabilityStatus;
  diagnostic_utility_status: IntakeDiagnosticUtilityStatus;
  observed_signals: string[];
  missing_or_weak_signals: string[];
  family_alternatives_ranked: FamilyAlternativeRanked[];
}

export interface RunIntakeClassificationMeta {
  file_id: string;
  original_filename: string;
  mime_type: string;
  upload_order_index: number;
  quick_text_ocr?: string | null;
  quick_visual_summary?: string | null;
  available_metadata?: Record<string, unknown>;
  dicom_tags_if_present?: Record<string, unknown> | null;
  page_count_if_document?: number | null;
  image_count_if_media?: number | null;
}

export function buildSingleFileIntakeContext(
  meta: RunIntakeClassificationMeta,
  rawBase64: string
): SingleFileIntakeContext {
  const dot = meta.original_filename.lastIndexOf(".");
  const extension =
    dot >= 0 ? meta.original_filename.slice(dot).toLowerCase() : "";
  const decodedApprox = Math.max(0, Math.floor((rawBase64.length * 3) / 4));
  return {
    file_id: meta.file_id,
    original_filename: meta.original_filename,
    mime_type: meta.mime_type,
    extension: extension || "unknown",
    file_size_bytes: decodedApprox,
    quick_text_ocr: meta.quick_text_ocr ?? null,
    quick_visual_summary: meta.quick_visual_summary ?? null,
    available_metadata: meta.available_metadata ?? {},
    dicom_tags_if_present: meta.dicom_tags_if_present ?? null,
    page_count_if_document: meta.page_count_if_document ?? null,
    image_count_if_media: meta.image_count_if_media ?? 1,
    upload_order_index: meta.upload_order_index,
    image_or_document_content_if_available: rawBase64.trim().length >= 32,
  };
}

const CLASSIFIER_SYSTEM_EN = `You are the RapiMed Single-File Intake Classifier.

Your job is to inspect exactly ONE uploaded file.
You do not diagnose.
You do not group files.
You do not write a medical report.
You only decide:
- whether the file is medical
- what broad family it belongs to
- whether it should be quarantined
- whether it is readable enough for downstream processing

INPUTS (also in INPUTS_JSON):
- file_id
- original_filename
- mime_type
- extension
- file_size_bytes
- quick_text_ocr
- quick_visual_summary
- available_metadata
- dicom_tags_if_present
- image_count_if_media
- page_count_if_document
- upload_order_index
- image_or_document_content_if_available (when true, the attached image/document bytes are available—inspect them directly if OCR or quick_visual_summary is empty)

MEDICAL FAMILY ENUM:
- dicom_imaging
- rendered_radiology_image
- rendered_pathology_image
- waveform_ecg
- waveform_eeg
- waveform_emg
- lab_report
- pathology_report
- radiology_report
- discharge_or_clinical_note
- medication_or_prescription_document
- operative_or_procedure_note
- generic_medical_document
- unknown_medical

NON-MEDICAL / EXCLUDE ENUM:
- administrative_nonclinical
- non_medical
- corrupted_or_unreadable

DEFINITIONS:
- dicom_imaging: native DICOM or clearly DICOM-derived study content with reliable imaging metadata
- rendered_radiology_image: JPG/PNG/PDF/image page visibly showing an imaging study or film view
- rendered_pathology_image: histology / microscopy / pathology image content
- waveform_ecg / eeg / emg: strip, tracing, waveform page, or waveform export matching that subtype
- lab_report: blood, urine, chemistry, hematology, coagulation, microbiology, molecular, or similar laboratory report
- pathology_report: narrative pathology or specimen-based report document
- radiology_report: narrative imaging report document
- discharge_or_clinical_note: visit note, summary, consult note, referral, progress note
- medication_or_prescription_document: prescription, med list, pharmacy summary
- operative_or_procedure_note: procedure note, operative note, endoscopy, cath, intervention record
- generic_medical_document: clearly medical but not narrow enough for a better class
- unknown_medical: probably medical, but family confidence is too weak
- administrative_nonclinical: billing, insurance, appointment, consent without findings, demographic form
- non_medical: random screenshot, chat screenshot, selfie, landscape, shopping page, meme, UI capture without medical content
- corrupted_or_unreadable: unreadable or parse failure

PRIMARY RESPONSIBILITY:
Determine medical validity first.
Family classification second.
Do not over-reject rendered medical media.

CRITICAL RULES:
1. Decide medical vs non-medical first.
2. DICOM tags outrank OCR and visual guess.
3. A screenshot of a medical report is still medical if the visible content is clearly medical.
4. A screenshot with no reliable medical signals is not medical.
5. Missing patient name, accession number, or study date does NOT justify classifying a clearly medical file as non-medical.
6. If a file visually appears to be a radiograph, scan, ultrasound image, pathology image, or screenshot of such content, and there is no strong contradictory evidence, classify it as medical.
7. For rendered medical images, classify first by visible medical-media characteristics:
   - grayscale radiographic projection patterns
   - recognizable scan layout
   - anatomy-like imaging structures
   - film-style framing
   - report overlays or modality markers if present
8. Do not downgrade a clearly medical image to non_medical because metadata is sparse.
9. If clearly medical but narrow family is uncertain, choose unknown_medical.
10. Use quarantine_suggested=true when the file may be accidental, weakly medical, partially unreadable, or contextually suspicious.
11. Do not infer disease.
12. Do not infer final anatomy or modality beyond what is strongly supported.
13. A file can be medical and still be low-linkability.
14. A file can be medical and still be unsuitable for diagnosis.
15. Preserve alternatives when the class is ambiguous.
16. If quick_visual_summary is empty but image_or_document_content_if_available is true, inspect the content directly.
17. If both OCR and visual summary are empty but the visible content is still inspectable, do not auto-fail.
18. Only choose corrupted_or_unreadable when the file truly cannot be inspected enough to classify.
19. Do not confuse low diagnostic value with non-medical status.
20. Do not use absent metadata as a rejection shortcut.

STATUS FIELDS (required on every success response):
- readability_status: readable | partially_readable | unreadable
- linkability_status: strong | moderate | weak | unknown
- diagnostic_utility_status: high | moderate | low | unknown

CONFIDENCE RULES:
- confidence_overall range: 0.00 to 1.00
- confidence reflects classification certainty only
- do not use concern or medical severity here

RETURN EXACTLY THIS JSON:
{
  "file_id": "string",
  "is_medical": true,
  "family": "dicom_imaging | rendered_radiology_image | rendered_pathology_image | waveform_ecg | waveform_eeg | waveform_emg | lab_report | pathology_report | radiology_report | discharge_or_clinical_note | medication_or_prescription_document | operative_or_procedure_note | generic_medical_document | unknown_medical | administrative_nonclinical | non_medical | corrupted_or_unreadable",
  "confidence_overall": 0.0,
  "quarantine_suggested": false,
  "quarantine_reason": null,
  "rejection_reason": null,
  "observed_signals": [
    "string"
  ],
  "missing_or_weak_signals": [
    "string"
  ],
  "family_alternatives_ranked": [
    {
      "family": "string",
      "confidence": 0.0,
      "why_not_selected": "string"
    }
  ]
}

FAILURE JSON:
{
  "file_id": "string",
  "is_medical": false,
  "family": "corrupted_or_unreadable",
  "confidence_overall": 0.0,
  "quarantine_suggested": true,
  "quarantine_reason": "input missing or unreadable",
  "rejection_reason": "classification_failed",
  "observed_signals": [],
  "missing_or_weak_signals": ["unreadable input"],
  "family_alternatives_ranked": []
}`;

const CLASSIFIER_SYSTEM_TR = `Sen RapiMed Tek Dosya Intake Sınıflandırıcısısın.

Tam olarak TEK yüklenmiş dosyayı incelersin.
Tanı koymazsın, dosya gruplamazsın, tıbbi rapor yazmazsın.
Yalnızca: tıbbi mi, hangi geniş aile, karantina önerisi mi, aşağı akış için okunabilir mi.

ÖNCELİK: Önce tıbbi geçerlilik, sonra aile. Render tıbbi medyayı gereksiz reddetme.

GİRDİLER (INPUTS_JSON): file_id, original_filename, mime_type, extension, file_size_bytes, quick_text_ocr, quick_visual_summary, available_metadata, dicom_tags_if_present, image_count_if_media, page_count_if_document, upload_order_index, image_or_document_content_if_available (true ise ekli içerik var—özet boşsa doğrudan incele).

TIBBİ AİLELER: dicom_imaging, rendered_radiology_image, rendered_pathology_image, waveform_ecg, waveform_eeg, waveform_emg, lab_report, pathology_report, radiology_report, discharge_or_clinical_note, medication_or_prescription_document, operative_or_procedure_note, generic_medical_document, unknown_medical.

DIŞLAMA: administrative_nonclinical, non_medical, corrupted_or_unreadable.

KRİTİK (EN ile aynı mantık, kurallar 1–20): Önce tıbbi/tıbbi değil. DICOM üstün. Eksik tanımlayıcılar açık tıbbi dosyayı non_medical yapmaz. Görsel özet boş ama içerik varsa doğrudan incele; OCR/görsel özeti yok diye otomatik başarısızlık yok. corrupted_or_unreadable yalnızca gerçekten yeterince incelenemiyorsa. Düşük tanısal yararlılık ≠ tıbbi değil. Eksik üst veri tek başına red kısayolu değil. Belirsizlikte family_alternatives_ranked.

ZORUNLU ALANLAR: readability_status (readable|partially_readable|unreadable), linkability_status (strong|moderate|weak|unknown), diagnostic_utility_status (high|moderate|low|unknown).

GÜVEN: confidence_overall 0–1 yalnızca sınıflandırma kesinliği; endişe/şiddet değil.

ÇIKTI: Yukarıdaki İngilizce JSON şeması ile birebir (failure JSON dahil).`;

export function buildSingleFileIntakeClassifierPrompt(
  language: "tr" | "en",
  context: SingleFileIntakeContext
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? CLASSIFIER_SYSTEM_TR : CLASSIFIER_SYSTEM_EN;
  return `${discipline}${spec}

Classify the single attached image using INPUTS_JSON below. Return ONLY valid JSON matching the success or failure shape (no markdown fences, no extra text).

INPUTS_JSON:
${JSON.stringify(context, null, 2)}`;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const READABILITY_SET = new Set<string>([
  "readable",
  "partially_readable",
  "unreadable",
]);

const LINKABILITY_SET = new Set<string>(["strong", "moderate", "weak", "unknown"]);

const DIAGNOSTIC_UTILITY_SET = new Set<string>([
  "high",
  "moderate",
  "low",
  "unknown",
]);

function parseReadability(
  v: unknown,
  family: IntakeFamily
): IntakeReadabilityStatus {
  const s = String(v ?? "");
  if (READABILITY_SET.has(s)) return s as IntakeReadabilityStatus;
  if (family === "corrupted_or_unreadable") return "unreadable";
  return "partially_readable";
}

function parseLinkability(v: unknown): IntakeLinkabilityStatus {
  const s = String(v ?? "unknown");
  return LINKABILITY_SET.has(s) ? (s as IntakeLinkabilityStatus) : "unknown";
}

function parseDiagnosticUtility(v: unknown): IntakeDiagnosticUtilityStatus {
  const s = String(v ?? "unknown");
  return DIAGNOSTIC_UTILITY_SET.has(s)
    ? (s as IntakeDiagnosticUtilityStatus)
    : "unknown";
}

export function parseSingleFileIntakeClassification(
  raw: unknown
): SingleFileIntakeClassificationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const family = String(o.family ?? "");
  if (!FAMILY_SET.has(family)) return null;

  const fam = family as IntakeFamily;

  const alts: FamilyAlternativeRanked[] = [];
  if (Array.isArray(o.family_alternatives_ranked)) {
    for (const a of o.family_alternatives_ranked) {
      if (!a || typeof a !== "object") continue;
      const r = a as Record<string, unknown>;
      alts.push({
        family: String(r.family ?? ""),
        confidence: clamp01(Number(r.confidence)),
        why_not_selected: String(r.why_not_selected ?? ""),
      });
    }
  }

  return {
    file_id: String(o.file_id ?? ""),
    is_medical: o.is_medical === true,
    family: fam,
    confidence_overall: clamp01(Number(o.confidence_overall)),
    quarantine_suggested: o.quarantine_suggested === true,
    quarantine_reason: o.quarantine_reason == null ? null : String(o.quarantine_reason),
    rejection_reason: o.rejection_reason == null ? null : String(o.rejection_reason),
    readability_status: parseReadability(o.readability_status, fam),
    linkability_status: parseLinkability(o.linkability_status),
    diagnostic_utility_status: parseDiagnosticUtility(o.diagnostic_utility_status),
    observed_signals: Array.isArray(o.observed_signals)
      ? o.observed_signals.map(String).filter(Boolean)
      : [],
    missing_or_weak_signals: Array.isArray(o.missing_or_weak_signals)
      ? o.missing_or_weak_signals.map(String).filter(Boolean)
      : [],
    family_alternatives_ranked: alts,
  };
}

const REPORT_LIKE_FAMILIES = new Set<IntakeFamily>([
  "lab_report",
  "pathology_report",
  "radiology_report",
  "discharge_or_clinical_note",
  "medication_or_prescription_document",
  "operative_or_procedure_note",
]);

const IMAGING_LIKE_FAMILIES = new Set<IntakeFamily>([
  "dicom_imaging",
  "rendered_radiology_image",
  "rendered_pathology_image",
  "waveform_ecg",
  "waveform_eeg",
  "waveform_emg",
]);

const EXCLUDED_FAMILIES = new Set<IntakeFamily>([
  "administrative_nonclinical",
  "non_medical",
  "corrupted_or_unreadable",
]);

function familyToUploadType(family: IntakeFamily, isMedical: boolean): UploadType {
  if (!isMedical || EXCLUDED_FAMILIES.has(family)) return "non-diagnostic";
  if (REPORT_LIKE_FAMILIES.has(family)) return "report-image";
  if (IMAGING_LIKE_FAMILIES.has(family)) return "diagnostic-image";
  if (family === "generic_medical_document") return "unknown";
  return "unknown";
}

function familyToDiagnosticValue(
  family: IntakeFamily,
  isMedical: boolean,
  conf: number
): IntakeDiagnosticValue {
  if (!isMedical || EXCLUDED_FAMILIES.has(family)) return "none";
  if (REPORT_LIKE_FAMILIES.has(family)) return conf >= 0.5 ? "medium" : "low";
  if (IMAGING_LIKE_FAMILIES.has(family)) {
    if (conf >= 0.75) return "high";
    if (conf >= 0.45) return "medium";
    return "low";
  }
  if (family === "unknown_medical") return conf >= 0.55 ? "low" : "low";
  if (family === "generic_medical_document") return "low";
  return "low";
}

export function singleFileIntakeToPerImageResult(
  parsed: SingleFileIntakeClassificationResult,
  imageIndex: number,
  fileName: string
): PerImageIntakeResult {
  const upload_type = familyToUploadType(parsed.family, parsed.is_medical);
  const diagnostic_value = familyToDiagnosticValue(
    parsed.family,
    parsed.is_medical,
    parsed.confidence_overall
  );
  const contains_report_text =
    parsed.is_medical && REPORT_LIKE_FAMILIES.has(parsed.family);
  const confPct = Math.round(clamp01(parsed.confidence_overall) * 100);

  const reasons: string[] = [
    `intake_family:${parsed.family}`,
    `readability:${parsed.readability_status}`,
    `linkability:${parsed.linkability_status}`,
    `diagnostic_utility:${parsed.diagnostic_utility_status}`,
    ...parsed.observed_signals.slice(0, 5),
  ];
  if (parsed.quarantine_suggested) {
    reasons.push(
      `quarantine_suggested${parsed.quarantine_reason ? `:${parsed.quarantine_reason}` : ""}`
    );
  }
  if (parsed.rejection_reason) {
    reasons.push(`rejection_reason:${parsed.rejection_reason}`);
  }

  const image_plane: IntakeImagePlane = "unknown";

  return {
    imageIndex,
    fileName,
    upload_type,
    modality_guess: "",
    anatomical_region_guess: "",
    image_plane,
    diagnostic_value,
    contains_ui_overlay: false,
    contains_report_text,
    confidence: confPct,
    reasons,
    intake_family: parsed.family,
    intake_is_medical: parsed.is_medical,
    quarantine_suggested: parsed.quarantine_suggested,
    quarantine_reason: parsed.quarantine_reason,
  };
}
