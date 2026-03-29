/**
 * RapiMed Final Report Validator — audits rendered JSON vs locked study facts and adjudication (text-only JSON).
 * Does not rewrite the report; combines model audit with mandatory deterministic checks.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type { StudyAdjudicationOutput } from "./evidenceAdjudicatorMerger";
import type { FinalReportRenderResult } from "./finalReportRenderer";
import type { LockedStudyFacts } from "./studyFactLocker";

export type ReportPublishability = "publish" | "repair_required" | "block";

export interface CategoryValidation {
  passed: boolean;
  issues: string[];
}

export interface FinalReportValidationResult {
  group_id: string;
  is_valid: boolean;
  publishability: ReportPublishability;
  validation_results: {
    study_fact_consistency: CategoryValidation;
    evidence_consistency: CategoryValidation;
    concern_consistency: CategoryValidation;
    limitation_consistency: CategoryValidation;
    forbidden_content: CategoryValidation;
  };
  repair_instructions: string[];
  blocking_reasons: string[];
}

export interface FinalReportValidatorInput {
  group_id: string;
  locked_study_facts: LockedStudyFacts;
  technical_context: StudyAdjudicationOutput["technical_context"];
  accepted_items: StudyAdjudicationOutput["accepted_items"];
  uncertain_items: StudyAdjudicationOutput["uncertain_items"];
  cannot_determine_items: StudyAdjudicationOutput["cannot_determine_items"];
  rejected_items: StudyAdjudicationOutput["rejected_items"];
  rendered_report_json: FinalReportRenderResult;
}

const VALIDATOR_EN = `You are the RapiMed Final Report Validator.

You do not rewrite the report.
You do not diagnose.
You only audit whether the rendered report is valid against locked study facts and adjudicated evidence.

INPUTS_JSON contains:
- locked_study_facts
- technical_context
- accepted_items, uncertain_items, cannot_determine_items, rejected_items
- rendered_report_json (the full final report object)

PRIMARY GOAL:
Detect contradictions, unsupported findings, invalid concern escalation, and study-fact drift.

VALIDATION CATEGORIES (each must appear under validation_results with passed boolean and issues string array):
1. study_fact_consistency
2. evidence_consistency
3. concern_consistency
4. limitation_consistency
5. forbidden_content

Also set overall is_valid, publishability, repair_instructions, blocking_reasons.

MANDATORY CHECKS:

A. STUDY FACT CONSISTENCY
- Does the report match image_count?
- Does the report match verified_views_or_series?
- Does the report match anatomy?
- Does the report match procedure_class?
- Does the report match report_family?
- Does the report preserve coherent subset scope (provenance_summary vs locked facts)?

B. EVIDENCE CONSISTENCY
- Is every definitive finding traceable to an accepted item (accepted or accepted_hedged)?
- Are accepted_hedged items kept hedged in wording?
- Are uncertain items kept out of definitive sections?
- Are rejected items absent from report text?
- Are cannot_determine items reflected only as limitations/uncertainty, not as definitive findings?

C. CONCERN CONSISTENCY
- Is concern_level <= locked_study_facts.max_allowed_concern_level when max_allowed is not "unknown"?
- Is concern_level <= locked_study_facts.derived_concern_level_from_adjudication (same or less urgent)?
- If evidence is weak, is concern restrained?
- Is elevated concern supported only by accepted items, not by uncertainty?

D. LIMITATION CONSISTENCY
- If technical quality is limited/non_diagnostic in locked facts, is that reflected?
- If cannot_determine_items exist, are they reflected as limitations?
- Does the report overstate certainty despite limited quality?

E. FORBIDDEN CONTENT
Flag issues if the report contains without support in accepted_items:
- invented diagnoses or specific disease labels not in accepted_items
- new anatomical structures, modality claims, or laterality
- "single view" type claims when image_count > 1
- spine-focused framing when anatomy.primary_structure is not spine-related
- internally contradictory statements
- any echo of rejected_items content

BLOCK (set publishability to "block" and list in blocking_reasons) when you detect:
- contradiction with image_count
- contradiction with anatomy
- definitive findings not traceable to accepted_items
- concern exceeds allowed or derived caps
- rejected_items content appears in the report
- invented disease labels not in accepted_items

If only minor fixable wording issues: publishability "repair_required".
If no material issues: publishability "publish", is_valid true.

OUTPUT JSON ONLY — exactly this shape (no markdown, no extra keys):
{
  "group_id": "string",
  "is_valid": true,
  "publishability": "publish | repair_required | block",
  "validation_results": {
    "study_fact_consistency": { "passed": true, "issues": ["string"] },
    "evidence_consistency": { "passed": true, "issues": ["string"] },
    "concern_consistency": { "passed": true, "issues": ["string"] },
    "limitation_consistency": { "passed": true, "issues": ["string"] },
    "forbidden_content": { "passed": true, "issues": ["string"] }
  },
  "repair_instructions": ["string"],
  "blocking_reasons": ["string"]
}

Use group_id from INPUTS_JSON.group_id.
`;

const VALIDATOR_TR = `Sen RapiMed Nihai Rapor Doğrulayıcısısın.

Raporu yeniden yazmazsın; tanı koymazsın. Yalnızca kilitli study facts ve hakem kanıtına karşı rendered_report_json denetlersin.

KATEGORİLER ve ZORUNLU KONTROLLER: İngilizce EN ile aynı. publishability: publish | repair_required | block.

ÇIKTI: Yalnızca geçerli JSON; EN şeması ile birebir anahtarlar.
`;

type Concern = "low" | "moderate" | "high" | "urgent_review";

const CONCERN_RANK: Record<Concern, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  urgent_review: 3,
};

function parseConcern(s: string): Concern | null {
  const v = s.trim();
  if (v === "low" || v === "moderate" || v === "high" || v === "urgent_review") return v;
  return null;
}

function emptyCategory(): CategoryValidation {
  return { passed: true, issues: [] };
}

function parseCategory(raw: unknown): CategoryValidation {
  if (!raw || typeof raw !== "object") return { passed: false, issues: ["parse_missing_category"] };
  const o = raw as Record<string, unknown>;
  const passed = o.passed === true;
  const issues = Array.isArray(o.issues) ? o.issues.map(String).filter(Boolean) : [];
  return { passed, issues };
}

export function buildFinalReportValidatorPrompt(
  language: "tr" | "en",
  input: FinalReportValidatorInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? VALIDATOR_TR : VALIDATOR_EN;
  const payload = {
    group_id: input.group_id,
    locked_study_facts: input.locked_study_facts,
    technical_context: input.technical_context ?? null,
    accepted_items: input.accepted_items,
    uncertain_items: input.uncertain_items,
    cannot_determine_items: input.cannot_determine_items,
    rejected_items: input.rejected_items,
    rendered_report_json: input.rendered_report_json,
  };
  return `${discipline}

${spec}

Return ONLY valid JSON matching the schema. No markdown fences.

INPUTS_JSON:
${JSON.stringify(payload, null, 2)}
`;
}

export function parseFinalReportValidationResult(
  raw: unknown,
  fallbackGroupId: string
): FinalReportValidationResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const group_id = String(o.group_id ?? fallbackGroupId).trim();
  if (!group_id) return null;
  const vr = o.validation_results;
  if (!vr || typeof vr !== "object") return null;
  const vro = vr as Record<string, unknown>;

  const pub = String(o.publishability ?? "");
  const publishability: ReportPublishability =
    pub === "publish" || pub === "repair_required" || pub === "block" ? pub : "repair_required";

  return {
    group_id,
    is_valid: o.is_valid === true,
    publishability,
    validation_results: {
      study_fact_consistency: parseCategory(vro.study_fact_consistency),
      evidence_consistency: parseCategory(vro.evidence_consistency),
      concern_consistency: parseCategory(vro.concern_consistency),
      limitation_consistency: parseCategory(vro.limitation_consistency),
      forbidden_content: parseCategory(vro.forbidden_content),
    },
    repair_instructions: Array.isArray(o.repair_instructions)
      ? o.repair_instructions.map(String).filter(Boolean)
      : [],
    blocking_reasons: Array.isArray(o.blocking_reasons)
      ? o.blocking_reasons.map(String).filter(Boolean)
      : [],
  };
}

export function defaultFinalReportValidationResult(
  groupId: string,
  reason: string
): FinalReportValidationResult {
  const fail = { passed: false, issues: [reason] };
  return {
    group_id: groupId,
    is_valid: false,
    publishability: "repair_required",
    validation_results: {
      study_fact_consistency: emptyCategory(),
      evidence_consistency: emptyCategory(),
      concern_consistency: emptyCategory(),
      limitation_consistency: emptyCategory(),
      forbidden_content: emptyCategory(),
    },
    repair_instructions: ["Re-run final report validation or review pipeline logs."],
    blocking_reasons: [reason],
  };
}

function sortIds(ids: string[]): string[] {
  return [...ids].map(String).sort();
}

/**
 * Hard safety rules that do not depend on the LLM audit.
 */
export function applyDeterministicValidatorEnforcement(
  input: FinalReportValidatorInput,
  llm: FinalReportValidationResult
): FinalReportValidationResult {
  const lf = input.locked_study_facts;
  const r = input.rendered_report_json;
  const blocking: string[] = [...llm.blocking_reasons];
  const repair: string[] = [...llm.repair_instructions];
  const vr = {
    study_fact_consistency: { ...llm.validation_results.study_fact_consistency },
    evidence_consistency: { ...llm.validation_results.evidence_consistency },
    concern_consistency: { ...llm.validation_results.concern_consistency },
    limitation_consistency: { ...llm.validation_results.limitation_consistency },
    forbidden_content: { ...llm.validation_results.forbidden_content },
  };

  const pushBlock = (code: string, cat: keyof typeof vr, msg: string) => {
    blocking.push(code);
    vr[cat].passed = false;
    if (!vr[cat].issues.includes(msg)) vr[cat].issues.push(msg);
  };

  const renderedConcern = parseConcern(r.concern_level);
  const derived = parseConcern(lf.derived_concern_level_from_adjudication);
  if (renderedConcern && derived && CONCERN_RANK[renderedConcern] > CONCERN_RANK[derived]) {
    pushBlock(
      "concern_exceeds_derived",
      "concern_consistency",
      "Rendered concern_level exceeds locked derived_concern_level_from_adjudication"
    );
  }

  const maxA = lf.max_allowed_concern_level;
  if (maxA !== "unknown" && renderedConcern) {
    const maxC = parseConcern(maxA);
    if (maxC && CONCERN_RANK[renderedConcern] > CONCERN_RANK[maxC]) {
      pushBlock(
        "concern_exceeds_max_allowed",
        "concern_consistency",
        "Rendered concern_level exceeds locked max_allowed_concern_level"
      );
    }
  }

  if (
    JSON.stringify(sortIds(r.provenance_summary.included_file_ids)) !==
    JSON.stringify(sortIds(lf.included_file_ids))
  ) {
    pushBlock(
      "provenance_included_mismatch",
      "study_fact_consistency",
      "provenance_summary.included_file_ids does not match locked_study_facts"
    );
  }
  if (
    JSON.stringify(sortIds(r.provenance_summary.excluded_file_ids)) !==
    JSON.stringify(sortIds(lf.excluded_file_ids))
  ) {
    pushBlock(
      "provenance_excluded_mismatch",
      "study_fact_consistency",
      "provenance_summary.excluded_file_ids does not match locked_study_facts"
    );
  }
  if (r.provenance_summary.coherent_subset_used !== lf.coherent_subset_used) {
    pushBlock(
      "provenance_coherent_flag_mismatch",
      "study_fact_consistency",
      "provenance_summary.coherent_subset_used does not match locked_study_facts"
    );
  }

  const rf = String(r.report_type ?? "");
  const lfr = String(lf.report_family ?? "");
  if (lfr && rf && rf !== lfr) {
    pushBlock(
      "report_type_report_family_mismatch",
      "study_fact_consistency",
      `report_type "${rf}" does not match locked report_family "${lfr}"`
    );
  }

  const ic = lf.image_count;
  if (typeof ic === "number" && ic > 1) {
    const blob = JSON.stringify(r).toLowerCase();
    if (/\bsingle\s+(view|image|film|radiograph)\b/.test(blob)) {
      pushBlock(
        "single_view_contradicts_image_count",
        "study_fact_consistency",
        "Report implies single view but locked image_count > 1"
      );
    }
  }

  const spineHint = /\b(spine|spinal|vertebr|lumbar|cervical|thoracic\s+spine)\b/i;
  const primary = String(lf.anatomy?.primary_structure ?? "").toLowerCase();
  const bodyR = String(lf.anatomy?.body_region ?? "").toLowerCase();
  const spineLocked = spineHint.test(primary) || spineHint.test(bodyR);
  if (!spineLocked) {
    const blob = JSON.stringify(r).toLowerCase();
    if (
      /\b(spine-focused|spinal\s+study|lumbar\s+spine\s+study|cervical\s+spine\s+study)\b/.test(
        blob
      )
    ) {
      pushBlock(
        "spine_framing_without_spine_anatomy",
        "study_fact_consistency",
        "Report frames study as spine-focused but locked anatomy is not spine-related"
      );
    }
  }

  const blobFull = JSON.stringify(r).toLowerCase();
  for (const rej of input.rejected_items) {
    const label = String(rej.label ?? "").trim();
    if (label.length >= 6 && blobFull.includes(label.toLowerCase())) {
      pushBlock(
        "rejected_label_in_report",
        "forbidden_content",
        "Report text may include content aligned with a rejected adjudication item"
      );
      break;
    }
  }

  const deterministicAdded = blocking.length > llm.blocking_reasons.length;
  let publishability = llm.publishability;
  let is_valid = llm.is_valid;
  if (deterministicAdded) {
    publishability = "block";
    is_valid = false;
  }
  const anyCategoryFailed = Object.values(vr).some((c) => !c.passed);
  if (anyCategoryFailed) {
    is_valid = false;
    if (publishability === "publish") publishability = "repair_required";
  }
  if (publishability === "block") is_valid = false;

  return {
    group_id: llm.group_id,
    is_valid,
    publishability,
    validation_results: vr,
    repair_instructions: repair,
    blocking_reasons: blocking,
  };
}
