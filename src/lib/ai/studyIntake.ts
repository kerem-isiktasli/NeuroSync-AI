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

export type RecommendedPipeline =
  | "image-analysis"
  | "report-ocr"
  | "fusion"
  | "insufficient-data";

export interface StudyIntakeSummary {
  imageCount: number;
  uploadTypesPresent: UploadType[];
  diagnosticImageCount: number;
  localizerCount: number;
  reportImageCount: number;
  viewerScreenshotCount: number;
  lowQualityCount: number;
  planesAvailable: string[];
  hasMixedUpload: boolean;
  likelySingleStudy: boolean;
  studyAdequacy: StudyIntakeAdequacy;
  recommendedPipeline: RecommendedPipeline;
  perImageIntake: PerImageIntakeResult[];
}

/**
 * Indices of images suitable for image-analysis pipeline (diagnostic-images,
 * excluding localizers, report-images, non-diagnostic).
 */
export function getDiagnosticImageIndices(perImage: PerImageIntakeResult[]): number[] {
  return perImage
    .filter(
      (p) =>
        p.upload_type === "diagnostic-image" &&
        p.diagnostic_value !== "none" &&
        !p.contains_report_text
    )
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
      p.upload_type === "diagnostic-image" &&
      (p.diagnostic_value === "high" || p.diagnostic_value === "medium" || p.diagnostic_value === "low")
  ).length;

  const localizerCount = perImageIntake.filter((p) => p.upload_type === "localizer").length;

  const reportImageCount = perImageIntake.filter(
    (p) => p.upload_type === "report-image" || p.contains_report_text
  ).length;

  const viewerScreenshotCount = perImageIntake.filter(
    (p) => p.upload_type === "viewer-screenshot"
  ).length;

  const lowQualityCount = perImageIntake.filter(
    (p) =>
      p.upload_type === "non-diagnostic" ||
      p.diagnostic_value === "none" ||
      p.upload_type === "unknown"
  ).length;

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

  const recommendedPipeline = deriveRecommendedPipeline(
    studyAdequacy,
    diagnosticImageCount,
    reportImageCount,
    hasMixedUpload
  );

  return {
    imageCount,
    uploadTypesPresent,
    diagnosticImageCount,
    localizerCount,
    reportImageCount,
    viewerScreenshotCount,
    lowQualityCount,
    planesAvailable,
    hasMixedUpload,
    likelySingleStudy,
    studyAdequacy,
    recommendedPipeline,
    perImageIntake,
  };
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
  if (localizer >= total * 0.8 && diagnostic === 0) return "localizer-only";
  if (lowQuality >= total * 0.8) return "non-diagnostic";

  if (hasMixed && diagnostic > 0 && report > 0) return "mixed";

  if (diagnostic >= 2) return "diagnostic";
  if (diagnostic >= 1) return "partial";

  return "non-diagnostic";
}

function deriveRecommendedPipeline(
  adequacy: StudyIntakeAdequacy,
  diagnosticCount: number,
  reportCount: number,
  hasMixed: boolean
): RecommendedPipeline {
  if (adequacy === "report-only") return "report-ocr";
  if (adequacy === "mixed" && diagnosticCount > 0 && reportCount > 0) return "fusion";

  if (diagnosticCount >= 1) return "image-analysis";

  if (adequacy === "localizer-only" || adequacy === "non-diagnostic") {
    return "insufficient-data";
  }

  return "image-analysis";
}
