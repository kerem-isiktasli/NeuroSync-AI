/**
 * RapiMed laboratory report extractor — one coherent lab group; atomic normalized entries, no invented values.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type {
  AnatomyHierarchy,
  ProcedureMapperResult,
} from "./procedureModalityAnatomyMapper";

export type LabReportType =
  | "blood_test"
  | "urine_test"
  | "chemistry"
  | "hematology"
  | "coagulation"
  | "microbiology"
  | "pathology_lab"
  | "molecular"
  | "mixed_lab"
  | "unknown";

export type LabTestFlag =
  | "high"
  | "low"
  | "normal"
  | "abnormal"
  | "critical"
  | "unknown";

export type CriticalIndicatorSource = "explicit" | "inferred_formatting" | "none";

export type LabExtractionQualityOverall = "high" | "medium" | "low";

export interface LabTestEntry {
  test_id: string;
  test_name_raw: string;
  test_name_normalized: string | null;
  normalization_confidence: number;
  value_raw: string;
  value_numeric: number | null;
  unit: string | null;
  reference_range_raw: string | null;
  flag: LabTestFlag;
  critical_indicator_source: CriticalIndicatorSource;
  comments: string[];
  source_file_ids: string[];
  source_page_numbers: number[];
}

export interface LabPanel {
  panel_name: string;
  source_file_ids: string[];
  tests: LabTestEntry[];
}

export interface LabExtractionQuality {
  overall: LabExtractionQualityOverall;
  reasons: string[];
}

export interface LaboratoryReportExtractionResult {
  group_id: string;
  report_type: LabReportType;
  specimen: string | null;
  collection_datetime: string | null;
  performing_lab: string | null;
  panels: LabPanel[];
  report_level_notes: string[];
  extraction_quality: LabExtractionQuality;
}

export interface LaboratoryReportExtractorInput {
  group_id: string;
  file_ids: string[];
  ocr_text: string | null;
  page_image_summaries: string[] | null;
  table_extraction: unknown | null;
  metadata: Record<string, unknown>;
  prior_procedure_mapper: Pick<
    ProcedureMapperResult,
    "procedure_class" | "routing_target" | "study_purpose" | "content_subtype"
  > | null;
  prior_anatomy_mapping: AnatomyHierarchy | Record<string, unknown> | null;
}

const REPORT_TYPE_SET = new Set<string>([
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

const FLAG_SET = new Set<string>([
  "high",
  "low",
  "normal",
  "abnormal",
  "critical",
  "unknown",
]);

const CRITICAL_SRC_SET = new Set<string>([
  "explicit",
  "inferred_formatting",
  "none",
]);

const QUALITY_SET = new Set<string>(["high", "medium", "low"]);

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const LAB_EXTRACTOR_EN = `You are the RapiMed Laboratory Report Extractor.

You analyze exactly ONE coherent laboratory report group.
You do not diagnose beyond the presented report content.
You do not invent missing values or ranges.
You do not convert uncertain OCR into numeric certainty.

INPUTS:
- group_id
- file_ids[]
- OCR text
- page images or quick page summaries
- table extraction if available
- metadata
- prior routing and anatomy mapping

GOAL:
Extract laboratory data into normalized atomic entries.

EXTRACT:
- report_type
- specimen if present
- collection date/time if present
- performing lab if present
- panel names
- test entries
- value
- unit
- reference range
- flag status
- critical value indicator if explicitly shown or strongly implied by report formatting
- comments or footnotes tied to specific tests

TEST ENTRY RULES:
1. Preserve source text.
2. Normalize only when reasonably certain.
3. If OCR is ambiguous, keep raw text and set normalization_confidence low.
4. Never guess a reference range.
5. Never invent a normal/abnormal flag.
6. If the report has multiple dates, do not merge them into one test instance unless the report clearly does so.
7. Keep each analyte instance separate.

RETURN EXACTLY THIS JSON:
{
  "group_id": "string",
  "report_type": "blood_test | urine_test | chemistry | hematology | coagulation | microbiology | pathology_lab | molecular | mixed_lab | unknown",
  "specimen": "string or null",
  "collection_datetime": "string or null",
  "performing_lab": "string or null",
  "panels": [
    {
      "panel_name": "string",
      "source_file_ids": ["string"],
      "tests": [
        {
          "test_id": "string",
          "test_name_raw": "string",
          "test_name_normalized": "string or null",
          "normalization_confidence": 0.0,
          "value_raw": "string",
          "value_numeric": null,
          "unit": "string or null",
          "reference_range_raw": "string or null",
          "flag": "high | low | normal | abnormal | critical | unknown",
          "critical_indicator_source": "explicit | inferred_formatting | none",
          "comments": ["string"],
          "source_file_ids": ["string"],
          "source_page_numbers": [0]
        }
      ]
    }
  ],
  "report_level_notes": [
    "string"
  ],
  "extraction_quality": {
    "overall": "high | medium | low",
    "reasons": ["string"]
  }
}

FORBIDDEN:
- disease diagnosis from lab pattern alone
- invented lab interpretation
- guessed units or ranges
- collapsing repeated tests into one unless explicitly same instance`;

const LAB_EXTRACTOR_TR = `Sen RapiMed Laboratuvar Raporu Çıkarıcısısın.

Tek tutarlı laboratuvar rapor grubunu analiz edersin.
Sunulan rapor ötesinde tanı koymazsın.
Eksik değer veya aralık uydurmazsın.
Belirsiz OCR'yi sayısal kesinliğe çevirmezsin.

Çıktı: report_type, specimen, tarih, lab, paneller, test satırları (value_raw, flag, reference_range_raw), extraction_quality.

Kurallar: kaynak metni koru; güvenli değilse normalization_confidence düşük; referans aralığı/flag tahmin etme; analitleri birleştirme.

Yalnızca geçerli JSON; enum değerleri İngilizce.`;

export function buildLaboratoryReportExtractorPrompt(
  language: "tr" | "en",
  input: LaboratoryReportExtractorInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? LAB_EXTRACTOR_TR : LAB_EXTRACTOR_EN;
  return `${discipline}${spec}

Images (if any) are attached in file_ids order (first image = file_ids[0]).
Return ONLY valid JSON matching the schema. No markdown fences. Use group_id from INPUTS_JSON.

INPUTS_JSON:
${JSON.stringify(input, null, 2)}`;
}

function parseTest(raw: unknown): LabTestEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const flag = String(o.flag ?? "unknown");
  const cis = String(o.critical_indicator_source ?? "none");
  if (!FLAG_SET.has(flag) || !CRITICAL_SRC_SET.has(cis)) return null;

  let value_numeric: number | null = null;
  if (o.value_numeric != null && typeof o.value_numeric === "number") {
    value_numeric = o.value_numeric;
  }

  return {
    test_id: String(o.test_id ?? ""),
    test_name_raw: String(o.test_name_raw ?? ""),
    test_name_normalized:
      o.test_name_normalized == null || o.test_name_normalized === ""
        ? null
        : String(o.test_name_normalized),
    normalization_confidence: clamp01(Number(o.normalization_confidence)),
    value_raw: String(o.value_raw ?? ""),
    value_numeric,
    unit: o.unit == null || o.unit === "" ? null : String(o.unit),
    reference_range_raw:
      o.reference_range_raw == null || o.reference_range_raw === ""
        ? null
        : String(o.reference_range_raw),
    flag: flag as LabTestFlag,
    critical_indicator_source: cis as CriticalIndicatorSource,
    comments: Array.isArray(o.comments) ? o.comments.map(String) : [],
    source_file_ids: Array.isArray(o.source_file_ids)
      ? o.source_file_ids.map(String)
      : [],
    source_page_numbers: Array.isArray(o.source_page_numbers)
      ? o.source_page_numbers.map((n) => Number(n)).filter((n) => !Number.isNaN(n))
      : [],
  };
}

function parsePanel(raw: unknown): LabPanel | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const tests: LabTestEntry[] = [];
  if (Array.isArray(o.tests)) {
    for (const t of o.tests) {
      const p = parseTest(t);
      if (p) tests.push(p);
    }
  }
  return {
    panel_name: String(o.panel_name ?? ""),
    source_file_ids: Array.isArray(o.source_file_ids)
      ? o.source_file_ids.map(String)
      : [],
    tests,
  };
}

function parseExtractionQuality(raw: unknown): LabExtractionQuality {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const overall = String(d.overall ?? "low");
  return {
    overall: QUALITY_SET.has(overall)
      ? (overall as LabExtractionQualityOverall)
      : "low",
    reasons: Array.isArray(d.reasons) ? d.reasons.map(String) : [],
  };
}

export function parseLaboratoryReportExtractionResult(
  raw: unknown,
  fallbackGroupId: string
): LaboratoryReportExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rt = String(o.report_type ?? "");
  if (!REPORT_TYPE_SET.has(rt)) return null;

  const panels: LabPanel[] = [];
  if (Array.isArray(o.panels)) {
    for (const p of o.panels) {
      const parsed = parsePanel(p);
      if (parsed) panels.push(parsed);
    }
  }

  return {
    group_id: String(o.group_id ?? fallbackGroupId),
    report_type: rt as LabReportType,
    specimen:
      o.specimen == null || o.specimen === "" ? null : String(o.specimen),
    collection_datetime:
      o.collection_datetime == null || o.collection_datetime === ""
        ? null
        : String(o.collection_datetime),
    performing_lab:
      o.performing_lab == null || o.performing_lab === ""
        ? null
        : String(o.performing_lab),
    panels,
    report_level_notes: Array.isArray(o.report_level_notes)
      ? o.report_level_notes.map(String)
      : [],
    extraction_quality: parseExtractionQuality(o.extraction_quality),
  };
}

export function defaultLaboratoryReportExtractionResult(
  groupId: string,
  reason: string
): LaboratoryReportExtractionResult {
  return {
    group_id: groupId,
    report_type: "unknown",
    specimen: null,
    collection_datetime: null,
    performing_lab: null,
    panels: [],
    report_level_notes: [reason],
    extraction_quality: {
      overall: "low",
      reasons: [reason],
    },
  };
}

export function buildLaboratoryReportExtractorInput(params: {
  group_id: string;
  file_ids: string[];
  procedureMapper: ProcedureMapperResult;
  metadata?: Record<string, unknown>;
  ocr_text?: string | null;
  page_image_summaries?: string[] | null;
  table_extraction?: unknown | null;
}): LaboratoryReportExtractorInput {
  const { group_id, file_ids, procedureMapper } = params;
  return {
    group_id,
    file_ids,
    ocr_text: params.ocr_text ?? null,
    page_image_summaries: params.page_image_summaries ?? null,
    table_extraction: params.table_extraction ?? null,
    metadata: params.metadata ?? {},
    prior_procedure_mapper: {
      procedure_class: procedureMapper.procedure_class,
      routing_target: procedureMapper.routing_target,
      study_purpose: procedureMapper.study_purpose,
      content_subtype: procedureMapper.content_subtype,
    },
    prior_anatomy_mapping: procedureMapper.anatomy,
  };
}
