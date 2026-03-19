/**
 * Deterministic report quality helpers:
 * - Confidence reason derivation (distinct from limitations)
 * - Route-specific question hints for synthesis
 */

import type { ClassificationResult, DomainRoute } from "./classificationPrompts";
import type { StudyMetadata } from "./studyAggregator";
import type { StudyIntakeSummary } from "./studyIntake";

// ─── CONFIDENCE REASONS ─────────────────────────────────

export interface ConfidenceAssessment {
  level: "high" | "moderate" | "low";
  score: number;
  reasons: string[];
}

interface ConfidenceInput {
  classification: ClassificationResult | null;
  imageCount: number;
  domainRoute: DomainRoute;
  language: "tr" | "en";
  studyMetadata?: StudyMetadata | null;
  intakeSummary?: StudyIntakeSummary | null;
}

export function deriveConfidenceAssessment(input: ConfidenceInput): ConfidenceAssessment {
  const { classification, imageCount, domainRoute, language, studyMetadata, intakeSummary } = input;
  const reasons: string[] = [];
  let penalty = 0;
  let bonus = 0;

  const tr = language === "tr";

  // Only penalise single-image for modalities that inherently require multiple slices (MRI, CT).
  // A single chest X-ray, dermato photo, or panoramic is a complete study — no penalty.
  const isMultiSliceModality = ["spine-mri", "brain-imaging", "musculoskeletal-general"].includes(domainRoute);
  if (imageCount <= 1 && isMultiSliceModality) {
    reasons.push(tr
      ? "Yalnızca tek bir görüntü sağlandı; kapsamlı değerlendirme için birden fazla kesit/görüntü gereklidir."
      : "Only a single image was provided; multiple slices/views are needed for comprehensive assessment.");
    penalty += 20;
  }

  if (classification) {
    if (classification.image_quality === "low") {
      reasons.push(tr
        ? "Görüntü kalitesi düşük olarak değerlendirildi."
        : "Image quality was assessed as low.");
      penalty += 20;
    } else if (classification.image_quality === "moderate") {
      reasons.push(tr
        ? "Görüntü kalitesi orta düzey olarak değerlendirildi."
        : "Image quality was assessed as moderate.");
      penalty += 5;
    }

    if (classification.confidence < 50) {
      reasons.push(tr
        ? "Görüntü sınıflandırma güvenilirliği düşük; modalite veya bölge belirsiz olabilir."
        : "Image classification confidence is low; modality or region may be uncertain.");
      penalty += 15;
    }
  } else {
    reasons.push(tr
      ? "Sınıflandırma bilgisi mevcut değil."
      : "Classification data is not available.");
    penalty += 25;
  }

  if (domainRoute === "unknown") {
    reasons.push(tr
      ? "Görüntü türü otomatik olarak sınıflandırılamadı; genel yorumlama uygulandı."
      : "Image type could not be automatically classified; a general interpretation was applied.");
    penalty += 15;
  }

  const isMri = domainRoute === "spine-mri" || domainRoute === "brain-imaging" || domainRoute === "musculoskeletal-general";
  if (isMri && imageCount <= 1) {
    reasons.push(tr
      ? "MRI yorumlaması için birden fazla düzlem (sagittal, aksiyel, koronal) gereklidir; yalnızca tek kesit mevcuttur."
      : "MRI interpretation requires multiple planes (sagittal, axial, coronal); only a single slice is available.");
    penalty += 10;
  }

  // Study-level confidence adjustments
  if (studyMetadata) {
    const { studyAdequacy, planesAvailable, localizerPresent, diagnosticImageCount } = studyMetadata;

    if (studyAdequacy === "diagnostic" && planesAvailable.length >= 2) {
      reasons.push(tr
        ? `Birden fazla düzlem mevcut (${planesAvailable.join(", ")}); çapraz doğrulama mümkün.`
        : `Multiple planes available (${planesAvailable.join(", ")}); cross-validation possible.`);
      bonus += 10;
    }

    if (studyAdequacy === "localizer-only") {
      reasons.push(tr
        ? "Yüklenen görüntüler yalnızca lokalizör/scout görüntülerden oluşuyor; tanısal değer çok düşük."
        : "Uploaded images consist only of localizer/scout images; diagnostic value is very low.");
      penalty += 25;
    } else if (studyAdequacy === "non-diagnostic") {
      reasons.push(tr
        ? "Yüklenen görüntüler tanısal değil; güvenilir yorumlama yapılamaz."
        : "Uploaded images are non-diagnostic; reliable interpretation is not possible.");
      penalty += 30;
    } else if (studyAdequacy === "partial") {
      reasons.push(tr
        ? "Çalışma kısmen yeterli; tam değerlendirme için ek görüntüler gerekli."
        : "Study is partially adequate; additional images are needed for full assessment.");
      penalty += 10;
    }

    if (localizerPresent && diagnosticImageCount > 0) {
      reasons.push(tr
        ? "Lokalizör görüntü(ler) tespit edildi ve tanısal görüntülerden ayrıldı."
        : "Localizer image(s) detected and separated from diagnostic images.");
    }

    if (diagnosticImageCount >= 3) {
      bonus += 5;
    }
  }

  if (intakeSummary) {
    const { recommendedPipeline, reportImageCount, localizerCount } = intakeSummary;
    if (recommendedPipeline === "fusion" && reportImageCount > 0) {
      reasons.push(tr
        ? "Karışık yükleme (tanısal görüntü + rapor ekran görüntüsü); rapor metni OCR ile işlenemedi."
        : "Mixed upload (diagnostic images + report screenshots); report text was not processed via OCR.");
      penalty += 5;
    }
    if (localizerCount > 0 && intakeSummary.diagnosticImageCount > 0) {
      reasons.push(tr
        ? `${localizerCount} lokalizör görüntüsü atlandı; yalnızca tanısal görüntüler işlendi.`
        : `${localizerCount} localizer image(s) were skipped; only diagnostic images were processed.`);
    }
    if (recommendedPipeline === "insufficient-data" && intakeSummary.diagnosticImageCount === 0) {
      penalty += 20;
    }
  }

  reasons.push(tr
    ? "Klinik öykü, hasta yaşı ve semptom bilgisi sağlanmadı."
    : "No clinical history, patient age, or symptom information was provided.");
  penalty += 10;

  const baseScore = classification?.confidence ?? 50;
  const finalScore = Math.max(5, Math.min(100, baseScore - penalty + bonus));

  let level: ConfidenceAssessment["level"];
  if (finalScore >= 70) level = "high";
  else if (finalScore >= 40) level = "moderate";
  else level = "low";

  return { level, score: finalScore, reasons };
}

// ─── ROUTE-SPECIFIC QUESTION HINTS ──────────────────────

export function getRouteQuestionHints(
  domainRoute: DomainRoute,
  concernLevel: string,
  language: "tr" | "en"
): string {
  const tr = language === "tr";
  const isHighRisk = concernLevel === "high" || concernLevel === "urgent-review";

  const hints: Record<DomainRoute, { tr: string; en: string }> = {
    "spine-mri": {
      tr: "Sorular omurga MRI bulgularına özel olmalıdır: sinir kökü basısı belirtileri, radikülopati, uyuşma/güçsüzlük, tam MRI serisi ihtiyacı, konservatif tedavi seçenekleri, ileri tetkik gerekliliği.",
      en: "Questions should be specific to spinal MRI findings: nerve root compression symptoms, radiculopathy, numbness/weakness, need for complete MRI series, conservative treatment options, necessity for further investigation.",
    },
    "brain-imaging": {
      tr: "Sorular beyin görüntüleme bulgularına özel olmalıdır: nörolojik semptomlar, kitle etkisi, kontrastlı çalışma ihtiyacı, nöbet öyküsü, baş ağrısı paternleri.",
      en: "Questions should be specific to brain imaging findings: neurological symptoms, mass effect, need for contrast study, seizure history, headache patterns.",
    },
    "chest-imaging": {
      tr: "Sorular göğüs görüntüleme bulgularına özel olmalıdır: enfeksiyon vs kitle ayrımı, takip görüntüleme, solunum semptomları, sigara öyküsü, BT ihtiyacı.",
      en: "Questions should be specific to chest imaging findings: infection vs mass differentiation, follow-up imaging, respiratory symptoms, smoking history, need for CT.",
    },
    "abdomen-imaging": {
      tr: "Sorular batın görüntüleme bulgularına özel olmalıdır: organ boyutları, kitle karakterizasyonu, kontrastlı çalışma, karın ağrısı paternleri, laboratuvar korelasyonu.",
      en: "Questions should be specific to abdominal imaging findings: organ size, mass characterization, contrast study, abdominal pain patterns, laboratory correlation.",
    },
    "musculoskeletal-general": {
      tr: "Sorular kas-iskelet bulgularına özel olmalıdır: eklem stabilitesi, ligament hasarı, kırık şüphesi, fizik tedavi, cerrahi değerlendirme gereksinimi.",
      en: "Questions should be specific to musculoskeletal findings: joint stability, ligament damage, fracture concern, physical therapy, surgical evaluation need.",
    },
    "medical-photo": {
      tr: "Sorular klinik fotoğraf bulgularına özel olmalıdır: lezyonun süresi, boyut değişimi, biyopsi ihtiyacı, dermatolojik değerlendirme.",
      en: "Questions should be specific to clinical photo findings: lesion duration, size change, biopsy need, dermatological evaluation.",
    },
    "unknown": {
      tr: "Sorular genel tıbbi görüntüleme bulgularına uygun olmalıdır: ek görüntüleme ihtiyacı, uzman değerlendirmesi, semptom korelasyonu.",
      en: "Questions should be appropriate for general medical imaging findings: need for additional imaging, specialist evaluation, symptom correlation.",
    },
  };

  let hint = hints[domainRoute]?.[language] ?? hints.unknown[language];

  if (isHighRisk) {
    hint += tr
      ? " Endişe düzeyi yüksek olduğundan, aciliyet ve zamanlamaya ilişkin sorular da ekle."
      : " Since concern level is high, also include questions about urgency and timing.";
  }

  return hint;
}
