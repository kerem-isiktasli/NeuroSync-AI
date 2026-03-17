/**
 * Structured study-level reconciliation — correlates findings across multiple images
 * to identify agreement, disagreement, reinforcement, and weak/inconsistent evidence.
 */

import type { StudyMetadata } from "./studyAggregator";

export interface AgreementItem {
  finding: string;
  image_indices: number[];
  confidence: "high" | "medium" | "low";
}

export interface DisagreementItem {
  finding_a: string;
  finding_b: string;
  image_indices: number[];
  note: string;
}

export interface ReinforcementItem {
  structure_or_level: string;
  image_indices: number[];
  evidence: string;
}

export interface StructuredReconciliationResult {
  agreements: AgreementItem[];
  disagreements: DisagreementItem[];
  reinforcements: ReinforcementItem[];
  weak_or_inconsistent: string[];
  summary: string;
}

export interface PerImageFindingForReconciliation {
  imageIndex: number;
  fileName: string;
  image_plane: string;
  diagnostic_value: string;
  series_type_guess: string;
  is_localizer: boolean;
  findings: string;
  diagnosis: string;
  limitations: string[];
}

const RECONCILIATION_PROMPT_TR = `Sen bir tıbbi görüntü çapraz doğrulama uzmanısın.
Aynı çalışmaya ait birden fazla görüntüden elde edilen bulgular verilmiştir.

Görevin: Bu bulguları YAPISAL bir şekilde karşılaştır.

1. agreements: Birden fazla görüntüde AYNI veya UYUMLU olan bulgular. Hangi görüntü indekslerinde görüldüğünü belirt. confidence: high (2+ düzlemde tutarlı), medium (aynı düzlemde 2+ görüntü), low (benzer ama tam aynı değil).

2. disagreements: Farklı görüntülerde ÇELİŞEN bulgular (örn. biri normal derken diğeri patoloji). image_indices ve kısa note ile açıkla.

3. reinforcements: Aynı yapı veya seviyede (örn. L4-L5, C5-C6) birden fazla görüntüden destek alan bulgular. structure_or_level, image_indices, evidence.

4. weak_or_inconsistent: Tek görüntüde görülen, çapraz doğrulanamayan veya tutarsız bulgular. Kısa liste.

5. summary: 2-3 cümlelik özet — çoklu görüntünün güvenilirliğe etkisi, hangi bulguların güçlü hangilerinin zayıf olduğu.

SADECE GEÇERLİ JSON DÖNDÜR:
{
  "agreements": [{"finding": "string", "image_indices": [0,1], "confidence": "high|medium|low"}],
  "disagreements": [{"finding_a": "string", "finding_b": "string", "image_indices": [0,1], "note": "string"}],
  "reinforcements": [{"structure_or_level": "string", "image_indices": [0,1], "evidence": "string"}],
  "weak_or_inconsistent": ["string"],
  "summary": "string"
}`;

const RECONCILIATION_PROMPT_EN = `You are a medical imaging cross-validation expert.
Findings from multiple images belonging to the same study are provided below.

Your task: Compare these findings in a STRUCTURED way.

1. agreements: Findings that are the SAME or CONSISTENT across multiple images. Specify which image indices. confidence: high (2+ planes consistent), medium (2+ images in same plane), low (similar but not identical).

2. disagreements: Findings that CONFLICT between images (e.g. one says normal, another pathology). Include image_indices and brief note.

3. reinforcements: Findings supported by multiple images at the same structure or level (e.g. L4-L5, C5-C6). structure_or_level, image_indices, evidence.

4. weak_or_inconsistent: Findings seen in only one image, not cross-validated, or inconsistent. Brief list.

5. summary: 2-3 sentence summary — how multi-image evidence affects confidence, which findings are strong vs weak.

RETURN ONLY VALID JSON:
{
  "agreements": [{"finding": "string", "image_indices": [0,1], "confidence": "high|medium|low"}],
  "disagreements": [{"finding_a": "string", "finding_b": "string", "image_indices": [0,1], "note": "string"}],
  "reinforcements": [{"structure_or_level": "string", "image_indices": [0,1], "evidence": "string"}],
  "weak_or_inconsistent": ["string"],
  "summary": "string"
}`;

export function getStructuredReconciliationPrompt(
  studyMeta: StudyMetadata,
  perImageFindings: PerImageFindingForReconciliation[],
  language: "tr" | "en"
): string {
  const diagnosticFindings = perImageFindings.filter(
    (f) => f.diagnostic_value !== "non-diagnostic" && !f.is_localizer
  );

  if (diagnosticFindings.length < 2) return "";

  const prompt = language === "tr" ? RECONCILIATION_PROMPT_TR : RECONCILIATION_PROMPT_EN;

  const context = [
    `Study: ${studyMeta.modality} ${studyMeta.anatomicalRegion}`,
    `Planes: ${studyMeta.planesAvailable.join(", ") || "unknown"}`,
    `Diagnostic images: ${studyMeta.diagnosticImageCount} / ${studyMeta.imageCount}`,
    studyMeta.seriesGuesses.length ? `Series: ${studyMeta.seriesGuesses.join(", ")}` : "",
    "",
    "PER-IMAGE FINDINGS:",
    ...diagnosticFindings.map(
      (f) =>
        `[Image ${f.imageIndex}] ${f.fileName} | plane=${f.image_plane} | value=${f.diagnostic_value} | series=${f.series_type_guess || "—"}\n` +
        `Diagnosis: ${f.diagnosis || "N/A"}\n` +
        `Findings: ${f.findings || "N/A"}\n` +
        (f.limitations?.length ? `Limitations: ${f.limitations.join("; ")}\n` : "")
    ),
  ]
    .filter(Boolean)
    .join("\n");

  return `${prompt}\n\n---\n\n${context}`;
}

export function parseStructuredReconciliation(raw: string): StructuredReconciliationResult | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const agreements = Array.isArray(parsed.agreements)
      ? (parsed.agreements as AgreementItem[]).filter(
          (a) =>
            typeof a.finding === "string" &&
            Array.isArray(a.image_indices) &&
            ["high", "medium", "low"].includes(String(a.confidence))
        )
      : [];
    const disagreements = Array.isArray(parsed.disagreements)
      ? (parsed.disagreements as DisagreementItem[]).filter(
          (d) =>
            typeof d.finding_a === "string" &&
            typeof d.finding_b === "string" &&
            Array.isArray(d.image_indices)
        )
      : [];
    const reinforcements = Array.isArray(parsed.reinforcements)
      ? (parsed.reinforcements as ReinforcementItem[]).filter(
          (r) =>
            typeof r.structure_or_level === "string" &&
            Array.isArray(r.image_indices) &&
            typeof r.evidence === "string"
        )
      : [];
    const weak_or_inconsistent = Array.isArray(parsed.weak_or_inconsistent)
      ? (parsed.weak_or_inconsistent as string[]).filter((s) => typeof s === "string")
      : [];
    const summary = typeof parsed.summary === "string" ? parsed.summary : "";

    return {
      agreements,
      disagreements,
      reinforcements,
      weak_or_inconsistent,
      summary,
    };
  } catch {
    return null;
  }
}
