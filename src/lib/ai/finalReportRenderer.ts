/**
 * RapiMed final report renderer — structured report from adjudicated evidence only.
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

export function buildFinalReportRendererModelInput(params: {
  study_output: StudyAdjudicationOutput;
  cohesion: UploadCohesionResult;
  procedureMapper: ProcedureMapperResult;
  imagingTechnicalAdequacy: TechnicalAdequacy | null;
  coherent_subset_used: boolean;
  global_quarantine_file_ids?: string[];
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

  return {
    study_output,
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

const RENDERER_EN = `You are the RapiMed Final Report Renderer.

You write the final structured report.
You do not discover new findings.
You do not reinterpret rejected items.
You do not browse.
You write only from adjudicated evidence.

INPUTS (under PRIMARY in INPUTS_JSON; ignore rejected_items for all medical wording):
- group_id
- content_profile
- technical_context
- accepted_items
- uncertain_items
- cannot_determine_items
- rejected_items
- derived_concern_level
- included_file_ids
- excluded_file_ids

AUXILIARY_CONTEXT in INPUTS_JSON supplies allowed_report_template_type, technical_adequacy, procedure_class, anatomy_mapping, routing_target, and group_provenance_summary — use only to choose report_type template and scope language; never override adjudicated evidence.

RULE OF REPORTING:
1. Accepted items may be stated directly.
2. Accepted_hedged items must remain hedged.
3. Uncertain items must not appear as definitive findings.
4. Cannot_determine items belong in limitations or indeterminate sections.
5. Rejected items must never appear.
6. If excluded or quarantined files existed, do not discuss their content in the medical conclusion.
7. If the report is based on a coherent subset, state that only in source scope language.
8. Never output contradictions between key results, detailed results, impression, and limitations.
9. Never claim anatomy, modality, laterality, measurements, dates, or diagnoses beyond what the inputs support.
10. If evidence is sparse, write a narrow report, not a speculative one.
11. If there are zero accepted and zero accepted_hedged items, produce a minimal safe report stating that no reliable specific conclusion could be established from the coherent material.

STYLE:
- professional
- restrained
- clinical
- patient-safe
- no marketing
- no fear amplification
- no fake certainty

concern_level: Set equal to derived_concern_level. Do not escalate above it. You may only lower it if the rendered content cannot support the assigned level.

report_type: Must equal allowed_report_template_type from AUXILIARY_CONTEXT unless the evidence mix clearly forces mixed_context.

OUTPUT CONTRACT:
Return valid JSON only, exactly this shape (no extra keys):
{
  "group_id": "string",
  "report_type": "imaging | laboratory | waveform | document | mixed_context",
  "plain_summary": "string",
  "professional_summary": "string",
  "concern_level": "low | moderate | high | urgent_review",
  "report_sections": {
    "exam_or_document_overview": "string",
    "technical_or_source_summary": "string",
    "key_results": [
      "string"
    ],
    "detailed_results": [
      "string"
    ],
    "impression_or_conclusion": "string",
    "limitations_or_uncertainties": [
      "string"
    ],
    "recommended_follow_up": [
      "string"
    ]
  },
  "important_terms": [
    {
      "term": "string",
      "plain_explanation": "string"
    }
  ],
  "provenance_summary": {
    "included_file_ids": ["string"],
    "excluded_file_ids": ["string"],
    "coherent_subset_used": true
  }
}

Use PRIMARY.group_id for group_id. provenance_summary.included_file_ids and excluded_file_ids must match PRIMARY; coherent_subset_used from AUXILIARY_CONTEXT.group_provenance_summary.

RENDERING RULES BY REPORT TYPE:

IF report_type = imaging:
- exam_or_document_overview must state imaging scope or view/series scope if known
- technical_or_source_summary must summarize adequacy and coverage
- key_results must come only from accepted items
- limitations must include cannot_determine items where relevant
- impression must not introduce a new disease or anatomy

IF report_type = laboratory:
- key_results should focus on clearly extracted abnormal or clinically notable test results
- detailed_results may include representative values if present
- limitations should mention OCR ambiguity, missing units, missing ranges, or unclear formatting

IF report_type = waveform:
- key_results must be restricted to supported waveform facts
- limitations must mention signal quality when limited

IF report_type = document:
- make clear that conclusions reflect document-stated content
- do not convert document text into independently verified imaging findings

IF report_type = mixed_context:
- keep evidence families separated inside results
- never fuse them into one unsupported medical claim

FORBIDDEN:
- new findings
- hidden diagnosis inference
- unsupported concern escalation
- mention of rejected items
- blended unrelated studies
`;

const RENDERER_TR = `Sen RapiMed Son Rapor Oluşturucusun.

Yapılandırılmış nihai raporu yazarsın.
Yeni bulgu keşfetmezsin; reddedilen öğeleri yeniden yorumlamazsın; tarama yapmazsın.
Yalnızca hakemden geçmiş kanıttan yazarsın.

INPUTS_JSON: PRIMARY (group_id, content_profile, technical_context, accepted/uncertain/cannot_determine/rejected — rejected yok say, derived_concern_level, included_file_ids, excluded_file_ids) ve AUXILIARY_CONTEXT (procedure_class, anatomy_mapping, routing_target, technical_adequacy, allowed_report_template_type, group_type, group_provenance_summary).

RULE OF REPORTING (1–11) ve RENDERING RULES BY REPORT TYPE: İngilizce EN ile birebir aynı mantık. accepted_items listesindeki hem accepted hem accepted_hedged ifadeleri kullanılabilir; accepted_hedged her yerde çekimli kalmalı. Imaging: key_results yalnızca accepted_items kaynaklı; cannot_determine limitations’ta.

Üslup: profesyonel, ölçülü, klinik, hasta güvenliği; pazarlama, korku artırma, sahte kesinlik yok.

concern_level: PRIMARY.derived_concern_level ile aynı; yükseltme yok. report_type: çoğunlukla AUXILIARY_CONTEXT.allowed_report_template_type.

Çıktı: Yalnızca geçerli JSON; alan adları ve enumlar İngilizce şema ile birebir.

`;

function stringifyInput(input: FinalReportRendererModelInput): string {
  const so = input.study_output;
  return JSON.stringify(
    {
      PRIMARY: {
        group_id: input.group_metadata.group_id,
        content_profile: so.content_profile ?? null,
        technical_context: so.technical_context ?? null,
        accepted_items: so.accepted_items,
        uncertain_items: so.uncertain_items,
        cannot_determine_items: so.cannot_determine_items,
        rejected_items: so.rejected_items,
        derived_concern_level: so.derived_concern_level,
        adjudication_summary: so.adjudication_summary,
        included_file_ids: [...input.group_metadata.included_file_ids],
        excluded_file_ids: [...input.excluded_file_ids],
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

function parseProvenanceSummary(
  raw: unknown,
  fallback: FinalReportProvenanceSummary
): FinalReportProvenanceSummary {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    included_file_ids: Array.isArray(d.included_file_ids)
      ? d.included_file_ids.map(String)
      : fallback.included_file_ids,
    excluded_file_ids: Array.isArray(d.excluded_file_ids)
      ? d.excluded_file_ids.map(String)
      : fallback.excluded_file_ids,
    coherent_subset_used:
      typeof d.coherent_subset_used === "boolean"
        ? d.coherent_subset_used
        : fallback.coherent_subset_used,
  };
}

export function parseFinalReportRenderResult(
  raw: unknown,
  input: FinalReportRendererModelInput,
  excludedFileIdsFallback: string[]
): FinalReportRenderResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const groupId = String(o.group_id ?? input.group_metadata.group_id).trim();
  if (!groupId) return null;

  const rt = String(o.report_type ?? "");
  let report_type: FinalReportType = REPORT_TYPES.has(rt)
    ? (rt as FinalReportType)
    : input.allowed_report_template_type;

  if (
    report_type === "mixed_context" &&
    input.group_metadata.group_type !== "mixed_context_bundle"
  ) {
    report_type = deriveReportTemplateType(
      input.routing_target as ProcedureMapperResult["routing_target"],
      input.group_metadata.group_type
    );
  }

  const cl = String(o.concern_level ?? "");
  const concern_level: DerivedConcernLevel = CONCERN_SET.has(cl)
    ? (cl as DerivedConcernLevel)
    : input.study_output.derived_concern_level;

  const fallbackProv: FinalReportProvenanceSummary = {
    included_file_ids: [...input.group_metadata.included_file_ids],
    excluded_file_ids: [...excludedFileIdsFallback],
    coherent_subset_used: input.group_provenance_summary.coherent_subset_used,
  };

  return {
    group_id: groupId,
    report_type,
    plain_summary: String(o.plain_summary ?? "").trim(),
    professional_summary: String(o.professional_summary ?? "").trim(),
    concern_level,
    report_sections: parseReportSections(o.report_sections),
    important_terms: parseImportantTerms(o.important_terms),
    provenance_summary: parseProvenanceSummary(o.provenance_summary, fallbackProv),
  };
}

export function defaultFinalReportRenderResult(
  input: FinalReportRendererModelInput,
  excludedFileIdsFallback: string[],
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

  return {
    group_id: input.group_metadata.group_id || input.study_output.group_id,
    report_type: input.allowed_report_template_type,
    plain_summary: narrow,
    professional_summary: `${narrow} (${reason})`.trim(),
    concern_level: input.study_output.derived_concern_level,
    report_sections: {
      exam_or_document_overview: "",
      technical_or_source_summary: input.group_provenance_summary.coherent_subset_used
        ? techSubset
        : "",
      key_results: [],
      detailed_results: [],
      impression_or_conclusion: narrow,
      limitations_or_uncertainties: [reason, narrow].filter(Boolean),
      recommended_follow_up: [],
    },
    important_terms: [],
    provenance_summary: {
      included_file_ids: [...input.group_metadata.included_file_ids],
      excluded_file_ids:
        input.excluded_file_ids.length > 0
          ? [...input.excluded_file_ids]
          : [...excludedFileIdsFallback],
      coherent_subset_used: input.group_provenance_summary.coherent_subset_used,
    },
  };
}
