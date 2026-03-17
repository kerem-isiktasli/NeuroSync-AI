/**
 * Prompts for OCR extraction from report screenshots/photos.
 * Uses vision model to transcribe and structure radiology report text.
 */

export type ReportOcrLanguage = "tr" | "en";

const OCR_PROMPT_TR = `Bu görüntü yazılı bir tıbbi (radyoloji) raporun ekran görüntüsü veya fotoğrafıdır.

Görevin:
1. Görüntüdeki TÜM metni mümkün olduğunca kelimesi kelimesine (verbatim) aktar.
2. Eksik veya okunamayan kısımları "[okunamadı]" ile işaretle.
3. Yapılandırılmış çıktıda bulguları, modaliteyi, anatomik bölgeyi ve seviyeleri (varsa) çıkar.

SADECE GEÇERLİ JSON DÖNDÜR:
{
  "raw_text": "string — tam transkripsiyon (satır satır, mümkün olduğunca orijinal formatta)",
  "structured_findings": ["string — raporun bulgu maddeleri (her biri ayrı)"],
  "modality": "string — MRI, CT, X-Ray vb. (çıkarılabilirse)",
  "anatomical_region": "string — anatomik bölge (bel, boyun, göğüs vb.)",
  "anatomical_levels": ["string — C3-C4, L4-L5 gibi seviyeler varsa"],
  "impression_or_conclusion": "string — raporun sonuç/izlenim kısmı varsa",
  "limitations": ["string — raporda belirtilen sınırlamalar varsa"]
}`;

const OCR_PROMPT_EN = `This image is a screenshot or photo of a written medical (radiology) report.

Your task:
1. Transcribe ALL text in the image as verbatim as possible.
2. Mark unreadable or missing parts with "[unreadable]".
3. Extract structured findings, modality, anatomical region, and levels (if present).

RETURN ONLY VALID JSON:
{
  "raw_text": "string — full verbatim transcription (line by line, preserving original format when possible)",
  "structured_findings": ["string — report finding items (each as separate entry)"],
  "modality": "string — MRI, CT, X-Ray etc. (if extractable)",
  "anatomical_region": "string — anatomical region (spine, neck, chest etc.)",
  "anatomical_levels": ["string — levels like C3-C4, L4-L5 if present"],
  "impression_or_conclusion": "string — report conclusion/impression section if present",
  "limitations": ["string — any limitations stated in the report"]
}`;

export function getReportOcrPrompt(language: ReportOcrLanguage): string {
  return language === "tr" ? OCR_PROMPT_TR : OCR_PROMPT_EN;
}

export type ReportOcrResult = {
  raw_text: string;
  structured_findings: string[];
  modality?: string;
  anatomical_region?: string;
  anatomical_levels?: string[];
  impression_or_conclusion?: string;
  limitations?: string[];
};
