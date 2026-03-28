/**
 * Universal Study Report Prompts.
 * Every supported domain has its own schema,
 * system prompt, and clinical checklist.
 * Unknown/unsupported domains are rejected
 * explicitly rather than silently degraded.
 */
import type { MedicalDomain } from "@/lib/medical/domainRouter";

// ── Input type ──────────────────────────────

export interface StudyReportVertexInputUniversal {
  domain: MedicalDomain;
  studySummary: {
    studyType: string;
    region: string;
    sliceCount: number;
    studyUID?: string;
    seriesUID?: string;
    vertebraRange?: { start: string; end: string } | null;
    vertebraeFindings?: Array<{
      level: string;
      finding: string;
    }>;
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
  // Grounded slice evidence (injected by pipeline)
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
    coveragePercent: number;
    notAnalyzed: number[];
  };
}

// ── Output schemas per domain ───────────────

// UNIVERSAL base fields every schema must have
const BASE_FIELDS = `
  "abnormalities": ["string — each confirmed abnormality observed on a specific slice"],
  "impression": "string — 2-4 sentence clinical impression grounded in slice evidence. MUST reference which slices showed findings. If no abnormalities found, state this explicitly.",
  "recommendedNextSteps": ["string — concrete patient-facing next steps"],
  "limitations": ["string — what could not be assessed and why"],
  "confidence": 0-100
`;

const SPINE_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "vertebraeFindings": [
    {"level": "C1|C2|...|L5|S1", "finding": "string — normal or specific pathology observed"}
  ],
  ${BASE_FIELDS}
}
RULES:
- Every vertebra in the study range MUST have its own entry
- Use "Normal alignment and disc height" for levels with no finding
- Do NOT invent findings for vertebrae not visible in provided slices
- If fewer than 4 slices had findings, state coverage limitation`;

const BRAIN_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "parenchymaFindings": [
    {"region": "string — e.g. left frontal lobe, basal ganglia", "finding": "string"}
  ],
  "ventricularSystem": "string — size and symmetry of ventricles",
  "extraAxialSpace": "string — subdural/epidural/subarachnoid spaces",
  "midlineShift": "string — present/absent, direction and mm if present",
  "hemorrhageOrMassEffect": ["string"],
  ${BASE_FIELDS}
}
RULES:
- parenchymaFindings must reflect actual slice observations
- Do NOT state "no mass effect" unless slices confirmed it
- Always note which sequences were available (T1/T2/FLAIR/DWI)
- Hippocampal region: state whether it was visible on sampled slices`;

const CHEST_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "lungFindings": [
    {"zone": "string — e.g. right upper lobe, left lower lobe", "finding": "string"}
  ],
  "pleuralFindings": "string — effusion, thickening, pneumothorax",
  "mediastinum": "string — width, mass, lymphadenopathy",
  "heartSize": "string — normal/enlarged with cardiothoracic ratio if available",
  "boneAndSoftTissue": ["string"],
  ${BASE_FIELDS}
}
RULES:
- Lung zones must be based on actual slice observations
- Do NOT report absence of nodules unless multiple representative slices confirmed
- State window/level limitations if applicable`;

const ABDOMEN_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "organFindings": [
    {"organ": "string", "finding": "string — normal or pathology with size/location"}
  ],
  "freeFluid": "string — present/absent/cannot assess",
  "bowelFindings": "string",
  "lymphNodes": "string — enlarged/normal/cannot assess",
  ${BASE_FIELDS}
}
RULES:
- Each organ must be explicitly listed even if normal
- Free fluid: only state absent if coronal/axial coverage confirmed
- Do not assess organs not visible in sampled slices`;

const MSK_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "jointFindings": [
    {"structure": "string — e.g. ACL, medial meniscus, cartilage", "finding": "string"}
  ],
  "boneFindings": ["string — marrow signal, cortical integrity, fracture"],
  "softTissueFindings": ["string — edema, effusion, tendon"],
  ${BASE_FIELDS}
}
RULES:
- Structure-by-structure reporting required
- Do not state structure is normal unless it was visible
- Note if joint effusion was assessed`;

const VASCULAR_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "vesselFindings": [
    {"vessel": "string", "finding": "string — caliber, stenosis %, occlusion, aneurysm"}
  ],
  "collateralCirculation": "string",
  ${BASE_FIELDS}
}
RULES:
- Each named vessel in the study range must be reported
- Stenosis estimates require visible lumen assessment
- CTA vs MRA: note contrast phase if inferrable`;

const GENERAL_SCHEMA = `
RETURN ONLY VALID JSON:
{
  "studyType": "string",
  "region": "string",
  "dominantFindings": ["string — most clinically significant observations"],
  "anatomyVisible": ["string — organs/structures clearly identified"],
  ${BASE_FIELDS}
}
NOTE: Domain could not be confirmed. Report only
what is directly visible. Do not speculate.`;

// ── System prompts per domain ────────────────

const SYS: Record<string, { en: string; tr: string }> = {
  spine: {
    en: `You are a board-certified spine radiologist.
You are given structured data from a CT/MRI spine study
including per-slice findings from AI image analysis.
Your task: produce a vertebra-level structured report.
CRITICAL RULES:
1. Report only findings supported by the slice evidence below.
2. If a vertebra level was not covered by analyzed slices,
   write "Not assessed — outside analyzed slice range."
3. Do not state disc herniation, stenosis, or compression
   unless the slice findings explicitly describe it.
4. Confidence must reflect actual slice evidence quality.`,
    tr: `Sertifikalı bir omurga radyologusun.
Sana CT/MRI omurga çalışmasından yapılandırılmış veri
ve AI görüntü analizinden elde edilen kesit bulguları veriliyor.
Görevin: vertebra seviyesinde yapılandırılmış rapor üret.
KRİTİK KURALLAR:
1. Yalnızca kesit kanıtlarıyla desteklenen bulguları raporla.
2. Analiz edilen kesit aralığı dışındaki vertebra seviyeleri için
   "Analiz edilmedi — kesit aralığı dışında" yaz.
3. Kesit bulgularında açıkça belirtilmedikçe disk hernisi,
   stenoz veya kompresyon bildirme.
4. Güven skoru gerçek kesit kalitesini yansıtmalıdır.`,
  },
  brain: {
    en: `You are a board-certified neuroradiologist.
You are given structured data from a brain MRI/CT study
including per-slice AI image analysis findings.
Your task: produce a region-by-region structured brain report.
CRITICAL RULES:
1. Report findings only from the slice evidence provided.
2. If the hippocampus was not visible in sampled slices,
   explicitly state: "Hippocampal region not sampled."
3. Do not state "no intracranial abnormality" unless
   cortex, white matter, ventricles, and extra-axial spaces
   were all covered in the analyzed slices.
4. Always comment on: parenchyma, ventricles, extra-axial space,
   midline, and any signal abnormality.`,
    tr: `Sertifikalı bir nöroradyologsun.
Sana beyin MR/BT çalışmasından yapılandırılmış veri
ve AI kesit analizi bulguları veriliyor.
Görevin: bölge bazlı yapılandırılmış beyin raporu üret.
KRİTİK KURALLAR:
1. Yalnızca sağlanan kesit kanıtlarından bulgu raporla.
2. Hipokampüs analiz edilen kesitlerde görünmüyorsa
   açıkça belirt: "Hipokampüs bölgesi örneklenmedi."
3. Korteks, beyaz cevher, ventriküller ve ekstra-aksiyel
   alanların tamamı analiz edilmedikçe "intrakraniyal
   anormallik yok" deme.`,
  },
  chest: {
    en: `You are a board-certified thoracic radiologist.
You are given structured data from a chest CT/MRI/X-ray study
with per-slice AI analysis findings.
Your task: produce a zone-by-zone structured chest report.
CRITICAL RULES:
1. Lung zone findings must be traceable to specific slices.
2. Never report absence of pulmonary nodule unless multiple
   representative slices from all zones were analyzed.
3. Always comment on: lungs, pleura, mediastinum, heart, bones.
4. Note if contrast phase is unclear — affects organ assessment.`,
    tr: `Sertifikalı bir toraks radyologusun.
Sana toraks BT/MR/grafi çalışmasından yapılandırılmış veri
ve AI kesit analizi bulguları veriliyor.
Görevin: bölge bazlı yapılandırılmış toraks raporu üret.
KRİTİK KURALLAR:
1. Akciğer bölgesi bulguları belirli kesitlerle ilişkilendirilmeli.
2. Tüm bölgelerden temsili kesitler analiz edilmedikçe
   pulmoner nodül yokluğunu bildirme.
3. Her zaman yorumla: akciğerler, plevra, mediastinum, kalp, kemikler.`,
  },
  "abdomen-pelvis": {
    en: `You are a board-certified abdominal radiologist.
You are given structured data from an abdomen/pelvis CT/MRI/US study
with per-slice AI analysis findings.
Your task: produce an organ-by-organ structured report.
CRITICAL RULES:
1. Each organ must be listed even if normal.
2. Only report organ as normal if it was visible in analyzed slices.
3. Free fluid: state cannot assess if coronal coverage was partial.
4. Always comment on: liver, spleen, kidneys, pancreas,
   bowel, bladder, lymph nodes.`,
    tr: `Sertifikalı bir batın radyologusun.
Sana batın/pelvis BT/MR/US çalışmasından yapılandırılmış veri
ve AI kesit analizi bulguları veriliyor.
Görevin: organ bazlı yapılandırılmış rapor üret.
KRİTİK KURALLAR:
1. Her organ normal olsa bile listelenmelidir.
2. Yalnızca analiz edilen kesitlerde görünen organları normal olarak raporla.
3. Serbest sıvı: koronal kapsam kısmi ise "değerlendirilemedi" yaz.`,
  },
  musculoskeletal: {
    en: `You are a board-certified musculoskeletal radiologist.
You are given structured data from an MSK MRI/CT study
with per-slice AI image analysis findings.
Your task: produce a structure-by-structure MSK report.
CRITICAL RULES:
1. List each anatomical structure individually.
2. Only state a structure is intact if it was visible in slices.
3. Always comment on: cartilage, ligaments, tendons,
   bone marrow, joint effusion, and periarticular soft tissue.
4. Do not diagnose tear vs sprain without direct slice evidence.`,
    tr: `Sertifikalı bir kas-iskelet radyologusun.
Sana MSK MR/BT çalışmasından yapılandırılmış veri
ve AI kesit analizi bulguları veriliyor.
Görevin: yapı bazlı MSK raporu üret.
KRİTİK KURALLAR:
1. Her anatomik yapıyı ayrı ayrı listele.
2. Yalnızca kesitlerde görünen yapıları sağlam olarak raporla.
3. Her zaman yorum yap: kıkırdak, bağlar, tendonlar,
   kemik iliği, eklem efüzyonu, periartiküler yumuşak doku.`,
  },
  vascular: {
    en: `You are a board-certified vascular radiologist.
You are given structured data from a vascular CTA/MRA study
with per-slice AI image analysis findings.
Your task: produce a vessel-by-vessel structured report.
CRITICAL RULES:
1. Name each vessel assessed.
2. Stenosis estimates require visible lumen comparison.
3. Do not diagnose occlusion without direct slice evidence.
4. Always comment on: caliber, wall, lumen, and
   any filling defect or aneurysm.`,
    tr: `Sertifikalı bir vasküler radyologsun.
Sana vasküler BTA/MRA çalışmasından yapılandırılmış veri
ve AI kesit analizi bulguları veriliyor.
Görevin: damar bazlı yapılandırılmış rapor üret.
KRİTİK KURALLAR:
1. Değerlendirilen her damarı isimlendirip raporla.
2. Stenoz tahminleri görünür lümen karşılaştırması gerektirir.
3. Doğrudan kesit kanıtı olmadan oklüzyon tanısı koyma.`,
  },
  "general-radiology": {
    en: `You are a general radiologist.
The specific anatomical domain of this study could not be
confirmed from DICOM metadata or image analysis.
Your task: report only what is directly visible in the
provided slice findings. Do not speculate on anatomy
not represented in the data.
CRITICAL RULES:
1. State which region appears to be imaged based on slice content.
2. Report findings only — no domain-specific checklists.
3. Explicitly note that domain could not be confirmed.`,
    tr: `Genel bir radyologsun.
Bu çalışmanın anatomik alanı DICOM metadata veya
görüntü analizinden doğrulanamadı.
Görevin: yalnızca sağlanan kesit bulgularında doğrudan
görünenleri raporla. Veride temsil edilmeyen anatomi
hakkında spekülasyon yapma.`,
  },
};

function getSchema(domain: MedicalDomain): string {
  switch (domain) {
    case "spine":
      return SPINE_SCHEMA;
    case "brain":
      return BRAIN_SCHEMA;
    case "chest":
      return CHEST_SCHEMA;
    case "abdomen-pelvis":
      return ABDOMEN_SCHEMA;
    case "musculoskeletal":
      return MSK_SCHEMA;
    case "vascular":
      return VASCULAR_SCHEMA;
    default:
      return GENERAL_SCHEMA;
  }
}

function getSys(domain: MedicalDomain, lang: "tr" | "en"): string {
  const key =
    domain === "document-only" || domain === "mixed-fusion"
      ? "general-radiology"
      : domain;
  return SYS[key]?.[lang] ?? SYS["general-radiology"]![lang]!;
}

// ── Main prompt builder ──────────────────────

export function buildStudyReportPromptUniversal(
  input: StudyReportVertexInputUniversal,
  language: "tr" | "en"
): string {
  const tr = language === "tr";
  const {
    domain,
    studySummary,
    sliceStatistics,
    detectedAnomalies,
    groundedSliceFindings,
    coverageSummary,
  } = input;

  const sys = getSys(domain, language);
  const schema = getSchema(domain);

  // Block synthesis if there is no slice evidence at all
  const hasSliceEvidence =
    (groundedSliceFindings?.some(
      (sf) => sf.findings.length > 0 || sf.abnormalities.length > 0
    ) ??
      false) ||
    detectedAnomalies.length > 0;

  if (!hasSliceEvidence) {
    // Return a minimal valid JSON directly instructing
    // the model to produce a structured refusal
    return `${sys}

## ${tr ? "Uyarı" : "Warning"}
${
  tr
    ? "Bu çalışmada hiçbir kesit başarıyla analiz edilemedi. Görüntü kalitesi, format uyumsuzluğu veya işlem hatası nedeniyle bulgular üretilemedi. Aşağıdaki şemaya göre YALNIZCA bu durumu açıklayan bir rapor üret. Hiçbir klinik bulgu, anormallik veya izlenim üretme."
    : "No slices were successfully analyzed in this study. Image quality, format incompatibility, or processing errors prevented finding extraction. Produce a report using the schema below that ONLY describes this situation. Do NOT generate any clinical findings, abnormalities, or impression."
}

## ${tr ? "Çıktı Formatı" : "Output Format"}
${schema}`;
  }

  // Build grounded evidence block
  let evidenceBlock = "";
  if (groundedSliceFindings && groundedSliceFindings.length > 0) {
    const evidenceLines = groundedSliceFindings
      .filter((sf) => sf.findings.length > 0 || sf.abnormalities.length > 0)
      .map(
        (sf) =>
          `${sf.sliceLabel} [confidence=${sf.confidence}]: ` +
          `findings=[${sf.findings.join("; ")}] ` +
          `abnormalities=[${sf.abnormalities.join("; ")}]` +
          (sf.limitations.length > 0
            ? ` limitations=[${sf.limitations.join("; ")}]`
            : "")
      )
      .join("\n");
    evidenceBlock = tr
      ? `\n\n## Kesit Bazlı Kanıt (YALNIZCA BUNLARI KULLAN)\n${evidenceLines || "Anlamlı bulgu içeren kesit yok."}`
      : `\n\n## Per-Slice Evidence (USE ONLY THESE)\n${evidenceLines || "No slices with meaningful findings."}`;
  }

  // Build coverage warning
  let coverageBlock = "";
  if (coverageSummary) {
    const { totalSlices, analyzedSlices, coveragePercent } = coverageSummary;
    coverageBlock = tr
      ? `\n\n## Kapsam Uyarısı\n${totalSlices} kesitin ${analyzedSlices} tanesi analiz edildi (${coveragePercent}%). Analiz edilmeyen kesitler hakkında yorum yapma.`
      : `\n\n## Coverage Warning\n${analyzedSlices} of ${totalSlices} slices were analyzed (${coveragePercent}%). Do NOT make claims about unanalyzed slices.`;
  }

  const anomaliesBlock =
    detectedAnomalies.length > 0
      ? JSON.stringify(detectedAnomalies, null, 2)
      : tr
        ? "Tespit edilen anomali yok."
        : "No detected anomalies.";

  return `${sys}

## ${tr ? "Çalışma Özeti" : "Study Summary"}
${JSON.stringify(studySummary, null, 2)}

## ${tr ? "Dilim İstatistikleri" : "Slice Statistics"}
${JSON.stringify(sliceStatistics, null, 2)}

## ${tr ? "Tespit Edilen Anormallikler" : "Detected Anomalies"}
${anomaliesBlock}${evidenceBlock}${coverageBlock}

## ${tr ? "Çıktı Formatı" : "Output Format"}
${schema}`;
}

// Re-export legacy name for backward compatibility
export type StudyReportVertexInput = StudyReportVertexInputUniversal;
