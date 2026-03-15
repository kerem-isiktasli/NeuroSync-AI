/**
 * Deterministic logic that decides what additional data should be requested
 * based on classification, extraction, and image context.
 */

import type { ClassificationResult, DomainRoute } from "./classificationPrompts";
import type { StudyMetadata } from "./studyAggregator";
import type { StudyIntakeSummary } from "./studyIntake";

export interface DataRequestItem {
  item: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

interface DataRequestInput {
  domainRoute: DomainRoute;
  classification: ClassificationResult;
  imageCount: number;
  extractionLimitations: string[];
  language: "tr" | "en";
  studyMetadata?: StudyMetadata | null;
  intakeSummary?: StudyIntakeSummary | null;
}

const TR = {
  fullStudy: "Tam çalışma / tüm kesitler",
  fullStudyReason: "Tek bir kesit veya sınırlı görüntü ile güvenilir yorumlama yapılamaz.",
  sagittalAxialCoronal: "Sagittal, aksiyel ve koronal kesitler",
  sagittalAxialCoronalReason: "MRI yorumlaması için birden fazla düzlem gereklidir.",
  officialReport: "Resmi radyoloji raporu",
  officialReportReason: "AI yorumlamasını doğrulamak ve ek klinik bilgi edinmek için önemlidir.",
  priorImaging: "Önceki görüntülemeler (karşılaştırma için)",
  priorImagingReason: "Değişikliklerin veya ilerlemenin değerlendirmesi için karşılaştırma gereklidir.",
  clinicalHistory: "Klinik öykü (semptomlar, süre, önceki tedavi)",
  clinicalHistoryReason: "Bulguların klinik anlamını belirlemek için hasta bilgisi gereklidir.",
  betterQuality: "Daha yüksek kaliteli görüntü",
  betterQualityReason: "Düşük kaliteli görüntü güvenilir değerlendirmeyi sınırlandırmaktadır.",
  contrastSeries: "Kontrastlı seri (varsa)",
  contrastSeriesReason: "Kontrastlı görüntüler lezyon karakterizasyonu için gerekli olabilir.",
  patientAge: "Hasta yaşı ve cinsiyeti",
  patientAgeReason: "Yaş ve cinsiyet, olasılık sıralamasını önemli ölçüde etkiler.",
  fullReport: "Tam rapor veya belge (ekran görüntüsü yerine)",
  fullReportReason: "Ekran görüntüsünden sınırlı bilgi çıkarılabilir; orijinal rapor daha güvenilirdir.",
};

const EN = {
  fullStudy: "Complete imaging study / all slices",
  fullStudyReason: "Reliable interpretation cannot be made from a single slice or limited images.",
  sagittalAxialCoronal: "Sagittal, axial, and coronal planes",
  sagittalAxialCoronalReason: "Multiple planes are required for proper MRI interpretation.",
  officialReport: "Official radiology report",
  officialReportReason: "Important to verify AI interpretation and obtain additional clinical information.",
  priorImaging: "Prior imaging studies (for comparison)",
  priorImagingReason: "Comparison is needed to assess changes or progression over time.",
  clinicalHistory: "Clinical history (symptoms, duration, previous treatment)",
  clinicalHistoryReason: "Patient information is needed to determine clinical significance of findings.",
  betterQuality: "Higher quality image",
  betterQualityReason: "Low image quality limits reliable assessment.",
  contrastSeries: "Contrast-enhanced series (if available)",
  contrastSeriesReason: "Contrast images may be needed for lesion characterization.",
  patientAge: "Patient age and sex",
  patientAgeReason: "Age and sex significantly affect differential probability ranking.",
  fullReport: "Complete report or document (instead of screenshot)",
  fullReportReason: "Limited information can be extracted from a screenshot; the original report is more reliable.",
};

export function deriveAdditionalDataRequests(input: DataRequestInput): DataRequestItem[] {
  const items: DataRequestItem[] = [];
  const t = input.language === "tr" ? TR : EN;
  const {
    domainRoute,
    classification,
    imageCount,
    extractionLimitations,
  } = input;

  const limitsText = extractionLimitations.join(" ").toLowerCase();
  const isLowQuality = classification.image_quality === "low";
  const isSingleImage = imageCount <= 1;
  const isLowConfidence = classification.confidence < 60;

  // Universal: always request clinical history
  items.push({
    item: t.clinicalHistory,
    reason: t.clinicalHistoryReason,
    priority: "high",
  });

  items.push({
    item: t.patientAge,
    reason: t.patientAgeReason,
    priority: "medium",
  });

  const studyMeta = input.studyMetadata;

  // Single-image cases
  if (isSingleImage) {
    items.push({
      item: t.fullStudy,
      reason: t.fullStudyReason,
      priority: "high",
    });
  }

  const intake = input.intakeSummary;

  if ((intake?.reportImageCount ?? 0) > 0 && intake?.hasMixedUpload) {
    const reportNote = input.language === "tr"
      ? "Rapor ekran görüntüleri tespit edildi; metin çıkarılamadı. Resmi rapor metnini paylaşın."
      : "Report screenshots detected; text could not be extracted. Please share the official report text.";
    items.push({
      item: input.language === "tr" ? "Resmi rapor metni (OCR yerine)" : "Official report text (instead of screenshot)",
      reason: reportNote,
      priority: "medium",
    });
  }

  // Study adequacy based requests
  if (studyMeta) {
    if (studyMeta.studyAdequacy === "localizer-only") {
      const locMsg = input.language === "tr"
        ? "Tanısal kesitler (lokalizör dışı görüntüler)"
        : "Diagnostic slices (non-localizer images)";
      const locReason = input.language === "tr"
        ? "Yüklenen görüntüler yalnızca lokalizör/scout görüntülerdir; tanısal görüntüler gereklidir."
        : "Uploaded images are localizer/scout images only; diagnostic images are required.";
      items.push({ item: locMsg, reason: locReason, priority: "high" });
    }

    if (studyMeta.studyAdequacy === "non-diagnostic") {
      const ndMsg = input.language === "tr"
        ? "Daha yüksek tanısal değere sahip görüntüler"
        : "Images with higher diagnostic value";
      const ndReason = input.language === "tr"
        ? "Mevcut görüntüler tanısal olmayan kalitede; güvenilir yorumlama yapılamaz."
        : "Current images are of non-diagnostic quality; reliable interpretation is not possible.";
      items.push({ item: ndMsg, reason: ndReason, priority: "high" });
    }
  }

  // MRI-specific
  if (
    domainRoute === "spine-mri" ||
    domainRoute === "brain-imaging" ||
    domainRoute === "musculoskeletal-general"
  ) {
    const missingPlanes = studyMeta
      ? (["sagittal", "axial", "coronal"] as const).filter(
          (p) => !studyMeta.planesAvailable.includes(p)
        )
      : [];

    if (
      isSingleImage ||
      limitsText.includes("single") ||
      limitsText.includes("slice") ||
      limitsText.includes("plane") ||
      (studyMeta && missingPlanes.length > 0)
    ) {
      const planeDetail =
        missingPlanes.length > 0
          ? ` (${input.language === "tr" ? "eksik" : "missing"}: ${missingPlanes.join(", ")})`
          : "";
      items.push({
        item: t.sagittalAxialCoronal + planeDetail,
        reason: t.sagittalAxialCoronalReason,
        priority: "high",
      });
    }
    if (!limitsText.includes("contrast")) {
      items.push({
        item: t.contrastSeries,
        reason: t.contrastSeriesReason,
        priority: "medium",
      });
    }
  }

  // Chest / abdomen — ask for official report
  if (domainRoute === "chest-imaging" || domainRoute === "abdomen-imaging") {
    items.push({
      item: t.officialReport,
      reason: t.officialReportReason,
      priority: "high",
    });
  }

  // Low quality
  if (isLowQuality) {
    items.push({
      item: t.betterQuality,
      reason: t.betterQualityReason,
      priority: "high",
    });
  }

  // Medical photo / unknown — usually need more context
  if (domainRoute === "medical-photo") {
    items.push({
      item: t.fullReport,
      reason: t.fullReportReason,
      priority: "medium",
    });
  }

  // Prior imaging for comparison
  if (isLowConfidence || limitsText.includes("comparison") || limitsText.includes("prior")) {
    items.push({
      item: t.priorImaging,
      reason: t.priorImagingReason,
      priority: "medium",
    });
  }

  // Deduplicate by item name
  const seen = new Set<string>();
  return items.filter((req) => {
    if (seen.has(req.item)) return false;
    seen.add(req.item);
    return true;
  });
}
