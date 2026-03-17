/**
 * Unit tests for study intake aggregation and pipeline routing.
 * Run with: npx vitest run src/lib/ai/__tests__/studyIntake.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  buildStudyIntakeSummary,
  getDiagnosticImageIndices,
  getViewableImageIndices,
  getReportImageIndices,
} from "../studyIntake";
import type { PerImageIntakeResult } from "../intakePrompts";

function makeIntake(
  index: number,
  fileName: string,
  overrides: Partial<PerImageIntakeResult> = {}
): PerImageIntakeResult {
  return {
    imageIndex: index,
    fileName,
    upload_type: "diagnostic-image",
    modality_guess: "MRI",
    anatomical_region_guess: "Spine",
    image_plane: "sagittal",
    diagnostic_value: "high",
    contains_ui_overlay: false,
    contains_report_text: false,
    confidence: 80,
    reasons: [],
    ...overrides,
  };
}

describe("buildStudyIntakeSummary", () => {
  it("single diagnostic image → diagnostic adequacy, image-analysis pipeline", () => {
    const perImage = [
      makeIntake(0, "mri1.jpg", { upload_type: "diagnostic-image", diagnostic_value: "high" }),
    ];
    const summary = buildStudyIntakeSummary(perImage);
    expect(summary.studyAdequacy).toBe("partial"); // 1 diagnostic = partial per logic
    expect(summary.recommendedPipeline).toBe("image-analysis");
    expect(summary.diagnosticImageCount).toBe(1);
    expect(summary.localizerCount).toBe(0);
    expect(summary.reportImageCount).toBe(0);
  });

  it("multiple diagnostic images → diagnostic adequacy, image-analysis pipeline", () => {
    const perImage = [
      makeIntake(0, "mri1.jpg", { image_plane: "sagittal" }),
      makeIntake(1, "mri2.jpg", { image_plane: "axial" }),
    ];
    const summary = buildStudyIntakeSummary(perImage);
    expect(summary.studyAdequacy).toBe("diagnostic");
    expect(summary.recommendedPipeline).toBe("image-analysis");
    expect(summary.diagnosticImageCount).toBe(2);
  });

  it("localizer-heavy MRI screenshots → localizer-only, insufficient-data (tier unusable)", () => {
    const perImage = [
      makeIntake(0, "loc1.jpg", { upload_type: "localizer", diagnostic_value: "low" }),
      makeIntake(1, "loc2.jpg", { upload_type: "localizer", diagnostic_value: "none" }),
      makeIntake(2, "loc3.jpg", { upload_type: "localizer", diagnostic_value: "low" }),
    ];
    const summary = buildStudyIntakeSummary(perImage);
    expect(summary.studyAdequacy).toBe("localizer-only");
    expect(summary.adequacyTier).toBe("unusable");
    expect(summary.recommendedPipeline).toBe("insufficient-data");
    expect(summary.diagnosticImageCount).toBe(0);
    expect(summary.localizerCount).toBe(3);
  });

  it("limited viewable (1 unknown with signal) → tier limited, image-analysis", () => {
    const perImage = [
      makeIntake(0, "unk.jpg", { upload_type: "unknown", diagnostic_value: "low", confidence: 20 }),
    ];
    const summary = buildStudyIntakeSummary(perImage);
    expect(summary.adequacyTier).toBe("limited");
    expect(summary.recommendedPipeline).toBe("image-analysis");
    expect(summary.viewableImageCount).toBe(1);
  });

  it("screenshots of written radiology report → report-only, report-ocr pipeline", () => {
    const perImage = [
      makeIntake(0, "report1.png", {
        upload_type: "report-image",
        contains_report_text: true,
        diagnostic_value: "none",
      }),
      makeIntake(1, "report2.png", {
        upload_type: "report-image",
        contains_report_text: true,
        diagnostic_value: "none",
      }),
    ];
    const summary = buildStudyIntakeSummary(perImage);
    expect(summary.studyAdequacy).toBe("report-only");
    expect(summary.recommendedPipeline).toBe("report-ocr");
    expect(summary.diagnosticImageCount).toBe(0);
    expect(summary.reportImageCount).toBe(2);
  });

  it("mixed upload: report screenshot + MRI screenshot → mixed, fusion pipeline", () => {
    const perImage = [
      makeIntake(0, "mri.jpg", { upload_type: "diagnostic-image", diagnostic_value: "high" }),
      makeIntake(1, "report.png", {
        upload_type: "report-image",
        contains_report_text: true,
        diagnostic_value: "none",
      }),
    ];
    const summary = buildStudyIntakeSummary(perImage);
    expect(summary.studyAdequacy).toBe("mixed");
    expect(summary.recommendedPipeline).toBe("fusion");
    expect(summary.diagnosticImageCount).toBe(1);
    expect(summary.reportImageCount).toBe(1);
    expect(summary.hasMixedUpload).toBe(true);
  });

  it("poor-quality non-diagnostic upload → non-diagnostic, insufficient-data", () => {
    const perImage = [
      makeIntake(0, "blur.jpg", {
        upload_type: "non-diagnostic",
        diagnostic_value: "none",
      }),
      makeIntake(1, "blur2.jpg", {
        upload_type: "non-diagnostic",
        diagnostic_value: "none",
      }),
    ];
    const summary = buildStudyIntakeSummary(perImage);
    expect(summary.studyAdequacy).toBe("non-diagnostic");
    expect(summary.recommendedPipeline).toBe("insufficient-data");
    expect(summary.diagnosticImageCount).toBe(0);
    expect(summary.lowQualityCount).toBeGreaterThanOrEqual(2);
  });
});

describe("getDiagnosticImageIndices", () => {
  it("returns only diagnostic-image indices, excludes report and localizer", () => {
    const perImage = [
      makeIntake(0, "mri.jpg", { upload_type: "diagnostic-image" }),
      makeIntake(1, "report.png", { upload_type: "report-image", contains_report_text: true }),
      makeIntake(2, "mri2.jpg", { upload_type: "diagnostic-image" }),
      makeIntake(3, "loc.jpg", { upload_type: "localizer" }),
    ];
    const indices = getDiagnosticImageIndices(perImage);
    expect(indices).toEqual([0, 2]);
  });

  it("excludes diagnostic_value none", () => {
    const perImage = [
      makeIntake(0, "mri.jpg", { upload_type: "diagnostic-image", diagnostic_value: "none" }),
    ];
    const indices = getDiagnosticImageIndices(perImage);
    expect(indices).toEqual([]);
  });
});

describe("getViewableImageIndices", () => {
  it("includes viewer-screenshot and unknown with diagnostic value or confidence >= 5", () => {
    const perImage = [
      makeIntake(0, "mri.jpg", { upload_type: "diagnostic-image" }),
      makeIntake(1, "viewer.png", { upload_type: "viewer-screenshot", diagnostic_value: "medium" }),
      makeIntake(2, "unk.jpg", { upload_type: "unknown", diagnostic_value: "low", confidence: 20 }),
      makeIntake(3, "loc.jpg", { upload_type: "localizer" }),
      makeIntake(4, "unk2.jpg", { upload_type: "unknown", diagnostic_value: "low", confidence: 5 }),
      makeIntake(5, "excluded.jpg", { upload_type: "unknown", diagnostic_value: "none", confidence: 4 }),
    ];
    const indices = getViewableImageIndices(perImage);
    expect(indices).toEqual([0, 1, 2, 4]);
  });
});

describe("getReportImageIndices", () => {
  it("returns indices of report-image or contains_report_text", () => {
    const perImage = [
      makeIntake(0, "mri.jpg"),
      makeIntake(1, "report.png", {
        upload_type: "report-image",
        contains_report_text: true,
      }),
    ];
    const indices = getReportImageIndices(perImage);
    expect(indices).toEqual([1]);
  });
});
