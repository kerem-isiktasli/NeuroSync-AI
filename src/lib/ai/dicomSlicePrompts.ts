/**
 * Domain-specific prompts for DICOM slice-level image analysis.
 * Each prompt instructs the model to inspect actual image content.
 */
import type { MedicalDomain } from "@/lib/medical/domainRouter";

export interface DicomSliceAnalysisContext {
  domain: MedicalDomain;
  modality: string;
  anatomicalRegion: string;
  sliceIndex: number;
  totalSlices: number;
  language: "tr" | "en";
}

const OUTPUT_SCHEMA = `
RETURN ONLY VALID JSON (no markdown):
{
  "findings": ["string"],
  "abnormalities": ["string"],
  "confidence": 0-100,
  "limitations": ["string"],
  "sliceDescription": "string"
}`;

function brainPrompt(ctx: DicomSliceAnalysisContext): string {
  const tr = ctx.language === "tr";
  return tr
    ? `Sen bir nöroradyologsun. Bu ${ctx.modality} kesiti (${ctx.sliceIndex + 1}/${ctx.totalSlices}) gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü dikkatle incele ve bulguları raporla.

ARANACAKLAR:
- Simetri kaybı, midline shift
- Ventrikül genişlemesi
- Kitle etkisi
- Kanama veya hipodens/hiperdens lezyon
- Ekstra-aksiyel sıvı (subdural, epidural)
- Bariz beyin dokusu anormallikleri

Eğer belirsizse veya görüntü kalitesi düşükse limitations'a yaz.
${OUTPUT_SCHEMA}`
    : `You are a neuroradiologist. This ${ctx.modality} slice (${ctx.sliceIndex + 1}/${ctx.totalSlices}) is a real medical image.
TASK: Carefully inspect the image and report findings.

LOOK FOR:
- Loss of symmetry, midline shift
- Ventricular enlargement
- Mass effect
- Hemorrhage or hypodense/hyperdense lesion
- Extra-axial fluid (subdural, epidural)
- Obvious brain parenchyma abnormalities

If unclear or image quality is poor, note in limitations.
${OUTPUT_SCHEMA}`;
}

function chestPrompt(ctx: DicomSliceAnalysisContext): string {
  const tr = ctx.language === "tr";
  return tr
    ? `Sen bir toraks radyologusun. Bu ${ctx.modality} kesiti (${ctx.sliceIndex + 1}/${ctx.totalSlices}) gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü incele ve bulguları raporla.

ARANACAKLAR:
- Akciğer alanları, konsolidasyon
- Plevral effüzyon
- Mediastinal genişleme
- Bariz nodül veya kitle
- Kardiyomegali
- Kemik/soft tissue anormallikleri

Belirsizse limitations'a yaz.
${OUTPUT_SCHEMA}`
    : `You are a chest radiologist. This ${ctx.modality} slice (${ctx.sliceIndex + 1}/${ctx.totalSlices}) is a real medical image.
TASK: Inspect the image and report findings.

LOOK FOR:
- Lung fields, consolidation
- Pleural effusion
- Mediastinal enlargement
- Obvious nodule or mass
- Cardiomegaly
- Bone/soft tissue abnormalities

If unclear, note in limitations.
${OUTPUT_SCHEMA}`;
}

function spinePrompt(ctx: DicomSliceAnalysisContext): string {
  const tr = ctx.language === "tr";
  return tr
    ? `Sen bir omurga radyologusun. Bu ${ctx.modality} kesiti (${ctx.sliceIndex + 1}/${ctx.totalSlices}, bölge: ${ctx.anatomicalRegion}) gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü incele ve bulguları raporla.

ARANACAKLAR:
- Vertebral hiza
- Disk mesafesi değişiklikleri
- Spinal kanal daralması
- Kompresyon, deformite
- Bariz kırık
- Yumuşak doku şişliği
- Vertebra seviyesi (mümkünse)

Belirsizse limitations'a yaz.
${OUTPUT_SCHEMA}`
    : `You are a spine radiologist. This ${ctx.modality} slice (${ctx.sliceIndex + 1}/${ctx.totalSlices}, region: ${ctx.anatomicalRegion}) is a real medical image.
TASK: Inspect the image and report findings.

LOOK FOR:
- Vertebral alignment
- Disc space changes
- Spinal canal narrowing
- Compression, deformity
- Obvious fracture
- Soft tissue swelling
- Vertebra level if identifiable

If unclear, note in limitations.
${OUTPUT_SCHEMA}`;
}

function abdomenPrompt(ctx: DicomSliceAnalysisContext): string {
  const tr = ctx.language === "tr";
  return tr
    ? `Sen bir batın radyologusun. Bu ${ctx.modality} kesiti (${ctx.sliceIndex + 1}/${ctx.totalSlices}) gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü incele ve bulguları raporla.

ARANACAKLAR:
- Karaciğer, dalak, böbrekler
- Bariz kitle veya kist
- Serbest sıvı
- Bağırsak distansiyonu
- Organ asimetrisi
- Safra kesesi, pankreas (görünürse)

Belirsizse limitations'a yaz.
${OUTPUT_SCHEMA}`
    : `You are an abdominal radiologist. This ${ctx.modality} slice (${ctx.sliceIndex + 1}/${ctx.totalSlices}) is a real medical image.
TASK: Inspect the image and report findings.

LOOK FOR:
- Liver, spleen, kidneys
- Obvious mass or cyst
- Free fluid
- Bowel dilation
- Organ asymmetry
- Gallbladder, pancreas (if visible)

If unclear, note in limitations.
${OUTPUT_SCHEMA}`;
}

function generalPrompt(ctx: DicomSliceAnalysisContext): string {
  const tr = ctx.language === "tr";
  return tr
    ? `Sen bir radyologsun. Bu ${ctx.modality} kesiti (${ctx.sliceIndex + 1}/${ctx.totalSlices}, bölge: ${ctx.anatomicalRegion}) gerçek bir tıbbi görüntüdür.
GÖREV: Görüntüyü incele. Görünen anatomi, bariz anormallikler ve kısıtlamaları raporla.
${OUTPUT_SCHEMA}`
    : `You are a radiologist. This ${ctx.modality} slice (${ctx.sliceIndex + 1}/${ctx.totalSlices}, region: ${ctx.anatomicalRegion}) is a real medical image.
TASK: Inspect the image. Report visible anatomy, obvious abnormalities, and limitations.
${OUTPUT_SCHEMA}`;
}

export interface DicomTriageSliceContext {
  sliceIndex: number;
  totalSlices: number;
  language: "tr" | "en";
}

/** Flash triage: single 0–1 suspicion score per slice. */
export function getDicomTriageSlicePrompt(ctx: DicomTriageSliceContext): string {
  const tr = ctx.language === "tr";
  return tr
    ? `Bu bir tıbbi görüntü kesitidir (${ctx.sliceIndex + 1}/${ctx.totalSlices}). Görev: Bu kesitte bariz patoloji, önemli artefakt veya belirgin anormallik olup olmadığını hızlıca tahmin et.
Yanıt YALNIZCA JSON: {"score": 0 ile 1 arası sayı; 0=büyük ölçüde benign/sakin görünüm, 1=güçlü şüphe veya bariz anormallik}`
    : `This is one slice (${ctx.sliceIndex + 1}/${ctx.totalSlices}) from a medical imaging study. Task: Quickly estimate whether this slice likely shows obvious pathology, major artifact, or notable abnormality.
Return ONLY JSON: {"score": number from 0 to 1 where 0=likely benign/unremarkable, 1=high suspicion or obvious abnormality}`;
}

export function getDicomSliceAnalysisPrompt(ctx: DicomSliceAnalysisContext): string {
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

export interface DicomSliceAnalysisResult {
  findings: string[];
  abnormalities: string[];
  confidence: number;
  limitations: string[];
  sliceDescription: string;
  sliceIndex: number;
}
