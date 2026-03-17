/**
 * Report fusion — compares image-derived findings with official report text.
 * Used when both diagnostic images and report screenshots are present (mixed upload).
 */

export type FusionMismatch = {
  image_finding: string;
  report_finding: string;
  note: string;
};

export type ReportFusionResult = {
  official_report_present: boolean;
  report_text_summary: string;
  report_structured_findings: string[];
  agreement_points: string[];
  mismatch_points: FusionMismatch[];
  official_report_priority_note: string;
};

export type ReportFusionInput = {
  language: "tr" | "en";
  imageFindings: string[];
  imageDiagnosis?: string;
  imageModality?: string;
  imageRegion?: string;
  reportRawText: string;
  reportStructuredFindings: string[];
  reportModality?: string;
  reportRegion?: string;
  reportImpression?: string;
};

/**
 * Build a text prompt for an LLM to compare image findings vs report findings.
 * The actual API call is done by the caller (googleHealthcare or route).
 */
export function buildReportFusionPrompt(input: ReportFusionInput): string {
  const { language, imageFindings, imageDiagnosis, reportRawText, reportStructuredFindings } = input;
  const tr = language === "tr";

  const intro = tr
    ? "Aşağıda AI görüntü analizinden elde edilen bulgular ile resmi rapor metninden çıkarılan bulgular var. İkisini karşılaştır."
    : "Below are findings from AI image analysis and findings extracted from the official report text. Compare them.";

  const imageSection = tr
    ? `\n## AI Görüntü Bulguları\n${imageDiagnosis ? `Tanı/Özet: ${imageDiagnosis}\n` : ""}\nBulgular:\n${imageFindings.length ? imageFindings.map((f) => `- ${f}`).join("\n") : "(bulgu yok)"}`
    : `\n## AI Image Findings\n${imageDiagnosis ? `Diagnosis/Summary: ${imageDiagnosis}\n` : ""}\nFindings:\n${imageFindings.length ? imageFindings.map((f) => `- ${f}`).join("\n") : "(none)"}`;

  const reportSection = tr
    ? `\n## Resmi Rapor Metni (OCR)\n${reportRawText.slice(0, 4000)}\n\nYapılandırılmış bulgular:\n${reportStructuredFindings.length ? reportStructuredFindings.map((f) => `- ${f}`).join("\n") : "(yok)"}`
    : `\n## Official Report Text (OCR)\n${reportRawText.slice(0, 4000)}\n\nStructured findings:\n${reportStructuredFindings.length ? reportStructuredFindings.map((f) => `- ${f}`).join("\n") : "(none)"}`;

  const instructions = tr
    ? `

## Görev
Aşağıdaki JSON çıktısını oluştur:
1. agreement_points: Hem görüntü hem rapor ile uyumlu olan bulgular (kısa liste)
2. mismatch_points: Çelişen veya farklı olan bulgular. Her biri için image_finding, report_finding ve kısa note
3. official_report_priority_note: Çelişki varsa, resmi raporun öncelikli olması gerektiğini nasıl ifade edeceğin (hasta için net, dikkatli bir cümle)

Önemli: Resmi radyoloji raporu, AI görüntü yorumundan daha güvenilir kabul edilir. Çelişkide rapor önceliklidir.`
    : `

## Task
Produce the following JSON output:
1. agreement_points: Findings that agree between image analysis and report (short list)
2. mismatch_points: Findings that conflict or differ. For each: image_finding, report_finding, and brief note
3. official_report_priority_note: If there is disagreement, a clear, cautious sentence for the patient stating that the official report takes precedence

Important: The official radiology report is considered more reliable than AI image interpretation. In case of conflict, the report takes precedence.`;

  const outputSchema = `
SADECE GEÇERLİ JSON DÖNDÜR / RETURN ONLY VALID JSON:
{
  "agreement_points": ["string"],
  "mismatch_points": [
    { "image_finding": "string", "report_finding": "string", "note": "string" }
  ],
  "official_report_priority_note": "string"
}`;

  return intro + imageSection + reportSection + instructions + outputSchema;
}

/**
 * Parse fusion JSON from model response.
 */
export function parseFusionResponse(raw: string): ReportFusionResult | null {
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
    const agreements = Array.isArray(parsed.agreement_points)
      ? parsed.agreement_points.map(String).filter(Boolean)
      : [];
    const mismatches: FusionMismatch[] = [];
    if (Array.isArray(parsed.mismatch_points)) {
      for (const m of parsed.mismatch_points) {
        if (m && typeof m === "object" && "image_finding" in m && "report_finding" in m) {
          mismatches.push({
            image_finding: String((m as { image_finding?: string }).image_finding ?? ""),
            report_finding: String((m as { report_finding?: string }).report_finding ?? ""),
            note: String((m as { note?: string }).note ?? ""),
          });
        }
      }
    }
    return {
      official_report_present: true,
      report_text_summary: "", // Filled by caller from raw_text
      report_structured_findings: [], // Filled by caller
      agreement_points: agreements,
      mismatch_points: mismatches,
      official_report_priority_note: String(parsed.official_report_priority_note ?? ""),
    };
  } catch {
    return null;
  }
}
