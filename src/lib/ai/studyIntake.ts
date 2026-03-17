/**
 * Study intake aggregation — combines per-image intake results into a summary
 * that determines recommended pipeline and study adequacy.
 */

import type { PerImageIntakeResult, UploadType } from "./intakePrompts";

export type StudyIntakeAdequacy =
  | "diagnostic"
  | "partial"
  | "localizer-only"
  | "report-only"
  | "mixed"
  | "non-diagnostic";

/** 4-tier triage: unusable → refuse; limited → LIMITED_INTERPRETATION; interpretable/strong → full report */
export type AdequacyTier = "unusable" | "limited" | "interpretable" | "strong";

export type RecommendedPipeline =
  | "image-analysis"
  | "report-ocr"
  | "fusion"
  | "insufficient-data";

export interface StudyIntakeSummary {
  imageCount: number;
  uploadTypesPresent: UploadType[];
  diagnosticImageCount: number;
  viewableImageCount: number;
  localizerCount: number;
  reportImageCount: number;
  viewerScreenshotCount: number;
  lowQualityCount: number;
  planesAvailable: string[];
  hasMixedUpload: boolean;
  likelySingleStudy: boolean;
  studyAdequacy: StudyIntakeAdequacy;
  adequacyTier: AdequacyTier;
  recommendedPipeline: RecommendedPipeline;
  perImageIntake: PerImageIntakeResult[];
}

const DIAGNOSTIC_VALUE_OK = new Set(["high", "medium", "low"]);

/**
 * Indices of images suitable for image-analysis pipeline (diagnostic-images,
 * excluding localizers, report-images, non-diagnostic).
 */
export function getDiagnosticImageIndices(perImage: PerImageIntakeResult[]): number[] {
  return perImage
    .filter(
      (p) =>
        p.upload_type === "diagnostic-image" &&
        DIAGNOSTIC_VALUE_OK.has(p.diagnostic_value) &&
        !p.contains_report_text
    )
    .map((p) => p.imageIndex);
}

/**
 * Indices of images that are reasonably viewable for interpretation.
 * Broad: prefer limited interpretation over refusal.
 * Only excludes pure localizers and pure report-text screenshots.
 */
export function getViewableImageIndices(perImage: PerImageIntakeResult[]): number[] {
  return perImage
    .filter((p) => {
      if (p.upload_type === "localizer") return false;
      if (p.upload_type === "report-image") return false;
      if (p.contains_report_text && p.upload_type !== "diagnostic-image" && p.upload_type !== "viewer-screenshot") return false;
      // Accept anything with any diagnostic value
      if (DIAGNOSTIC_VALUE_OK.has(p.diagnostic_value)) return true;
      // Accept unknowns and non-diagnostics — let Vertex decide during extraction
      if (p.upload_type === "unknown" || p.upload_type === "non-diagnostic") return true;
      if (p.upload_type === "viewer-screenshot") return true;
      return false;
    })
    .map((p) => p.imageIndex);
}

/**
 * Indices of images that appear to be report/document screenshots.
 */
export function getReportImageIndices(perImage: PerImageIntakeResult[]): number[] {
  return perImage
    .filter(
      (p) =>
        p.upload_type === "report-image" || (p.contains_report_text && p.upload_type !== "diagnostic-image")
    )
    .map((p) => p.imageIndex);
}

export function buildStudyIntakeSummary(
  perImageIntake: PerImageIntakeResult[]
): StudyIntakeSummary {
  const imageCount = perImageIntake.length;

  const typeCounts = new Map<UploadType, number>();
  for (const p of perImageIntake) {
    typeCounts.set(p.upload_type, (typeCounts.get(p.upload_type) ?? 0) + 1);
  }

  const uploadTypesPresent = [...new Set(perImageIntake.map((p) => p.upload_type))];

  const diagnosticImageCount = perImageIntake.filter(
    (p) =>
      (p.upload_type === "diagnostic-image" || p.upload_type === "viewer-screenshot") &&
      (p.diagnostic_value === "high" || p.diagnostic_value === "medium" || p.diagnostic_value === "low")
  ).length;

  const localizerCount = perImageIntake.filter((p) => p.upload_type === "localizer").length;

  const reportImageCount = perImageIntake.filter(
    (p) => p.upload_type === "report-image" || p.contains_report_text
  ).length;

  const viewerScreenshotCount = perImageIntake.filter(
    (p) => p.upload_type === "viewer-screenshot"
  ).length;

  const lowQualityCount = perImageIntake.filter((p) => {
    if (p.upload_type === "non-diagnostic" || p.diagnostic_value === "none") return true;
    if (p.upload_type === "unknown" && p.confidence < 5) return true;
    return false;
  }).length;

  const planesAvailable = [
    ...new Set(
      perImageIntake
        .map((p) => p.image_plane)
        .filter((pl) => pl && pl !== "unknown")
    ),
  ];

  const hasMixedUpload =
    (diagnosticImageCount > 0 && reportImageCount > 0) ||
    (diagnosticImageCount > 0 && localizerCount > 0 && imageCount > 1) ||
    uploadTypesPresent.length >= 2;

  const likelySingleStudy =
    uploadTypesPresent.length <= 2 &&
    (diagnosticImageCount + localizerCount >= imageCount * 0.5 ||
      reportImageCount >= imageCount * 0.5);

  const studyAdequacy = deriveStudyAdequacy(
    imageCount,
    diagnosticImageCount,
    localizerCount,
    reportImageCount,
    lowQualityCount,
    hasMixedUpload
  );

  const viewableImageCount = getViewableImageIndices(perImageIntake).length;
  const adequacyTier = deriveAdequacyTier(
    studyAdequacy,
    diagnosticImageCount,
    viewableImageCount,
    imageCount,
    lowQualityCount
  );
  const recommendedPipeline = deriveRecommendedPipeline(
    studyAdequacy,
    adequacyTier,
    diagnosticImageCount,
    reportImageCount,
    hasMixedUpload,
    viewableImageCount
  );

  return {
    imageCount,
    uploadTypesPresent,
    diagnosticImageCount,
    viewableImageCount,
    localizerCount,
    reportImageCount,
    viewerScreenshotCount,
    lowQualityCount,
    planesAvailable,
    hasMixedUpload,
    likelySingleStudy,
    studyAdequacy,
    adequacyTier,
    recommendedPipeline,
    perImageIntake,
  };
}

function deriveAdequacyTier(
  adequacy: StudyIntakeAdequacy,
  diagnosticCount: number,
  viewableCount: number,
  total: number,
  lowQualityCount: number
): AdequacyTier {
  if (total === 0) return "unusable";
  if (adequacy === "report-only" && diagnosticCount === 0) return "unusable";
  if (adequacy === "localizer-only" && viewableCount === 0) return "unusable";

  // Even if intake classified as "non-diagnostic", give images a chance —
  // intake can misclassify usable screenshots. Only truly empty → unusable.
  if (adequacy === "non-diagnostic" && viewableCount === 0 && diagnosticCount === 0) {
    // Still try if there are images: return "limited" so pipeline runs
    return total > 0 ? "limited" : "unusable";
  }

  if (viewableCount >= 1 && diagnosticCount >= 2 && lowQualityCount <= total * 0.2) {
    return "strong";
  }
  if (diagnosticCount >= 1 || viewableCount >= 2) return "interpretable";
  if (viewableCount >= 1) return "limited";

  // Fallback: if there are any images at all, try limited analysis
  return total > 0 ? "limited" : "unusable";
}


function deriveStudyAdequacy(
  total: number,
  diagnostic: number,
  localizer: number,
  report: number,
  lowQuality: number,
  hasMixed: boolean
): StudyIntakeAdequacy {
  if (total === 0) return "non-diagnostic";

  if (report >= total * 0.8 && diagnostic === 0) return "report-only";
  if (localizer >= total * 0.95 && diagnostic === 0) return "localizer-only";
  if (lowQuality >= total * 0.95) return "non-diagnostic";

  if (hasMixed && diagnostic > 0 && report > 0) return "mixed";

  if (diagnostic >= 2) return "diagnostic";
  if (diagnostic >= 1) return "partial";

  return "non-diagnostic";
}

function deriveRecommendedPipeline(
  adequacy: StudyIntakeAdequacy,
  tier: AdequacyTier,
  diagnosticCount: number,
  reportCount: number,
  _hasMixed: boolean,
  viewableCount: number
): RecommendedPipeline {
  if (adequacy === "report-only") return "report-ocr";

  // Temporarily disabled: fusion pipeline (stability)
  // if (adequacy === "mixed" && diagnosticCount > 0 && reportCount > 0) return "fusion";

  // Only return insufficient-data when truly unusable AND no images at all
  if (tier === "unusable" && diagnosticCount === 0 && viewableCount === 0) return "insufficient-data";

  // Default: always try image-analysis if there are any images
  return "image-analysis";
}
