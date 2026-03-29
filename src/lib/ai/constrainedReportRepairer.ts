/**
 * RapiMed Constrained Report Repairer — patch invalid final reports from validator output (text-only JSON).
 * Does not inspect raw images; does not re-run full render from scratch.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type { StudyAdjudicationOutput } from "./evidenceAdjudicatorMerger";
import type {
  FinalReportRenderResult,
  FinalReportRendererModelInput,
} from "./finalReportRenderer";
import {
  enforceFinalReportAgainstLockedFacts,
  parseFinalReportBody,
} from "./finalReportRenderer";
import type { LockedStudyFacts } from "./studyFactLocker";
import type { FinalReportValidationResult } from "./finalReportValidator";

export interface ConstrainedReportRepairerInput {
  locked_study_facts: LockedStudyFacts;
  technical_context: StudyAdjudicationOutput["technical_context"];
  accepted_items: StudyAdjudicationOutput["accepted_items"];
  uncertain_items: StudyAdjudicationOutput["uncertain_items"];
  cannot_determine_items: StudyAdjudicationOutput["cannot_determine_items"];
  rejected_items: StudyAdjudicationOutput["rejected_items"];
  invalid_rendered_report_json: FinalReportRenderResult;
  validator_output: FinalReportValidationResult;
}

export interface ConstrainedReportRepairResult {
  group_id: string;
  repaired_report: FinalReportRenderResult;
  repair_summary: string[];
}

const REPAIRER_EN = `You are the RapiMed Constrained Report Repairer.

You repair an already-rendered report using validator findings.
You do not inspect raw images.
You do not invent new findings.
You do not browse.
You do not start over from scratch.
You only repair invalid parts so the report becomes faithful to locked facts and adjudicated evidence.

INPUTS_JSON contains:
- locked_study_facts
- technical_context
- accepted_items, uncertain_items, cannot_determine_items, rejected_items
- invalid_rendered_report_json (the report to fix)
- validator_output (issues, blocking_reasons, validation_results categories)

PRIMARY GOAL:
Produce a corrected report that removes contradictions, unsupported findings, and invalid concern escalation.

MANDATORY REPAIR RULES:
1. Remove every finding not traceable to accepted_items (including accepted_hedged only with appropriate hedging).
2. Downgrade accepted_hedged wording if it was rendered too strongly.
3. Remove all rejected-item content and any wording that echoes rejected_items.
4. Remove all study-fact contradictions (image_count, verified_views_or_series, anatomy, procedure_class, report_family).
5. Remove invented anatomy/modality/laterality claims not supported by locked_study_facts and accepted_items.
6. Reduce concern_level if validator flagged concern inconsistency or if it exceeds derived/max allowed in locked_study_facts.
7. If evidence is weak, shorten the report (fewer detailed_results lines, tighter summaries).
8. If no accepted items remain after repair, switch to fail-safe narrow reporting: plain_summary states no reliable specific conclusion from coherent material; minimal key_results; no speculation in detailed_results; concern_level at most moderate.
9. Preserve provenance_summary exactly as in locked_study_facts (included_file_ids, excluded_file_ids, coherent_subset_used) — copy from locked_study_facts, do not invent IDs.
10. Do not add any new medical claim during repair.

Use validator_output.blocking_reasons and validation_results.*.issues as your repair checklist.

OUTPUT JSON ONLY — exactly this shape (no markdown, no extra keys):
{
  "group_id": "string",
  "repaired_report": {
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
  },
  "repair_summary": ["string"]
}

Use group_id from INPUTS_JSON.locked_study_facts scope / invalid_rendered_report_json as appropriate.
`;

const REPAIRER_TR = `Sen RapiMed Kısıtlı Rapor Onarıcısısın (Constrained Report Repairer).

Ham görüntü incelemesi yok; yeni bulgu yok; tarama yok; sıfırdan rapor yok. Yalnızca validator bulgularına göre invalid_rendered_report_json düzelt.

ONARIM KURALLARI (1–10): İngilizce EN ile aynı. provenance_summary locked_study_facts ile birebir.

ÇIKTI: Yalnızca geçerli JSON; EN şeması ile birebir.
`;

export function buildConstrainedReportRepairerPrompt(
  language: "tr" | "en",
  repairInput: ConstrainedReportRepairerInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? REPAIRER_TR : REPAIRER_EN;
  const payload = {
    locked_study_facts: repairInput.locked_study_facts,
    technical_context: repairInput.technical_context ?? null,
    accepted_items: repairInput.accepted_items,
    uncertain_items: repairInput.uncertain_items,
    cannot_determine_items: repairInput.cannot_determine_items,
    rejected_items: repairInput.rejected_items,
    invalid_rendered_report_json: repairInput.invalid_rendered_report_json,
    validator_output: repairInput.validator_output,
  };
  return `${discipline}

${spec}

Return ONLY valid JSON matching the schema. No markdown fences.

INPUTS_JSON:
${JSON.stringify(payload, null, 2)}
`;
}

export function parseConstrainedReportRepairResult(
  raw: unknown,
  rendererInput: FinalReportRendererModelInput
): ConstrainedReportRepairResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const group_id = String(o.group_id ?? rendererInput.group_metadata.group_id).trim();
  if (!group_id) return null;
  const rr = o.repaired_report;
  if (!rr || typeof rr !== "object") return null;
  const body = parseFinalReportBody(rr as Record<string, unknown>, rendererInput);
  if (!body) return null;

  const repair_summary = Array.isArray(o.repair_summary)
    ? o.repair_summary.map(String).filter(Boolean)
    : [];

  const enforced = enforceFinalReportAgainstLockedFacts(body, rendererInput);

  return {
    group_id,
    repaired_report: enforced,
    repair_summary,
  };
}

export function fallbackConstrainedRepairEnforcementOnly(
  repairInput: ConstrainedReportRepairerInput,
  rendererInput: FinalReportRendererModelInput,
  reason: string
): ConstrainedReportRepairResult {
  const enforced = enforceFinalReportAgainstLockedFacts(
    repairInput.invalid_rendered_report_json,
    rendererInput
  );
  return {
    group_id: rendererInput.group_metadata.group_id,
    repaired_report: enforced,
    repair_summary: [`enforcement_only:${reason}`],
  };
}
