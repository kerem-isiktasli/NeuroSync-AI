/**
 * RapiMed imaging atomic extractor — one coherent imaging group; atomic traceable evidence only.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type { AnatomyHierarchy, ProcedureClass } from "./procedureModalityAnatomyMapper";

export type FindingAssertion =
  | "present"
  | "absent"
  | "indeterminate"
  | "artifact_or_non_diagnostic";

export type FindingSupportType =
  | "direct_visual"
  | "metadata_supported"
  | "direct_visual_and_metadata"
  | "weak_visual"
  | "uncertain";

export type TechnicalAdequacyOverall = "adequate" | "limited" | "non_diagnostic";

export type FindingLocationPrecision = "broad" | "moderate" | "high" | "exact";

export type FindingLaterality =
  | "left"
  | "right"
  | "bilateral"
  | "midline"
  | "none"
  | "unknown";

export interface FindingLocation {
  body_region: string;
  primary_structure: string;
  substructure: string | null;
  laterality: FindingLaterality;
  level_or_segment: string | null;
  precision: FindingLocationPrecision;
}

export interface TechnicalAdequacy {
  overall: TechnicalAdequacyOverall;
  reasons: string[];
  coverage_summary: string;
  motion_or_artifact: string[];
  missing_critical_views_or_series: string[];
}

export interface VerifiedViewOrSeries {
  name: string;
  confidence: number;
  source_file_ids: string[];
}

export interface AtomicCandidateFinding {
  finding_id: string;
  label_normalized: string;
  label_source_text: string;
  assertion: FindingAssertion;
  support_score_estimate: number;
  support_type: FindingSupportType;
  source_file_ids: string[];
  source_view_or_series: string[];
  location: FindingLocation;
  extent_or_size: string | null;
  rationale: string;
  capability_note: string;
  could_drive_concern: boolean;
}

export interface ExcludedOrUnusableImage {
  file_id: string;
  reason: string;
}

export interface ImagingAtomicExtractionResult {
  group_id: string;
  technical_adequacy: TechnicalAdequacy;
  verified_views_or_series: VerifiedViewOrSeries[];
  candidate_findings: AtomicCandidateFinding[];
  excluded_or_unusable_images: ExcludedOrUnusableImage[];
  quality_flags: string[];
}

export interface ImagingAtomicExtractorInput {
  group_id: string;
  file_ids: string[];
  procedure_class: ProcedureClass | string;
  raw_modality_codes: string[];
  anatomy_mapping: AnatomyHierarchy | Record<string, unknown>;
  verified_views_or_series_metadata: unknown;
  image_count: number;
  image_level_descriptors: string[] | null;
  ocr_text_if_overlays: string | null;
  provenance_indicators: Record<string, unknown>;
  deterministic_study_facts: Record<string, unknown>;
}

const ASSERTION_SET = new Set<string>([
  "present",
  "absent",
  "indeterminate",
  "artifact_or_non_diagnostic",
]);

const SUPPORT_TYPE_SET = new Set<string>([
  "direct_visual",
  "metadata_supported",
  "direct_visual_and_metadata",
  "weak_visual",
  "uncertain",
]);

const ADEQUACY_SET = new Set<string>(["adequate", "limited", "non_diagnostic"]);

const LATERALITY_SET = new Set<string>([
  "left",
  "right",
  "bilateral",
  "midline",
  "none",
  "unknown",
]);

const PRECISION_SET = new Set<string>(["broad", "moderate", "high", "exact"]);

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const ATOMIC_EXTRACTOR_EN = `You are the RapiMed Imaging Atomic Extractor.

You analyze exactly ONE coherent imaging study group.
You do not write a narrative report.
You do not decide final concern level.
You do not produce a diagnosis unless the schema explicitly allows a limited differential hint.
You produce only atomic, traceable, modality-aware evidence.

INPUTS:
- group_id
- file_ids[]
- procedure_class
- raw_modality_codes[]
- anatomy mapping
- verified views/series metadata
- image_count
- image-level quick descriptors or image embeddings summary
- OCR text if overlays exist
- provenance indicators
- any deterministic study facts supplied by the application

OBJECTIVE:
Return atomic findings only.
Every finding must be:
- visible or directly supported
- tied to one or more source files
- localized as specifically as support allows
- bounded by modality capability
- independent from downstream report wording

FINDING ASSERTION ENUM:
- present
- absent
- indeterminate
- artifact_or_non_diagnostic

FINDING VISIBILITY RULES:
1. If there is no visible support and no reliable metadata support, do not create the finding.
2. If support exists but localization is weak, keep location broad.
3. If the study is low-quality, record that in technical adequacy, not by inventing pathology.
4. If anatomy or modality does not support a fine-grained finding, keep it indeterminate or omit it.
5. Never infer one finding only because another is common with it.
6. Never use the final diagnosis field as a dumping ground for weak speculation.
7. Do not create more findings just to appear comprehensive.
8. A single dubious feature must not become multiple derivative findings.

ALLOWED OUTPUT CATEGORIES:
- technical_adequacy
- verified_views_or_series
- candidate_findings
- excluded_or_unusable_images
- quality_flags

FOR EACH CANDIDATE FINDING INCLUDE:
- finding_id
- label_normalized
- label_source_text
- assertion
- support_score_estimate
- support_type
- source_file_ids
- source_view_or_series
- location
- laterality (inside location)
- extent_or_size
- rationale
- capability_note
- could_drive_concern

SUPPORT_TYPE ENUM:
- direct_visual
- metadata_supported
- direct_visual_and_metadata
- weak_visual
- uncertain

LOCATION OBJECT:
{
  "body_region": "string",
  "primary_structure": "string",
  "substructure": "string or null",
  "laterality": "left | right | bilateral | midline | none | unknown",
  "level_or_segment": "string or null",
  "precision": "broad | moderate | high | exact"
}

RETURN EXACTLY THIS JSON:
{
  "group_id": "string",
  "technical_adequacy": {
    "overall": "adequate | limited | non_diagnostic",
    "reasons": ["string"],
    "coverage_summary": "string",
    "motion_or_artifact": ["string"],
    "missing_critical_views_or_series": ["string"]
  },
  "verified_views_or_series": [
    {
      "name": "string",
      "confidence": 0.0,
      "source_file_ids": ["string"]
    }
  ],
  "candidate_findings": [
    {
      "finding_id": "string",
      "label_normalized": "string",
      "label_source_text": "string",
      "assertion": "present | absent | indeterminate | artifact_or_non_diagnostic",
      "support_score_estimate": 0.0,
      "support_type": "direct_visual | metadata_supported | direct_visual_and_metadata | weak_visual | uncertain",
      "source_file_ids": ["string"],
      "source_view_or_series": ["string"],
      "location": {
        "body_region": "string",
        "primary_structure": "string",
        "substructure": null,
        "laterality": "left | right | bilateral | midline | none | unknown",
        "level_or_segment": null,
        "precision": "broad | moderate | high | exact"
      },
      "extent_or_size": null,
      "rationale": "string",
      "capability_note": "string",
      "could_drive_concern": false
    }
  ],
  "excluded_or_unusable_images": [
    {
      "file_id": "string",
      "reason": "string"
    }
  ],
  "quality_flags": [
    "string"
  ]
}

STRICTLY FORBIDDEN:
- final diagnosis
- long narrative report
- unsupported complications
- invented measurements
- non-traceable findings
- contradictory duplicates`;

const ATOMIC_EXTRACTOR_TR = `Sen RapiMed Görüntüleme Atomik Çıkarıcısısın.

Tam olarak TEK tutarlı görüntüleme çalışma grubunu analiz edersin.
Anlatımsal rapor yazmazsın.
Nihai endişe düzeyine karar vermezsin.
Şema açıkça izin vermedikçe tanı üretmezsin.
Yalnızca atomik, izlenebilir, modalite-duyarlı kanıt üretirsin.

ÇIKTI kategorileri: technical_adequacy, verified_views_or_series, candidate_findings, excluded_or_unusable_images, quality_flags.

Her aday bulgu: source_file_ids zorunlu; assertion ve support_type İngilizce enum; location içinde laterality.

Yasak: nihai tanı, uzun rapor, desteksiz komplikasyon, uydurma ölçüm, izsiz bulgu, çelişkili kopyalar.

Yalnızca geçerli JSON; enum değerleri İngilizce.`;

export function buildImagingAtomicExtractorPrompt(
  language: "tr" | "en",
  input: ImagingAtomicExtractorInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? ATOMIC_EXTRACTOR_TR : ATOMIC_EXTRACTOR_EN;
  return `${discipline}${spec}

Images are attached in the same order as file_ids in INPUTS_JSON (first image = file_ids[0], etc.).
Return ONLY valid JSON matching the schema. No markdown fences. Use group_id from INPUTS_JSON.

INPUTS_JSON:
${JSON.stringify(input, null, 2)}`;
}

function parseLocation(raw: unknown): FindingLocation {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const lat = String(d.laterality ?? "unknown");
  const prec = String(d.precision ?? "broad");
  return {
    body_region: String(d.body_region ?? ""),
    primary_structure: String(d.primary_structure ?? ""),
    substructure:
      d.substructure == null || d.substructure === "" ? null : String(d.substructure),
    laterality: LATERALITY_SET.has(lat) ? (lat as FindingLaterality) : "unknown",
    level_or_segment:
      d.level_or_segment == null || d.level_or_segment === ""
        ? null
        : String(d.level_or_segment),
    precision: PRECISION_SET.has(prec) ? (prec as FindingLocationPrecision) : "broad",
  };
}

function parseTechnicalAdequacy(raw: unknown): TechnicalAdequacy {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const overall = String(d.overall ?? "limited");
  return {
    overall: ADEQUACY_SET.has(overall)
      ? (overall as TechnicalAdequacyOverall)
      : "limited",
    reasons: Array.isArray(d.reasons) ? d.reasons.map(String) : [],
    coverage_summary: String(d.coverage_summary ?? ""),
    motion_or_artifact: Array.isArray(d.motion_or_artifact)
      ? d.motion_or_artifact.map(String)
      : [],
    missing_critical_views_or_series: Array.isArray(
      d.missing_critical_views_or_series
    )
      ? d.missing_critical_views_or_series.map(String)
      : [],
  };
}

function parseCandidate(raw: unknown): AtomicCandidateFinding | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const assertion = String(o.assertion ?? "");
  const support_type = String(o.support_type ?? "");
  if (!ASSERTION_SET.has(assertion) || !SUPPORT_TYPE_SET.has(support_type)) return null;
  return {
    finding_id: String(o.finding_id ?? ""),
    label_normalized: String(o.label_normalized ?? ""),
    label_source_text: String(o.label_source_text ?? ""),
    assertion: assertion as FindingAssertion,
    support_score_estimate: clamp01(Number(o.support_score_estimate)),
    support_type: support_type as FindingSupportType,
    source_file_ids: Array.isArray(o.source_file_ids)
      ? o.source_file_ids.map(String)
      : [],
    source_view_or_series: Array.isArray(o.source_view_or_series)
      ? o.source_view_or_series.map(String)
      : [],
    location: parseLocation(o.location),
    extent_or_size:
      o.extent_or_size == null || o.extent_or_size === ""
        ? null
        : String(o.extent_or_size),
    rationale: String(o.rationale ?? ""),
    capability_note: String(o.capability_note ?? ""),
    could_drive_concern: o.could_drive_concern === true,
  };
}

export function parseImagingAtomicExtractionResult(
  raw: unknown,
  fallbackGroupId: string
): ImagingAtomicExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const verified: VerifiedViewOrSeries[] = [];
  if (Array.isArray(o.verified_views_or_series)) {
    for (const v of o.verified_views_or_series) {
      if (!v || typeof v !== "object") continue;
      const r = v as Record<string, unknown>;
      verified.push({
        name: String(r.name ?? ""),
        confidence: clamp01(Number(r.confidence)),
        source_file_ids: Array.isArray(r.source_file_ids)
          ? r.source_file_ids.map(String)
          : [],
      });
    }
  }

  const candidates: AtomicCandidateFinding[] = [];
  if (Array.isArray(o.candidate_findings)) {
    for (const c of o.candidate_findings) {
      const p = parseCandidate(c);
      if (p) candidates.push(p);
    }
  }

  const excluded: ExcludedOrUnusableImage[] = [];
  if (Array.isArray(o.excluded_or_unusable_images)) {
    for (const e of o.excluded_or_unusable_images) {
      if (!e || typeof e !== "object") continue;
      const r = e as Record<string, unknown>;
      excluded.push({
        file_id: String(r.file_id ?? ""),
        reason: String(r.reason ?? ""),
      });
    }
  }

  return {
    group_id: String(o.group_id ?? fallbackGroupId),
    technical_adequacy: parseTechnicalAdequacy(o.technical_adequacy),
    verified_views_or_series: verified,
    candidate_findings: candidates,
    excluded_or_unusable_images: excluded,
    quality_flags: Array.isArray(o.quality_flags)
      ? o.quality_flags.map(String)
      : [],
  };
}

/** Deterministic pre-adjudication dedupe — same finding_id/label/files collapse to one row. */
export function dedupeImagingCandidateFindings(
  findings: AtomicCandidateFinding[]
): AtomicCandidateFinding[] {
  const seen = new Set<string>();
  const out: AtomicCandidateFinding[] = [];
  for (const f of findings) {
    const key = [
      f.finding_id,
      f.label_normalized.toLowerCase(),
      [...f.source_file_ids].sort().join(","),
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

export function defaultImagingAtomicExtractionResult(
  groupId: string,
  reason: string
): ImagingAtomicExtractionResult {
  return {
    group_id: groupId,
    technical_adequacy: {
      overall: "limited",
      reasons: [reason],
      coverage_summary: "Atomic extraction unavailable or parse failed.",
      motion_or_artifact: [],
      missing_critical_views_or_series: [],
    },
    verified_views_or_series: [],
    candidate_findings: [],
    excluded_or_unusable_images: [],
    quality_flags: ["atomic_extractor_fallback"],
  };
}

export function buildImagingAtomicExtractorInput(params: {
  group_id: string;
  file_ids: string[];
  procedure_class: ProcedureClass | string;
  raw_modality_codes: string[];
  anatomy_mapping: AnatomyHierarchy | Record<string, unknown>;
  image_count: number;
  image_level_descriptors?: string[] | null;
  ocr_text_if_overlays?: string | null;
  deterministic_study_facts?: Record<string, unknown>;
}): ImagingAtomicExtractorInput {
  return {
    group_id: params.group_id,
    file_ids: params.file_ids,
    procedure_class: params.procedure_class,
    raw_modality_codes: params.raw_modality_codes,
    anatomy_mapping: params.anatomy_mapping,
    verified_views_or_series_metadata: null,
    image_count: params.image_count,
    image_level_descriptors: params.image_level_descriptors ?? null,
    ocr_text_if_overlays: params.ocr_text_if_overlays ?? null,
    provenance_indicators: { pipeline: "analyze_route" },
    deterministic_study_facts: params.deterministic_study_facts ?? {},
  };
}
