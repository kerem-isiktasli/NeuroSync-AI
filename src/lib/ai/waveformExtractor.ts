/**
 * RapiMed waveform extractor — one coherent waveform group; no over-interpretation.
 */

import {
  RAPIMED_PIPELINE_COMPONENT_RULES_EN,
  RAPIMED_PIPELINE_COMPONENT_RULES_TR,
} from "./rapiMedPipelineDiscipline";
import type { ProcedureMapperResult } from "./procedureModalityAnatomyMapper";

export type WaveformType = "ecg" | "eeg" | "emg" | "unknown";

export type WaveformSignalQualityOverall = "adequate" | "limited" | "non_diagnostic";

export interface WaveformSignalQuality {
  overall: WaveformSignalQualityOverall;
  reasons: string[];
}

export interface WaveformStructuredFact {
  fact_id: string;
  label: string;
  value_raw: string;
  value_normalized: string | null;
  confidence: number;
  source_file_ids: string[];
  rationale: string;
}

export interface WaveformExtractionResult {
  group_id: string;
  waveform_type: WaveformType;
  signal_quality: WaveformSignalQuality;
  structured_facts: WaveformStructuredFact[];
  waveform_notes: string[];
  forbidden_to_infer: string[];
}

export interface WaveformExtractorInput {
  group_id: string;
  file_ids: string[];
  waveform_family_classification: string;
  ocr_text: string | null;
  visual_waveform_summaries: string[] | null;
  metadata: Record<string, unknown>;
  prior_procedure_mapper: Pick<
    ProcedureMapperResult,
    "procedure_class" | "routing_target" | "content_subtype"
  > | null;
}

const WAVEFORM_TYPE_SET = new Set<string>(["ecg", "eeg", "emg", "unknown"]);

const QUALITY_SET = new Set<string>(["adequate", "limited", "non_diagnostic"]);

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const WAVEFORM_EXTRACTOR_EN = `You are the RapiMed Waveform Extractor.

You analyze exactly ONE coherent waveform group.
You do not over-interpret.
You do not infer clinical diagnoses that are not directly supported by the waveform content or explicit report text.

INPUTS:
- group_id
- file_ids[]
- waveform family classification
- OCR text
- visual waveform summaries
- metadata

YOUR TASK:
1. Confirm waveform subtype: ecg, eeg, emg, or unknown
2. Assess signal quality
3. Extract clearly supported structured facts
4. Preserve uncertainty

ECG ALLOWED FACTS IF SUPPORTED:
- heart rate if shown or measurable with high confidence
- rhythm label if explicitly printed or strongly visually supported
- PR/QRS/QTc intervals if explicitly printed
- axis if explicitly printed
- artifact/lead issues if obvious

EEG/EMG:
- only extract what is explicitly reported or strongly identifiable at the file level
- do not hallucinate neurologic diagnoses

RETURN EXACTLY THIS JSON:
{
  "group_id": "string",
  "waveform_type": "ecg | eeg | emg | unknown",
  "signal_quality": {
    "overall": "adequate | limited | non_diagnostic",
    "reasons": ["string"]
  },
  "structured_facts": [
    {
      "fact_id": "string",
      "label": "string",
      "value_raw": "string",
      "value_normalized": "string or null",
      "confidence": 0.0,
      "source_file_ids": ["string"],
      "rationale": "string"
    }
  ],
  "waveform_notes": [
    "string"
  ],
  "forbidden_to_infer": [
    "string"
  ]
}

FORBIDDEN:
- unsupported arrhythmia labels
- unsupported seizure labels
- unsupported neuropathy/myopathy labels
- final report prose`;

const WAVEFORM_EXTRACTOR_TR = `Sen RapiMed Dalga Formu Çıkarıcısısın.

Tek tutarlı dalga formu grubunu analiz edersin.
Aşırı yorumlama yapmazsın.
Dalga içeriği veya açık rapor metniyle doğrudan desteklenmeyen klinik tanı çıkarsamazsın.

Görev: waveform_type (ecg|eeg|emg|unknown), signal_quality, yalnızca desteklenen structured_facts, belirsizliği koru.

ECG: HR, ritim etiketi (yazılı/güçlü görsel), PR/QRS/QTc (yazılı), aks (yazılı), artefakt — yalnızca destek varsa.
EEG/EMG: açıkça raporlanan veya dosya düzeyinde güçlü tanınan; nörolojik tanı uydurma.

Yasak: desteksiz aritmi/nöbet/nöropati-miyopati etiketleri; nihai rapor düzyazısı.

Yalnızca geçerli JSON; enum değerleri İngilizce.`;

export function buildWaveformExtractorPrompt(
  language: "tr" | "en",
  input: WaveformExtractorInput
): string {
  const discipline =
    language === "tr"
      ? RAPIMED_PIPELINE_COMPONENT_RULES_TR
      : RAPIMED_PIPELINE_COMPONENT_RULES_EN;
  const spec = language === "tr" ? WAVEFORM_EXTRACTOR_TR : WAVEFORM_EXTRACTOR_EN;
  return `${discipline}${spec}

Images (if any) are attached in file_ids order (first image = file_ids[0]).
Return ONLY valid JSON matching the schema. No markdown fences. Use group_id from INPUTS_JSON.

INPUTS_JSON:
${JSON.stringify(input, null, 2)}`;
}

function parseFact(raw: unknown): WaveformStructuredFact | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  return {
    fact_id: String(o.fact_id ?? ""),
    label: String(o.label ?? ""),
    value_raw: String(o.value_raw ?? ""),
    value_normalized:
      o.value_normalized == null || o.value_normalized === ""
        ? null
        : String(o.value_normalized),
    confidence: clamp01(Number(o.confidence)),
    source_file_ids: Array.isArray(o.source_file_ids)
      ? o.source_file_ids.map(String)
      : [],
    rationale: String(o.rationale ?? ""),
  };
}

function parseSignalQuality(raw: unknown): WaveformSignalQuality {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const overall = String(d.overall ?? "limited");
  return {
    overall: QUALITY_SET.has(overall)
      ? (overall as WaveformSignalQualityOverall)
      : "limited",
    reasons: Array.isArray(d.reasons) ? d.reasons.map(String) : [],
  };
}

export function parseWaveformExtractionResult(
  raw: unknown,
  fallbackGroupId: string
): WaveformExtractionResult | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const wt = String(o.waveform_type ?? "");
  if (!WAVEFORM_TYPE_SET.has(wt)) return null;

  const facts: WaveformStructuredFact[] = [];
  if (Array.isArray(o.structured_facts)) {
    for (const f of o.structured_facts) {
      const p = parseFact(f);
      if (p) facts.push(p);
    }
  }

  return {
    group_id: String(o.group_id ?? fallbackGroupId),
    waveform_type: wt as WaveformType,
    signal_quality: parseSignalQuality(o.signal_quality),
    structured_facts: facts,
    waveform_notes: Array.isArray(o.waveform_notes)
      ? o.waveform_notes.map(String)
      : [],
    forbidden_to_infer: Array.isArray(o.forbidden_to_infer)
      ? o.forbidden_to_infer.map(String)
      : [],
  };
}

export function defaultWaveformExtractionResult(
  groupId: string,
  reason: string
): WaveformExtractionResult {
  return {
    group_id: groupId,
    waveform_type: "unknown",
    signal_quality: {
      overall: "non_diagnostic",
      reasons: [reason],
    },
    structured_facts: [],
    waveform_notes: [reason],
    forbidden_to_infer: [
      "clinical_diagnosis_from_waveform_pattern",
      "unsupported_rhythm_or_seizure_labels",
    ],
  };
}

export function buildWaveformExtractorInput(params: {
  group_id: string;
  file_ids: string[];
  waveform_family_classification: string;
  procedureMapper: ProcedureMapperResult;
  metadata?: Record<string, unknown>;
  ocr_text?: string | null;
  visual_waveform_summaries?: string[] | null;
}): WaveformExtractorInput {
  return {
    group_id: params.group_id,
    file_ids: params.file_ids,
    waveform_family_classification: params.waveform_family_classification,
    ocr_text: params.ocr_text ?? null,
    visual_waveform_summaries: params.visual_waveform_summaries ?? null,
    metadata: params.metadata ?? {},
    prior_procedure_mapper: {
      procedure_class: params.procedureMapper.procedure_class,
      routing_target: params.procedureMapper.routing_target,
      content_subtype: params.procedureMapper.content_subtype,
    },
  };
}

/** Derive intake/mapper hint string for waveform subtype (e.g. waveform_ecg). */
export function deriveWaveformFamilyHint(
  procedureMapper: ProcedureMapperResult,
  perImageIntake: Array<{ intake_family?: string; upload_type?: string }>
): string {
  const pc = procedureMapper.procedure_class;
  if (pc === "ecg" || pc === "eeg" || pc === "emg") return `procedure_class:${pc}`;
  const families = perImageIntake
    .map((p) => p.intake_family)
    .filter(Boolean) as string[];
  const wf = families.find(
    (f) => f.startsWith("waveform_") || f === "ecg" || f === "eeg" || f === "emg"
  );
  if (wf) return wf;
  return families.join("|") || "unknown";
}
