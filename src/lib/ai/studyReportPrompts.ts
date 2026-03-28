/**
 * Vertex AI prompts for study-based radiology report generation.
 * Vertex receives: study summary, slice statistics, detected anomalies — NOT raw slices.
 */

export interface StudySummaryInput {
  studyType: string;
  region: string;
  sliceCount: number;
  studyUID?: string;
  seriesUID?: string;
  vertebraRange?: { start: string; end: string } | null;
  vertebraeFindings?: Array<{ level: string; finding: string }>;
}

export interface SliceStatistics {
  width: number;
  height: number;
  depth: number;
  voxelSpacing: [number, number, number];
  sliceCount: number;
}

export interface DetectedAnomaly {
  sliceIndex?: number;
  vertebraLevel?: string;
  pathologyType: string;
  description: string;
  confidence: number;
}

export interface StudyReportVertexInput {
  studySummary: StudySummaryInput;
  sliceStatistics: SliceStatistics;
  detectedAnomalies: DetectedAnomaly[];
  /** Localized note when many per-slice Vertex calls failed (quota/timeouts). */
  synthesisCompletenessNote?: string;
}

const OUTPUT_SCHEMA = `
RETURN ONLY VALID JSON (no markdown, no code blocks):
{
  "studyType": "string",
  "region": "string",
  "vertebraeFindings": [{"level": "C1|C2|C3|C4|C5|C6|C7|T1|...|L5", "finding": "string"}],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"]
}
Each vertebra in the study range MUST have its own entry in vertebraeFindings.`;

export function buildStudyReportPrompt(
  input: StudyReportVertexInput,
  language: "tr" | "en"
): string {
  const { studySummary, sliceStatistics, detectedAnomalies, synthesisCompletenessNote } = input;
  const tr = language === "tr";

  const studyBlock = JSON.stringify(studySummary, null, 2);
  const statsBlock = JSON.stringify(sliceStatistics, null, 2);
  const anomaliesBlock =
    detectedAnomalies.length > 0
      ? JSON.stringify(detectedAnomalies, null, 2)
      : tr
        ? "Tespit edilen anomali yok."
        : "No detected anomalies.";

  const sys = tr
    ? `Sen bir radyologsun.

Sana yapılandırılmış CT çalışma verisi veriliyor (dilim sıralaması ve anatomik bölge dahil).
Omur seviyelerini tanımla ve her seviyeyi ayrı ayrı analiz et.

Omur etiketlerini HER ZAMAN belirt: C1, C2, C3, C4, C5, C6, C7 (veya çalışma bölgesine göre T1–T12, L1–L5).
Her omur için ayrı bulgu döndür.
Tüm omurga için genelleme yapma; her seviyeyi tek tek değerlendir.

Kurallar:
- Kesin tanı koyma; "uyumlu olabilir", "düşündürür" gibi ifadeler kullan.
- Tespit edilen anormallikleri öncelikle değerlendir.
- vertebraeFindings içinde her omur seviyesi için ayrı giriş olmalı.
- Yalnızca geçerli JSON döndür.`
    : `You are a radiologist.

You are given structured CT study data including slice ordering and anatomical region.
Identify vertebral levels and analyze each level.

Always specify vertebra labels: C1, C2, C3, C4, C5, C6, C7 (or T1–T12, L1–L5 as appropriate for the study region).
Return findings per vertebra.
Never generalize findings across the entire spine — evaluate each level individually.

Rules:
- Do not give definitive diagnoses; use phrases like "may suggest", "is consistent with".
- Prioritize evaluation of detected anomalies.
- vertebraeFindings MUST contain a separate entry for each vertebra level.
- Return only valid JSON.`;

  return `${sys}

## ${tr ? "Çalışma Özeti" : "Study Summary"}
${studyBlock}

## ${tr ? "Dilim İstatistikleri" : "Slice Statistics"}
${statsBlock}

## ${tr ? "Tespit Edilen Anormallikler" : "Detected Anomalies"}
${anomaliesBlock}
${synthesisCompletenessNote ? `\n## ${tr ? "Analiz tamlığı" : "Analysis completeness"}\n${synthesisCompletenessNote}\n` : ""}
## ${tr ? "Çıktı Formatı" : "Output Format"}
${OUTPUT_SCHEMA}`;
}
