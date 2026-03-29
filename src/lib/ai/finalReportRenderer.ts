/**
 * RapiMed strict final report renderer — structured report from adjudicated evidence + locked study facts only.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type { ProcedureMapperResult } from "./procedureModalityAnatomyMapper";
import type { UploadCohesionResult, CohesionGroup } from "./uploadCohesionArbiter";
import type {
  StudyAdjudicationOutput,
  DerivedConcernLevel,
} from "./evidenceAdjudicatorMerger";
import type { TechnicalAdequacy } from "./imagingAtomicExtractor";
import type { LockedStudyFacts, StudyFactLockerResult } from "./studyFactLocker";

export type FinalReportType =
  | "imaging"
  | "laboratory"
  | "waveform"
  | "document"
  | "mixed_context";

export interface FinalReportSections {
  exam_or_document_overview: string;
  technical_or_source_summary: string;
  key_results: string[];
  detailed_results: string[];
  impression_or_conclusion: string;
  limitations_or_uncertainties: string[];
  recommended_follow_up: string[];
}

export interface ImportantTermEntry {
  term: string;
  plain_explanation: string;
}

export interface FinalReportProvenanceSummary {
  included_file_ids: string[];
  excluded_file_ids: string[];
  coherent_subset_used: boolean;
}

export interface FinalReportRenderResult {
  group_id: string;
  report_type: FinalReportType;
  plain_summary: string;
  professional_summary: string;
  concern_level: DerivedConcernLevel;
  report_sections: FinalReportSections;
  important_terms: ImportantTermEntry[];
  provenance_summary: FinalReportProvenanceSummary;
}

export interface FinalReportRendererModelInput {
  study_output: StudyAdjudicationOutput;
  /** Immutable facts from Study Fact Locker; downstream copy must match. */
  locked_study_facts: LockedStudyFacts;
  /** Optional glossary hints (do not invent beyond this list). */
  important_terms_if_any: ImportantTermEntry[];
  /** Optional upstream follow-up suggestions (may be empty). */
  recommended_follow_up_if_any: string[];
  group_metadata: {
    group_id: string;
    group_type: string;
    included_file_ids: string[];
    group_confidence?: number;
    group_rationale?: string[];
  };
  /** Quarantined / canceled / excluded_group file_ids for scope and provenance_summary. */
  excluded_file_ids: string[];
  procedure_class: string;
  anatomy_mapping: Record<string, unknown>;
  routing_target: string;
  technical_adequacy: TechnicalAdequacy | null;
  allowed_report_template_type: FinalReportType;
  group_provenance_summary: {
    coherent_subset_used: boolean;
    had_quarantined_or_excluded_upload_files: boolean;
    adjudication_global_quarantine_file_ids: string[];
  };
}

const REPORT_TYPES = new Set<string>([
  "imaging",
  "laboratory",
  "waveform",
  "document",
  "mixed_context",
]);

const STUDY_PURPOSE_LOCKED = new Set<string>([
  "diagnostic",
  "screening",
  "follow_up",
  "pre_op",
  "post_op",
  "unknown",
]);

const CONCERN_SET = new Set<string>(["low", "moderate", "high", "urgent_review"]);

/**
 * Mixed-context final reports only when cohesion explicitly grouped as mixed_context_bundle.
 * Unknown routing falls back to document (conservative), never implicit mixed.
 */
export function deriveReportTemplateType(
  routing: ProcedureMapperResult["routing_target"],
  groupType: string
): FinalReportType {
  if (groupType === "mixed_context_bundle") return "mixed_context";
  if (routing === "imaging_extractor") return "imaging";
  if (routing === "lab_extractor") return "laboratory";
  if (routing === "waveform_extractor") return "waveform";
  if (routing === "document_extractor") return "document";
  return "document";
}

export function collectExcludedFileIdsFromCohesion(
  cohesion: UploadCohesionResult
): string[] {
  const set = new Set<string>();
  for (const q of cohesion.quarantined_files) set.add(q.file_id);
  for (const c of cohesion.canceled_files) set.add(c.file_id);
  for (const g of cohesion.groups) {
    if (g.group_type === "excluded_group") {
      for (const fid of g.included_file_ids) set.add(fid);
    }
  }
  return [...set];
}

function pickCohesionGroup(
  cohesion: UploadCohesionResult,
  procedureGroupId: string
): CohesionGroup | null {
  const match = cohesion.groups.find((g) => g.group_id === procedureGroupId);
  if (match) return match;
  const nonExcluded = cohesion.groups.find((g) => g.group_type !== "excluded_group");
  return nonExcluded ?? cohesion.groups[0] ?? null;
}

function lockedStudyFactsFallback(
  study_output: StudyAdjudicationOutput,
  procedureMapper: ProcedureMapperResult,
  included: string[],
  excluded: string[],
  coherent_subset_used: boolean,
  imagingTechnicalAdequacy: TechnicalAdequacy | null,
  imageCount: number | null
): LockedStudyFacts {
  const cp = study_output.content_profile;
  const a = cp?.anatomy;
  const techRaw = study_output.technical_context?.overall_quality;
  const techQ =
    techRaw === "adequate" ||
    techRaw === "limited" ||
    techRaw === "non_diagnostic" ||
    techRaw === "unknown"
      ? techRaw
      : imagingTechnicalAdequacy?.overall ?? "unknown";

  const anatomy: LockedStudyFacts["anatomy"] = a
    ? {
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
      }
    : {
        body_region: String(procedureMapper.anatomy.body_region || "unknown"),
        organ_system: String(procedureMapper.anatomy.organ_system || "unknown"),
        primary_structure: String(procedureMapper.anatomy.primary_structure || "unknown"),
        substructures: [...procedureMapper.anatomy.substructures],
        laterality: String(procedureMapper.anatomy.laterality),
        level_or_segment: procedureMapper.anatomy.level_or_segment,
        location_precision: String(procedureMapper.anatomy.location_precision || "broad"),
      };

  const rf = String(cp?.report_family ?? procedureMapper.report_family ?? "");
  const report_family = REPORT_TYPES.has(rf)
    ? (rf as LockedStudyFacts["report_family"])
    : "mixed_context";
  const sp = String(cp?.study_purpose ?? procedureMapper.study_purpose ?? "unknown").trim();
  const study_purpose = (
    STUDY_PURPOSE_LOCKED.has(sp) ? sp : "unknown"
  ) as LockedStudyFacts["study_purpose"];

  return {
    report_family,
    procedure_class: String(cp?.procedure_class ?? procedureMapper.procedure_class),
    raw_modality_codes: Array.isArray(cp?.raw_modality_codes)
      ? cp!.raw_modality_codes.map(String)
      : [...procedureMapper.raw_modality_codes],
    study_purpose,
    image_count: imageCount,
    verified_views_or_series: [],
    anatomy,
    coherent_subset_used,
    included_file_ids: [...included],
    excluded_file_ids: [...excluded],
    technical_quality: techQ as LockedStudyFacts["technical_quality"],
    derived_concern_level_from_adjudication: study_output.derived_concern_level,
    max_allowed_concern_level: "unknown",
  };
}

export function buildFinalReportRendererModelInput(params: {
  study_output: StudyAdjudicationOutput;
  cohesion: UploadCohesionResult;
  procedureMapper: ProcedureMapperResult;
  imagingTechnicalAdequacy: TechnicalAdequacy | null;
  coherent_subset_used: boolean;
  global_quarantine_file_ids?: string[];
  studyFactLock?: StudyFactLockerResult | null;
  important_terms_if_any?: ImportantTermEntry[];
  recommended_follow_up_if_any?: string[];
  /** Post-cohesion file count for locker fallback when studyFactLock is absent. */
  image_count_if_known?: number | null;
}): FinalReportRendererModelInput {
  const { study_output, cohesion, procedureMapper, imagingTechnicalAdequacy } =
    params;
  const g = pickCohesionGroup(cohesion, procedureMapper.group_id);
  const group_metadata = g
    ? {
        group_id: g.group_id,
        group_type: g.group_type,
        included_file_ids: [...g.included_file_ids],
        group_confidence: g.group_confidence,
        group_rationale: g.group_rationale,
      }
    : {
        group_id: study_output.group_id,
        group_type: "unknown",
        included_file_ids: [] as string[],
      };

  const excluded = collectExcludedFileIdsFromCohesion(cohesion);
  const hadQuarantine =
    cohesion.quarantined_files.length > 0 ||
    cohesion.canceled_files.length > 0 ||
    cohesion.groups.some((x) => x.group_type === "excluded_group");

  const locked_study_facts =
    params.studyFactLock?.locked_study_facts ??
    lockedStudyFactsFallback(
      study_output,
      procedureMapper,
      group_metadata.included_file_ids,
      excluded,
      params.coherent_subset_used,
      imagingTechnicalAdequacy,
      params.image_count_if_known ?? null
    );

  return {
    study_output,
    locked_study_facts,
    important_terms_if_any: params.important_terms_if_any ?? [],
    recommended_follow_up_if_any: params.recommended_follow_up_if_any ?? [],
    group_metadata,
    excluded_file_ids: excluded,
    procedure_class: procedureMapper.procedure_class,
    anatomy_mapping: { ...procedureMapper.anatomy } as Record<string, unknown>,
    routing_target: procedureMapper.routing_target,
    technical_adequacy: imagingTechnicalAdequacy,
    allowed_report_template_type: deriveReportTemplateType(
      procedureMapper.routing_target,
      group_metadata.group_type
    ),
    group_provenance_summary: {
      coherent_subset_used: params.coherent_subset_used,
      had_quarantined_or_excluded_upload_files: hadQuarantine,
      adjudication_global_quarantine_file_ids: [
        ...(params.global_quarantine_file_ids ?? []),
      ],
    },
  };
}

const RENDERER_EN = `You are the RapiMed Strict Final Report Renderer.

You write the final structured medical report.
You do not discover new findings.
You do not reinterpret rejected items.
You do not browse.
You do not use general medical plausibility to add details.
You must obey locked_study_facts exactly.

INPUTS_JSON PRIMARY includes:
- locked_study_facts (immutable — copy procedure_class, report_family, anatomy, image_count, verified_views_or_series, file IDs, technical_quality, concern fields exactly into scope language; never contradict)
- technical_context (from adjudication)
- accepted_items, uncertain_items, cannot_determine_items, rejected_items (never mention rejected_items)
- important_terms_if_any
- recommended_follow_up_if_any
- group_id

AUXILIARY_CONTEXT: allowed_report_template_type, technical_adequacy, routing hints — template and tone only; never override locked_study_facts or adjudicated lists.

PRIMARY GOAL:
Render a professional report faithful to adjudicated evidence and locked study facts.

ABSOLUTE RULES:
1. Never introduce a finding not present in accepted_items or accepted_hedged items.
2. Never upgrade uncertain_items into definitive findings.
3. Never mention rejected_items.
4. Never contradict locked_study_facts.
5. Never change image_count.
6. Never change verified_views_or_series.
7. Never change anatomy.
8. Never change procedure_class.
9. Never change report_family.
10. Never raise concern above locked_study_facts.max_allowed_concern_level when it is not "unknown".
11. If no accepted items exist, generate a narrow safe report.
12. If cannot_determine_items exist, place them in limitations or indeterminate language only.
13. If technical quality is limited or non_diagnostic, state that plainly.
14. If study facts are broad, keep the report broad.
15. If evidence is weak, the report must become shorter, not more detailed.

SPECIAL ANTI-HALLUCINATION RULES:
- Do not create vertebral diagnoses, bronchiectasis, hilar adenopathy, osteopenia, Schmorl's nodes, pectus deformity, granuloma, or other specific labels unless they are explicitly present in accepted_items.
- Do not describe a study as a single view if locked_study_facts.image_count is a number greater than 1.
- Do not describe the study as spine-focused if anatomy.primary_structure is not spine-related.
- Do not describe AP/PA/lateral status unless present in locked_study_facts.verified_views_or_series.
- Do not use "consistent with" unless the accepted item wording supports that strength.
- Use hedged wording for accepted_hedged items.

CONCERN RULES:
- concern_level must equal or be lower (less urgent) than locked_study_facts.derived_concern_level_from_adjudication.
- If technical quality is limited and accepted evidence is sparse, prefer low or moderate.
- Never set high or urgent_review based on uncertainty language alone.

STYLE RULES:
- professional
- restrained
- short where evidence is weak
- precise where evidence is strong
- no marketing
- no filler
- no repeated boilerplate

OUTPUT JSON ONLY — exactly this shape (no extra keys, no markdown):
{
  "group_id": "string",
  "report_type": "imaging | laboratory | waveform | document | mixed_context",
  "plain_summary": "string",
  "professional_summary": "string",
  "concern_level": "low | moderate | high | urgent_review",
  "report_sections": {
    "exam_or_document_overview": "string",
    "technical_or_source_summary": "string",
    "key_results": ["string"],
    "detailed_results": ["string"],
    "impression_or_conclusion": "string",
    "limitations_or_uncertainties": ["string"],
    "recommended_follow_up": ["string"]
  },
  "important_terms": [ { "term": "string", "plain_explanation": "string" } ],
  "provenance_summary": {
    "included_file_ids": ["string"],
    "excluded_file_ids": ["string"],
    "coherent_subset_used": true
  }
}

provenance_summary must match locked_study_facts included_file_ids, excluded_file_ids, and coherent_subset_used exactly.

report_type must equal locked_study_facts.report_family when that family maps cleanly; otherwise use AUXILIARY_CONTEXT.allowed_report_template_type. Never use mixed_context unless the batch is explicitly mixed_context in locked facts or auxiliary group type is mixed_context_bundle.

FAIL-SAFE REPORTING MODE (zero accepted items):
- plain_summary must say no reliable specific conclusion could be established from the coherent material.
- key_results must be minimal.
- detailed_results must not speculate.
- concern_level must not exceed moderate.

RENDERING BY report_type (imaging / laboratory / waveform / document / mixed_context): same discipline as before — key_results only from accepted items; cannot_determine in limitations; document types do not become verified imaging claims; mixed_context keeps families separated.

FORBIDDEN: new findings; hidden inference; rejected_items; contradicting locked_study_facts; boilerplate repetition.
`;

const RENDERER_TR = `Sen RapiMed Katı Son Rapor Oluşturucusun (Strict Final Report Renderer).

Nihai yapılandırılmış tıbbi raporu yazarsın. Yeni bulgu keşfetmezsin; reddedilen öğeleri yorumlamazsın; tarama yapmazsın; genel tıbbi olasılıkla ayrıntı eklemezsin. locked_study_facts ile çelişemezsin.

GİRDİ: PRIMARY içinde locked_study_facts (değişmez gerçekler), technical_context, accepted/uncertain/cannot_determine/rejected (rejected yok say), important_terms_if_any, recommended_follow_up_if_any. AUXILIARY_CONTEXT yalnızca şablon ve ton.

MUTLAK KURALLAR (1–15), ÖZEL ANTI-HALLUCINATION, CONCERN ve ÜSLUP: İngilizce EN ile aynı mantık.

concern_level: derived_concern_level_from_adjudication ile eşit veya daha düşük aciliyet; max_allowed_concern_level "unknown" değilse onu da aşma. Kabul edilen öğe yoksa dar güvenli rapor; concern en fazla moderate.

ÇIKTI: Yalnızca geçerli JSON; EN şeması ile birebir alan adları ve enumlar. provenance_summary locked_study_facts ile birebir eşleşmeli.

`;

function stringifyInput(input: FinalReportRendererModelInput): string {
  const so = input.study_output;
  return JSON.stringify(
    {
      PRIMARY: {
        group_id: input.group_metadata.group_id,
        locked_study_facts: input.locked_study_facts,
        technical_context: so.technical_context ?? null,
        accepted_items: so.accepted_items,
        uncertain_items: so.uncertain_items,
        cannot_determine_items: so.cannot_determine_items,
        rejected_items: so.rejected_items,
        adjudication_summary: so.adjudication_summary,
        important_terms_if_any: input.important_terms_if_any,
        recommended_follow_up_if_any: input.recommended_follow_up_if_any,
      },
      AUXILIARY_CONTEXT: {
        group_type: input.group_metadata.group_type,
        group_confidence: input.group_metadata.group_confidence,
        group_rationale: input.group_metadata.group_rationale,
        procedure_class: input.procedure_class,
        anatomy_mapping: input.anatomy_mapping,
        routing_target: input.routing_target,
        technical_adequacy: input.technical_adequacy,
        allowed_report_template_type: input.allowed_report_template_type,
        group_provenance_summary: input.group_provenance_summary,
      },
    },
    null,
    2
  );
}

export function buildFinalReportRendererPrompt(
  language: "tr" | "en",
  input: FinalReportRendererModelInput
): string {
  const discipline =
    language === "tr" ? RAPIMED_PIPELINE_COMPONENT_RULES_TR : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const body = language === "tr" ? RENDERER_TR : RENDERER_EN;
  return `${discipline}

${body}

INPUTS_JSON:
${stringifyInput(input)}
`;
}

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

function parseImportantTerms(v: unknown): ImportantTermEntry[] {
  if (!Array.isArray(v)) return [];
  const out: ImportantTermEntry[] = [];
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue;
    const o = raw as Record<string, unknown>;
    const term = String(o.term ?? "").trim();
    const plain = String(o.plain_explanation ?? "").trim();
    if (term) out.push({ term, plain_explanation: plain });
  }
  return out;
}

function parseReportSections(raw: unknown): FinalReportSections {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    exam_or_document_overview: String(d.exam_or_document_overview ?? "").trim(),
    technical_or_source_summary: String(d.technical_or_source_summary ?? "").trim(),
    key_results: parseStringArray(d.key_results),
    detailed_results: parseStringArray(d.detailed_results),
    impression_or_conclusion: String(d.impression_or_conclusion ?? "").trim(),
    limitations_or_uncertainties: parseStringArray(d.limitations_or_uncertainties),
    recommended_follow_up: parseStringArray(d.recommended_follow_up),
  };
}

const CONCERN_RANK: Record<DerivedConcernLevel, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  urgent_review: 3,
};

/** Returns the less urgent of two concern levels (lower rank). */
function lesserConcern(a: DerivedConcernLevel, b: DerivedConcernLevel): DerivedConcernLevel {
  return CONCERN_RANK[a] <= CONCERN_RANK[b] ? a : b;
}

function clampFinalReportConcern(
  parsed: DerivedConcernLevel,
  input: FinalReportRendererModelInput
): DerivedConcernLevel {
  const lf = input.locked_study_facts;
  let x = lesserConcern(parsed, lf.derived_concern_level_from_adjudication);
  const max = lf.max_allowed_concern_level;
  if (max !== "unknown" && CONCERN_SET.has(max)) {
    x = lesserConcern(x, max as DerivedConcernLevel);
  }
  const acceptedN = input.study_output.accepted_items.length;
  if (acceptedN === 0) {
    x = lesserConcern(x, "moderate");
  }
  const tech = lf.technical_quality;
  if ((tech === "limited" || tech === "non_diagnostic") && acceptedN <= 1) {
    x = lesserConcern(x, "moderate");
  }
  return x;
}

function provenanceFromLockedFacts(
  input: FinalReportRendererModelInput
): FinalReportProvenanceSummary {
  const lf = input.locked_study_facts;
  return {
    included_file_ids: [...lf.included_file_ids],
    excluded_file_ids: [...lf.excluded_file_ids],
    coherent_subset_used: lf.coherent_subset_used,
  };
}

/**
 * Parse a final-report-shaped object (root or nested repaired_report) against locked facts.
 */
export function parseFinalReportBody(
  o: Record<string, unknown>,
  input: FinalReportRendererModelInput
): FinalReportRenderResult | null {
  const groupId = String(o.group_id ?? input.group_metadata.group_id).trim();
  if (!groupId) return null;

  const lfRt = input.locked_study_facts.report_family;
  const report_type: FinalReportType = REPORT_TYPES.has(lfRt)
    ? (lfRt as FinalReportType)
    : REPORT_TYPES.has(String(o.report_type ?? ""))
      ? (String(o.report_type) as FinalReportType)
      : input.allowed_report_template_type;

  const clRaw = String(o.concern_level ?? "");
  const parsedConcern: DerivedConcernLevel = CONCERN_SET.has(clRaw)
    ? (clRaw as DerivedConcernLevel)
    : input.locked_study_facts.derived_concern_level_from_adjudication;
  const concern_level = clampFinalReportConcern(parsedConcern, input);

  return {
    group_id: groupId,
    report_type,
    plain_summary: String(o.plain_summary ?? "").trim(),
    professional_summary: String(o.professional_summary ?? "").trim(),
    concern_level,
    report_sections: parseReportSections(o.report_sections),
    important_terms: parseImportantTerms(o.important_terms),
    provenance_summary: provenanceFromLockedFacts(input),
  };
}

export function parseFinalReportRenderResult(
  raw: unknown,
  input: FinalReportRendererModelInput,
  _excludedFileIdsFallback: string[]
): FinalReportRenderResult | null {
  if (!raw || typeof raw !== "object") return null;
  return parseFinalReportBody(raw as Record<string, unknown>, input);
}

/** After constrained repair (or any model edit), re-sync type, concern, and provenance with lockers. */
export function enforceFinalReportAgainstLockedFacts(
  report: FinalReportRenderResult,
  input: FinalReportRendererModelInput
): FinalReportRenderResult {
  const lfRt = input.locked_study_facts.report_family;
  const report_type: FinalReportType = REPORT_TYPES.has(lfRt)
    ? (lfRt as FinalReportType)
    : report.report_type;

  const clRaw = String(report.concern_level ?? "");
  const parsedConcern: DerivedConcernLevel = CONCERN_SET.has(clRaw)
    ? (clRaw as DerivedConcernLevel)
    : input.locked_study_facts.derived_concern_level_from_adjudication;
  const concern_level = clampFinalReportConcern(parsedConcern, input);

  return {
    ...report,
    group_id: String(input.group_metadata.group_id || report.group_id).trim(),
    report_type,
    concern_level,
    provenance_summary: provenanceFromLockedFacts(input),
  };
}

export function defaultFinalReportRenderResult(
  input: FinalReportRendererModelInput,
  _excludedFileIdsFallback: string[],
  reason: string,
  language: "tr" | "en"
): FinalReportRenderResult {
  const narrow =
    language === "tr"
      ? "Sunulan tutarlı materyalden güvenilir özgül bir sonuç çıkarılamadı."
      : "No reliable specific conclusion could be established from the coherent material provided.";
  const techSubset =
    language === "tr"
      ? "Bu değerlendirme yüklenen dosyaların tutarlı bir alt kümesine dayanmaktadır."
      : "A coherent subset of uploaded files was used for this assessment.";

  const concern_level = clampFinalReportConcern(
    input.locked_study_facts.derived_concern_level_from_adjudication,
    input
  );

  const lfRt = input.locked_study_facts.report_family;
  const report_type: FinalReportType = REPORT_TYPES.has(lfRt)
    ? (lfRt as FinalReportType)
    : input.allowed_report_template_type;

  return {
    group_id: input.group_metadata.group_id || input.study_output.group_id,
    report_type,
    plain_summary: narrow,
    professional_summary: `${narrow} (${reason})`.trim(),
    concern_level,
    report_sections: {
      exam_or_document_overview: "",
      technical_or_source_summary: input.locked_study_facts.coherent_subset_used
        ? techSubset
        : "",
      key_results: [],
      detailed_results: [],
      impression_or_conclusion: narrow,
      limitations_or_uncertainties: [reason, narrow].filter(Boolean),
      recommended_follow_up: [],
    },
    important_terms: [],
    provenance_summary: provenanceFromLockedFacts(input),
  };
}
