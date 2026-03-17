/**
 * Fusion Engine — Combines AI image findings and report OCR into a unified radiology interpretation.
 *
 * Input: imageFindings (from DICOM/Vertex analysis), reportText (from Document AI OCR)
 * Output: finalRadiologyInterpretation, confidenceScore, contradictions[]
 */
import { googleHealthcare } from "./googleHealthcare";

export interface FusionContradiction {
  imageFinding: string;
  reportFinding: string;
  note: string;
}

export interface FusionInput {
  imageFindings: string[];
  reportText: string;
  language?: "tr" | "en";
}

export interface FusionResult {
  finalRadiologyInterpretation: string;
  confidenceScore: number;
  contradictions: FusionContradiction[];
}

function buildFusionPrompt(input: FusionInput): string {
  const { imageFindings, reportText, language = "en" } = input;
  const tr = language === "tr";

  const intro = tr
    ? "Aşağıda AI görüntü analizinden elde edilen bulgular ile OCR ile taranmış resmi rapor metni var. İkisini birleştirerek tek bir radyoloji yorumu oluştur."
    : "Below are findings from AI image analysis and text from an OCR-scanned official radiology report. Combine them into a single unified radiology interpretation.";

  const imageSection = tr
    ? `\n## AI Görüntü Bulguları\n${imageFindings.length ? imageFindings.map((f) => `- ${f}`).join("\n") : "(bulgu yok)"}`
    : `\n## AI Image Findings\n${imageFindings.length ? imageFindings.map((f) => `- ${f}`).join("\n") : "(none)"}`;

  const reportSection = tr
    ? `\n## Rapor Metni (OCR)\n${reportText.slice(0, 6000) || "(boş)"}`
    : `\n## Report Text (OCR)\n${reportText.slice(0, 6000) || "(empty)"}`;

  const instructions = tr
    ? `

## Görev
Aşağıdaki JSON çıktısını oluştur:
1. finalRadiologyInterpretation: Her iki kaynağı birleştiren, tutarlı olanları dahil eden, çelişkilerde resmi raporu öncelikli tutan nihai radyoloji yorumu (akıcı paragraf)
2. confidenceScore: 0-1 arası güven skoru (1 = tam uyum, 0 = ciddi çelişki)
3. contradictions: Çelişen bulgular listesi. Her biri için imageFinding, reportFinding ve kısa note

Önemli: Resmi radyoloji raporu, AI görüntü yorumundan daha güvenilir kabul edilir. Çelişkide rapor önceliklidir.`
    : `

## Task
Produce the following JSON output:
1. finalRadiologyInterpretation: A unified radiology interpretation that merges both sources, includes congruent findings, and when in conflict prefers the official report (fluent paragraph)
2. confidenceScore: A confidence score between 0 and 1 (1 = full agreement, 0 = major contradiction)
3. contradictions: List of contradicting findings. For each: imageFinding, reportFinding, and brief note

Important: The official radiology report is considered more reliable than AI image interpretation. In case of conflict, the report takes precedence.`;

  const outputSchema = `
RETURN ONLY VALID JSON:
{
  "finalRadiologyInterpretation": "string",
  "confidenceScore": number,
  "contradictions": [
    { "imageFinding": "string", "reportFinding": "string", "note": "string" }
  ]
}`;

  return intro + imageSection + reportSection + instructions + outputSchema;
}

function parseFusionResponse(raw: string): FusionResult | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;

    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

    const interpretation = String(parsed.finalRadiologyInterpretation ?? "").trim();
    let confidence = Number(parsed.confidenceScore);
    if (Number.isNaN(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.5;
    }

    const contradictions: FusionContradiction[] = [];
    if (Array.isArray(parsed.contradictions)) {
      for (const c of parsed.contradictions) {
        if (c && typeof c === "object" && "imageFinding" in c && "reportFinding" in c) {
          contradictions.push({
            imageFinding: String((c as { imageFinding?: string }).imageFinding ?? ""),
            reportFinding: String((c as { reportFinding?: string }).reportFinding ?? ""),
            note: String((c as { note?: string }).note ?? ""),
          });
        }
      }
    }

    return {
      finalRadiologyInterpretation: interpretation || "Unable to produce unified interpretation.",
      confidenceScore: confidence,
      contradictions,
    };
  } catch {
    return null;
  }
}

/**
 * Fuse AI image findings and OCR report text into a unified radiology interpretation.
 *
 * @param input — imageFindings (from DICOM/Vertex), reportText (from Document AI OCR)
 * @returns finalRadiologyInterpretation, confidenceScore (0-1), contradictions[]
 */
export async function fuseFindings(input: FusionInput): Promise<FusionResult> {
  const prompt = buildFusionPrompt(input);
  const raw = await googleHealthcare.runFusionEngine(prompt);

  const result = parseFusionResponse(raw);
  if (result) return result;

  // Fallback when Vertex returns unparseable response
  const { imageFindings, reportText } = input;
  const hasReport = reportText.trim().length > 0;
  const hasFindings = imageFindings.length > 0;

  const fallbackInterpretation = hasReport
    ? `Report text available. AI findings: ${hasFindings ? imageFindings.join("; ") : "none"}. Manual review recommended.`
    : hasFindings
      ? `AI findings: ${imageFindings.join("; ")}. No report text for correlation.`
      : "No findings or report text available.";

  return {
    finalRadiologyInterpretation: fallbackInterpretation,
    confidenceScore: 0,
    contradictions: [],
  };
}
