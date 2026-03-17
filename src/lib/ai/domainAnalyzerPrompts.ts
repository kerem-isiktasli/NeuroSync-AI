/**
 * Domain-specific analyzer prompts — structured image analysis.
 * Each prompt instructs the model to inspect actual image content and return
 * schema-compatible JSON for brain, chest, spine, abdomen-pelvis.
 */
import type { MedicalDomain } from "@/lib/medical/domainRouter";

export interface DomainAnalyzerContext {
  domain: MedicalDomain;
  modality?: string;
  anatomicalRegion?: string;
  sliceIndex?: number;
  totalSlices?: number;
  language: "tr" | "en";
}

// ─── Brain ───────────────────────────────────────────────

const BRAIN_SCHEMA = `
RETURN ONLY VALID JSON (no markdown):
{
  "lesionLocalization": [{"region": "string", "finding": "string"}],
  "hemorrhageEdemaMassEffect": ["string"],
  "ventricularFindings": ["string"],
  "extraAxialFindings": ["string"],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"],
  "confidence": 0-100,
  "limitations": ["string"],
  "evidenceSummary": "string"
}`;

function brainPrompt(ctx: DomainAnalyzerContext): string {
  const tr = ctx.language === "tr";
  const sliceInfo =
    ctx.sliceIndex != null && ctx.totalSlices != null
      ? ` (${ctx.sliceIndex + 1}/${ctx.totalSlices})`
      : "";
  return tr
    ? `Sen bir nöroradyologsun. Bu${sliceInfo} beyin görüntüsü gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü dikkatle incele ve aşağıdaki yapılandırılmış bulguları raporla.

DEĞERLENDİR:
- Simetri: korunmuş / asimetrik
- Ventriküller: normal / genişlemiş
- Kitle etkisi: görülmedi / şüpheli
- Kanama paterni: görülmedi / şüpheli
- Ekstra-aksiyel koleksiyon: görülmedi / şüpheli
- Lezyon lokalizasyonu (bölge + bulgu)
- Bariz parankim anormallikleri

Belirsizse veya kalite düşükse limitations'a yaz.
${BRAIN_SCHEMA}`
    : `You are a neuroradiologist. This${sliceInfo} brain image is a real medical image.
TASK: Carefully inspect the image and report these structured findings.

ASSESS:
- Symmetry: preserved / asymmetric
- Ventricles: normal / enlarged
- Mass effect: not seen / suspected
- Hemorrhage pattern: not seen / suspected
- Extra-axial collection: not seen / suspected
- Lesion localization (region + finding)
- Obvious parenchymal abnormalities

If unclear or quality poor, note in limitations.
${BRAIN_SCHEMA}`;
}

// ─── Chest ──────────────────────────────────────────────

const CHEST_SCHEMA = `
RETURN ONLY VALID JSON (no markdown):
{
  "lungLobeFindings": [{"lobe": "string", "finding": "string"}],
  "pleuraEffusionConsolidation": ["string"],
  "noduleFindings": ["string"],
  "mediastinumFindings": ["string"],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"],
  "confidence": 0-100,
  "limitations": ["string"],
  "evidenceSummary": "string"
}`;

function chestPrompt(ctx: DomainAnalyzerContext): string {
  const tr = ctx.language === "tr";
  const sliceInfo =
    ctx.sliceIndex != null && ctx.totalSlices != null
      ? ` (${ctx.sliceIndex + 1}/${ctx.totalSlices})`
      : "";
  return tr
    ? `Sen bir toraks radyologusun. Bu${sliceInfo} toraks görüntüsü gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü incele ve aşağıdaki yapılandırılmış bulguları raporla.

DEĞERLENDİR:
- Akciğer alanları genel görünümü
- Plevral effüzyon: görülmedi / şüpheli
- Fokal opasite / konsolidasyon: görülmedi / şüpheli
- Gross mediastinal anormallik: görülmedi / şüpheli
- Belirgin lezyon/nodül varsa
- Lob bazlı bulgular

Belirsizse limitations'a yaz.
${CHEST_SCHEMA}`
    : `You are a chest radiologist. This${sliceInfo} chest image is a real medical image.
TASK: Inspect the image and report these structured findings.

ASSESS:
- Lung field overview
- Pleural effusion: not seen / suspected
- Focal opacity / consolidation: not seen / suspected
- Gross mediastinal abnormality: not seen / suspected
- Visible lesion/nodule if clear enough
- Lobe-specific findings

If unclear, note in limitations.
${CHEST_SCHEMA}`;
}

// ─── Spine ───────────────────────────────────────────────

const SPINE_SCHEMA = `
RETURN ONLY VALID JSON (no markdown):
{
  "vertebraeFindings": [{"level": "string", "finding": "string"}],
  "canalForaminaFindings": ["string"],
  "discFindings": ["string"],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"],
  "confidence": 0-100,
  "limitations": ["string"],
  "evidenceSummary": "string"
}`;

function spinePrompt(ctx: DomainAnalyzerContext): string {
  const tr = ctx.language === "tr";
  const sliceInfo =
    ctx.sliceIndex != null && ctx.totalSlices != null
      ? ` (${ctx.sliceIndex + 1}/${ctx.totalSlices})`
      : "";
  const region = ctx.anatomicalRegion || "unknown";
  return tr
    ? `Sen bir omurga radyologusun. Bu${sliceInfo} omurga görüntüsü (bölge: ${region}) gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü incele ve aşağıdaki yapılandırılmış bulguları raporla.

DEĞERLENDİR:
- Bölge / seviye aralığı
- Hiza (alignment)
- Disk ile ilgili anormallikler
- Kanal daralması
- Deformite / kompresyon
- Seviye bazlı bulgular (tanımlanabilirse)
- Vertebra seviyesi (ör. L4-L5, C5-C6)

Belirsizse limitations'a yaz.
${SPINE_SCHEMA}`
    : `You are a spine radiologist. This${sliceInfo} spine image (region: ${region}) is a real medical image.
TASK: Inspect the image and report these structured findings.

ASSESS:
- Region / level range
- Alignment
- Disc-related abnormalities
- Canal narrowing
- Deformity / compression
- Level-specific findings when identifiable
- Vertebra level (e.g. L4-L5, C5-C6)

If unclear, note in limitations.
${SPINE_SCHEMA}`;
}

// ─── Abdomen/Pelvis ──────────────────────────────────────

const ABDOMEN_SCHEMA = `
RETURN ONLY VALID JSON (no markdown):
{
  "organFindings": [{"organ": "string", "finding": "string"}],
  "liverFindings": ["string"],
  "kidneyFindings": ["string"],
  "bowelBladderFindings": ["string"],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"],
  "confidence": 0-100,
  "limitations": ["string"],
  "evidenceSummary": "string"
}`;

function abdomenPrompt(ctx: DomainAnalyzerContext): string {
  const tr = ctx.language === "tr";
  const sliceInfo =
    ctx.sliceIndex != null && ctx.totalSlices != null
      ? ` (${ctx.sliceIndex + 1}/${ctx.totalSlices})`
      : "";
  return tr
    ? `Sen bir batın radyologusun. Bu${sliceInfo} batın/pelvis görüntüsü gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü incele ve aşağıdaki yapılandırılmış bulguları raporla.

DEĞERLENDİR:
- Gross organ özeti (karaciğer, dalak, böbrekler, vb.)
- Görünür asimetri / büyük lezyon şüphesi
- Sıvı / distansiyon / gross anormallik (görülürse)
- Organ bazlı bulgular

Belirsizse limitations'a yaz.
${ABDOMEN_SCHEMA}`
    : `You are an abdominal radiologist. This${sliceInfo} abdomen/pelvis image is a real medical image.
TASK: Inspect the image and report these structured findings.

ASSESS:
- Gross organ overview (liver, spleen, kidneys, etc.)
- Visible asymmetry / large lesion suspicion
- Fluid / distention / gross abnormality if seen
- Organ-specific findings

If unclear, note in limitations.
${ABDOMEN_SCHEMA}`;
}

// ─── General / fallback ───────────────────────────────────

const GENERAL_SCHEMA = `
RETURN ONLY VALID JSON (no markdown):
{
  "findings": ["string"],
  "abnormalities": ["string"],
  "impression": "string",
  "recommendedNextSteps": ["string"],
  "confidence": 0-100,
  "limitations": ["string"],
  "evidenceSummary": "string"
}`;

function generalPrompt(ctx: DomainAnalyzerContext): string {
  const tr = ctx.language === "tr";
  const region = ctx.anatomicalRegion || "unknown";
  return tr
    ? `Sen bir radyologsun. Bu görüntü (bölge: ${region}) gerçek bir tıbbi görüntüdür.
Görünen anatomi, bariz anormallikler ve kısıtlamaları raporla.
${GENERAL_SCHEMA}`
    : `You are a radiologist. This image (region: ${region}) is a real medical image.
Report visible anatomy, obvious abnormalities, and limitations.
${GENERAL_SCHEMA}`;
}

// ─── Public API ───────────────────────────────────────────

export function getDomainAnalyzerPrompt(ctx: DomainAnalyzerContext): string {
  switch (ctx.domain) {
    case "brain":
      return brainPrompt(ctx);
    case "chest":
      return chestPrompt(ctx);
    case "spine":
      return spinePrompt(ctx);
    case "abdomen-pelvis":
      return abdomenPrompt(ctx);
    default:
      return generalPrompt(ctx);
  }
}
