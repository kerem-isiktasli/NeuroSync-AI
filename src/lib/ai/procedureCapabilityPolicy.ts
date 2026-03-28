/**
 * RapiMed procedure capability policy evaluator — text-only; no raw files, no diagnosis.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type { ImagingAtomicExtractionResult } from "./imagingAtomicExtractor";
import type { LaboratoryReportExtractionResult } from "./laboratoryReportExtractor";
import type { WaveformExtractionResult } from "./waveformExtractor";
import type { ProcedureMapperResult, RoutingTarget } from "./procedureModalityAnatomyMapper";

export type CapabilityDecision =
  | "within_capability"
  | "outside_capability"
  | "conditionally_within_capability"
  | "unknown_capability";

export interface CapabilityPolicyDecisionRow {
  label: string;
  decision: CapabilityDecision;
  reason: string;
}

export interface ProcedureCapabilityPolicyResult {
  procedure_class: string;
  capability_decisions: CapabilityPolicyDecisionRow[];
}

export interface ProcedureCapabilityPolicyInput {
  procedure_class: string;
  anatomy_mapping: Record<string, unknown>;
  candidate_labels: string[];
}

const DECISION_SET = new Set<string>([
  "within_capability",
  "outside_capability",
  "conditionally_within_capability",
  "unknown_capability",
]);

const MAX_LABELS = 100;

export function collectCandidateLabelsForCapabilityPolicy(params: {
  routingTarget: RoutingTarget;
  imagingAtomic: ImagingAtomicExtractionResult | null;
  labExtraction: LaboratoryReportExtractionResult | null;
  waveformExtraction: WaveformExtractionResult | null;
}): string[] {
  const { routingTarget, imagingAtomic, labExtraction, waveformExtraction } = params;
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (!t) return;
    const k = t.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push(t);
  };
  const out: string[] = [];

  if (routingTarget === "imaging_extractor" && imagingAtomic) {
    for (const f of imagingAtomic.candidate_findings) {
      add(f.label_normalized || f.label_source_text);
    }
  } else if (routingTarget === "lab_extractor" && labExtraction) {
    for (const p of labExtraction.panels) {
      for (const t of p.tests) {
        add(t.test_name_raw || t.test_name_normalized || "");
      }
    }
  } else if (routingTarget === "waveform_extractor" && waveformExtraction) {
    for (const f of waveformExtraction.structured_facts) {
      add(f.label || f.value_raw);
    }
  }

  return out.slice(0, MAX_LABELS);
}

const POLICY_EN = `You are the RapiMed Procedure Capability Policy Evaluator.

You do not inspect raw files.
You do not browse.
You do not diagnose.

You receive procedure_class, anatomy_mapping, and candidate_labels (strings only).

For each candidate label, decide exactly one:
- within_capability: the procedure class and anatomy can support evaluating this label from typical imaging/workflow for that class.
- outside_capability: the label is not reasonably supportable for this procedure class/anatomy (be conservative).
- conditionally_within_capability: support would require additional series, views, quantitative data, or context not implied by the label alone.
- unknown_capability: insufficient policy signal; do not guess capability.

RULES:
1. Be conservative: if unsure, prefer unknown_capability or outside_capability over within_capability.
2. If procedure class cannot reliably support the label, use outside_capability.
3. Use conditionally_within_capability when the gap is missing views/series/measurements, not when the claim is simply wrong.

RETURN EXACTLY THIS JSON (no extra keys):
{
  "procedure_class": "string",
  "capability_decisions": [
    {
      "label": "string",
      "decision": "within_capability | outside_capability | conditionally_within_capability | unknown_capability",
      "reason": "string"
    }
  ]
}

Echo procedure_class from INPUTS_JSON.procedure_class.
Emit one capability_decisions row per candidate label in INPUTS_JSON.candidate_labels, same order when possible.
reason must be short, structured policy wording (no patient data, no diagnosis).`;

const POLICY_TR = `Sen RapiMed Prosedür Yetenek Politikası Değerlendiricisisin.

Ham dosya incelemesi yok; tanı yok; tarama yok.

Her aday etiket için tek karar: within_capability, outside_capability, conditionally_within_capability, unknown_capability.

İngilizce enum ve JSON anahtarları POLICY_EN ile aynı. Muğlakta within_capability yerine outside_capability veya unknown_capability yeğle.`;

export function buildProcedureCapabilityPolicyPrompt(
  language: "tr" | "en",
  input: ProcedureCapabilityPolicyInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? POLICY_TR : POLICY_EN;
  return `${discipline}${spec}

Return ONLY valid JSON. No markdown fences.

INPUTS_JSON:
${JSON.stringify(input, null, 2)}`;
}

function parseDecisionRow(raw: unknown): CapabilityPolicyDecisionRow | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label = String(o.label ?? "").trim();
  const decision = String(o.decision ?? "").trim();
  if (!label || !DECISION_SET.has(decision)) return null;
  return {
    label,
    decision: decision as CapabilityDecision,
    reason: String(o.reason ?? "").trim(),
  };
}

export function parseProcedureCapabilityPolicyResult(
  raw: unknown,
  fallbackProcedureClass: string
): ProcedureCapabilityPolicyResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const pc = String(o.procedure_class ?? fallbackProcedureClass).trim() || fallbackProcedureClass;
  const rows: CapabilityPolicyDecisionRow[] = [];
  if (Array.isArray(o.capability_decisions)) {
    for (const x of o.capability_decisions) {
      const p = parseDecisionRow(x);
      if (p) rows.push(p);
    }
  }
  return { procedure_class: pc, capability_decisions: rows };
}

/** Align decisions to expected labels; fill gaps with unknown_capability. */
export function finalizeProcedureCapabilityPolicyResult(
  parsed: ProcedureCapabilityPolicyResult | null,
  input: ProcedureCapabilityPolicyInput,
  gapReason: string
): ProcedureCapabilityPolicyResult {
  if (input.candidate_labels.length === 0) {
    return {
      procedure_class: input.procedure_class,
      capability_decisions: [],
    };
  }
  if (!parsed || parsed.capability_decisions.length === 0) {
    return defaultProcedureCapabilityPolicyResult(
      input.procedure_class,
      input.candidate_labels,
      gapReason
    );
  }
  const byLc = new Map(
    parsed.capability_decisions.map((r) => [r.label.toLowerCase(), r])
  );
  const decisions: CapabilityPolicyDecisionRow[] = input.candidate_labels.map((label) => {
    const hit = byLc.get(label.toLowerCase());
    if (hit) return hit;
    return {
      label,
      decision: "unknown_capability",
      reason: gapReason,
    };
  });
  return {
    procedure_class: parsed.procedure_class || input.procedure_class,
    capability_decisions: decisions,
  };
}

export function defaultProcedureCapabilityPolicyResult(
  procedureClass: string,
  labels: string[],
  reason: string
): ProcedureCapabilityPolicyResult {
  return {
    procedure_class: procedureClass,
    capability_decisions: labels.map((label) => ({
      label,
      decision: "unknown_capability" as const,
      reason,
    })),
  };
}

export function buildProcedureCapabilityPolicyInput(
  procedureMapper: ProcedureMapperResult,
  candidateLabels: string[]
): ProcedureCapabilityPolicyInput {
  return {
    procedure_class: procedureMapper.procedure_class,
    anatomy_mapping: { ...procedureMapper.anatomy } as Record<string, unknown>,
    candidate_labels: candidateLabels,
  };
}
