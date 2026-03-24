/**
 * Universal Study Report Prompts — Domain-specific prompts for DICOM studies.
 * Spine uses vertebra-level structure; brain/chest/abdomen use region-specific structure.
 */
import type { MedicalDomain } from "@/lib/medical/domainRouter";

export interface StudyReportVertexInput {
  studySummary: {
    studyType: string;
    region: string;
    sliceCount: number;
    studyUID?: string;
    seriesUID?: string;
    vertebraRange?: { start: string; end: string } | null;
    vertebraeFindings?: Array<{ level: string; finding: string }>;
  };
  sliceStatistics: {
    width: number;
    height: number;
    depth: number;
    voxelSpacing: [number, number, number];
    sliceCount: number;
  };
  detectedAnomalies: Array<{
    sliceIndex?: number;
    vertebraLevel?: string;
    region?: string;
    organ?: string;
    pathologyType: string;
    description: string;
    confidence: number;
  }>;
  domain: MedicalDomain;
  groundedSliceFindings?: Array<{
    sliceIndex: number;
    sliceLabel: string;
    findings: string[];
    abnormalities: string[];
    confidence: number;
    limitations: string[];
  }>;
  coverageSummary?: {
    totalSlices: number;
    analyzedSlices: number;
    sampledIndices: number[];
    notAnalyzed: number[];
    coveragePercent: number;
  };
}

const SPINE_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "vertebraeFindings": [{"level": "C1|C2|...|L5", "finding": "string"}],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"]
}
Each vertebra in the study range MUST have its own entry in vertebraeFindings.`;

const BRAIN_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "lesionLocalization": [{"region": "string", "finding": "string"}],
  "hemorrhageEdemaMassEffect": ["string"],
  "ventricularFindings": ["string"],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"]
}`;

const CHEST_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "lungLobeFindings": [{"lobe": "string", "finding": "string"}],
  "pleuraEffusionConsolidation": ["string"],
  "noduleFindings": ["string"],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"]
}`;

const ABDOMEN_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "organFindings": [{"organ": "string", "finding": "string"}],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"]
}`;

const GENERAL_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "findings": ["string"],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"]
}`;

function getSchemaForDomain(domain: MedicalDomain): string {
  switch (domain) {
    case "spine":
      return SPINE_SCHEMA;
    case "brain":
      return BRAIN_SCHEMA;
    case "chest":
      return CHEST_SCHEMA;
    case "abdomen-pelvis":
      return ABDOMEN_SCHEMA;
    default:
      return GENERAL_SCHEMA;
  }
}

const SPINE_SYS_TR = `Sen bir radyologsun. Sana yapılandırılmış CT/MRI çalışma verisi veriliyor.
Omur seviyelerini tanımla ve her seviyeyi ayrı analiz et.
C1, C2, C3... veya T1–T12, L1–L5 etiketlerini kullan. Her seviye için ayrı bulgu döndür.`;

const SPINE_SYS_EN = `You are a radiologist. You are given structured CT/MRI study data.
Identify vertebral levels and analyze each level.
Use C1, C2, C3... or T1–T12, L1–L5 labels. Return findings per level.`;

const BRAIN_SYS_TR = `Sen bir nöroradyologsun. Sana beyin görüntüleme çalışma verisi veriliyor.
Lezyon lokalizasyonu, ventriküler sistem, ekstra-aksiyel alan ve anormallikleri değerlendir.`;

const BRAIN_SYS_EN = `You are a neuroradiologist. You are given brain imaging study data.
Evaluate lesion localization, ventricular system, extra-axial space, and abnormalities.`;

const CHEST_SYS_TR = `Sen bir toraks radyologusun. Sana toraks görüntüleme çalışma verisi veriliyor.
Akciğer lobları, plevra, effüzyon, konsolidasyon, nodüller ve mediastinum değerlendir.`;

const CHEST_SYS_EN = `You are a thoracic radiologist. You are given chest imaging study data.
Evaluate lung lobes, pleura, effusion, consolidation, nodules, and mediastinum.`;

const ABDOMEN_SYS_TR = `Sen bir batın radyologusun. Sana batın/pelvis görüntüleme çalışma verisi veriliyor.
Organ bazlı bulgular: karaciğer, böbrek, pankreas, dalak, bağırsak, mesane.`;

const ABDOMEN_SYS_EN = `You are an abdominal radiologist. You are given abdomen/pelvis imaging study data.
Organ-based findings: liver, kidney, pancreas, spleen, bowel, bladder.`;

const GENERAL_SYS = `You are a radiologist. Evaluate the imaging study data and report findings.`;

export function buildStudyReportPromptUniversal(
  input: StudyReportVertexInput,
  language: "tr" | "en"
): string {
  const {
    studySummary,
    sliceStatistics,
    detectedAnomalies,
    domain,
    groundedSliceFindings,
    coverageSummary,
  } = input;
  const tr = language === "tr";

  const studyBlock = JSON.stringify(studySummary, null, 2);
  const statsBlock = JSON.stringify(sliceStatistics, null, 2);
  const anomaliesBlock =
    detectedAnomalies.length > 0
      ? JSON.stringify(detectedAnomalies, null, 2)
      : tr ? "Tespit edilen anomali yok." : "No detected anomalies.";

  let evidenceBlock = "";
  if (groundedSliceFindings?.length) {
    evidenceBlock += `\n\nGROUNDED SLICE EVIDENCE:\n`;
    evidenceBlock += groundedSliceFindings
      .map(
        (sf) =>
          `${sf.sliceLabel}: findings=[${sf.findings.join("; ")}] ` +
          `abnormalities=[${sf.abnormalities.join("; ")}] ` +
          `confidence=${sf.confidence}`
      )
      .join("\n");
  }

  if (coverageSummary) {
    const cs = coverageSummary;
    evidenceBlock +=
      `\n\nCOVERAGE: ${cs.analyzedSlices} of ` +
      `${cs.totalSlices} slices analyzed ` +
      `(${cs.coveragePercent}%). ` +
      `${cs.totalSlices - cs.analyzedSlices} slices were NOT ` +
      `analyzed. Any finding reported MUST cite which slice ` +
      `index it was observed on. Do NOT report findings for ` +
      `unanalyzed slices.\n`;
  }

  let sys = GENERAL_SYS;
  if (domain === "spine") sys = tr ? SPINE_SYS_TR : SPINE_SYS_EN;
  else if (domain === "brain") sys = tr ? BRAIN_SYS_TR : BRAIN_SYS_EN;
  else if (domain === "chest") sys = tr ? CHEST_SYS_TR : CHEST_SYS_EN;
  else if (domain === "abdomen-pelvis") sys = tr ? ABDOMEN_SYS_TR : ABDOMEN_SYS_EN;

  const schema = getSchemaForDomain(domain);

  return `${sys}

## ${tr ? "Çalışma Özeti" : "Study Summary"}
${studyBlock}

## ${tr ? "Dilim İstatistikleri" : "Slice Statistics"}
${statsBlock}

## ${tr ? "Tespit Edilen Anormallikler" : "Detected Anomalies"}
${anomaliesBlock}${evidenceBlock}

## ${tr ? "Çıktı Formatı" : "Output Format"}
${schema}`;
}
