/**
 * Tests for localizer sequence detection.
 */

import { describe, it, expect } from "vitest";
import { detectLocalizerSequence } from "../localizerDetection";
import type { PerImageIntakeResult } from "@/lib/ai/intakePrompts";
import type { StudyIntakeSummary } from "@/lib/ai/studyIntake";

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
    anatomical_region_guess: "spine",
    image_plane: "sagittal",
    diagnostic_value: "high",
    contains_ui_overlay: false,
    contains_report_text: false,
    confidence: 80,
    reasons: [],
    ...overrides,
  };
}

describe("detectLocalizerSequence", () => {
  it("1. MRI localizer screenshots → LOCALIZER when OCR contains keyword", () => {
    const images = [
      { imageBase64: "base64...", fileName: "loc1.jpg" },
      { imageBase64: "base64...", fileName: "loc2.jpg" },
    ];
    const intake = [makeIntake(0, "loc1.jpg", { upload_type: "localizer", diagnostic_value: "low" })];
    const detection = detectLocalizerSequence({
      images,
      perImageIntake: intake,
      ocrText: "Series: Localizer 1/3",
    });
    expect(detection.sequenceType).toBe("LOCALIZER");
    expect(detection.confidence).toBeGreaterThan(0.5);
    expect(detection.detectedIndicators.some((i) => i.toLowerCase().includes("ocr"))).toBe(true);
  });

  it("2. Sagittal cervical MRI slices → DIAGNOSTIC", () => {
    const images = [
      { imageBase64: "x", fileName: "sag1.jpg" },
      { imageBase64: "x", fileName: "sag2.jpg" },
      { imageBase64: "x", fileName: "sag3.jpg" },
    ];
    const intake = images.map((_, i) =>
      makeIntake(i, `sag${i + 1}.jpg`, {
        upload_type: "diagnostic-image",
        diagnostic_value: "high",
        image_plane: "sagittal",
      })
    );
    const detection = detectLocalizerSequence({
      images,
      perImageIntake: intake,
      ocrText: "Sagittal T2 Cervical Spine",
    });
    expect(detection.sequenceType).toBe("DIAGNOSTIC");
    expect(detection.detectedIndicators).toHaveLength(0);
  });

  it("3. Axial CT brain slices → DIAGNOSTIC", () => {
    const images = Array.from({ length: 12 }, (_, i) => ({
      imageBase64: "x",
      fileName: `ct${i + 1}.jpg`,
    }));
    const intake = images.map((_, i) =>
      makeIntake(i, `ct${i + 1}.jpg`, {
        upload_type: "diagnostic-image",
        diagnostic_value: "high",
        image_plane: "axial",
      })
    );
    const detection = detectLocalizerSequence({
      images,
      perImageIntake: intake,
      ocrText: "CT Brain Axial",
    });
    expect(detection.sequenceType).toBe("DIAGNOSTIC");
  });

  it("4. Slice count < 10 AND anatomy low → LOCALIZER", () => {
    const images = Array.from({ length: 5 }, (_, i) => ({ imageBase64: "x", fileName: `img${i}.jpg` }));
    const intake = images.map((_, i) =>
      makeIntake(i, `img${i}.jpg`, {
        upload_type: "localizer",
        diagnostic_value: "low",
      })
    );
    const intakeSummary: StudyIntakeSummary = {
      imageCount: 5,
      uploadTypesPresent: ["localizer"],
      diagnosticImageCount: 0,
      localizerCount: 5,
      reportImageCount: 0,
      viewerScreenshotCount: 0,
      lowQualityCount: 0,
      planesAvailable: [],
      hasMixedUpload: false,
      likelySingleStudy: true,
      studyAdequacy: "localizer-only",
      recommendedPipeline: "insufficient-data",
      perImageIntake: intake,
    };
    const detection = detectLocalizerSequence({
      images,
      perImageIntake: intake,
      intakeSummary,
    });
    expect(detection.sequenceType).toBe("LOCALIZER");
    expect(detection.detectedIndicators.some((i) => i.toLowerCase().includes("slice"))).toBe(true);
  });

  it("5. Single screenshot with localizer text → LOCALIZER", () => {
    const detection = detectLocalizerSequence({
      images: [{ imageBase64: "x", fileName: "single.jpg" }],
      ocrText: "LOCALIZER - Scout View",
    });
    expect(detection.sequenceType).toBe("LOCALIZER");
  });

  it("6. OCR keywords: scout, survey, topogram, locator", () => {
    for (const kw of ["scout", "survey", "topogram", "locator"]) {
      const d = detectLocalizerSequence({
        images: [{ imageBase64: "x", fileName: "x.jpg" }],
        ocrText: `Series: ${kw} image`,
      });
      expect(d.sequenceType).toBe("LOCALIZER");
    }
  });

  it("7. No OCR, sliceCount >= 10, anatomy low → DIAGNOSTIC (false positive prevention)", () => {
    const images = Array.from({ length: 15 }, (_, i) => ({ imageBase64: "x", fileName: `i${i}.jpg` }));
    const intake = images.map((_, i) =>
      makeIntake(i, `i${i}.jpg`, { upload_type: "localizer", diagnostic_value: "low" })
    );
    const detection = detectLocalizerSequence({
      images,
      perImageIntake: intake,
      ocrText: "CT Brain Axial Series 1", // no localizer/scout/survey keyword
    });
    expect(detection.sequenceType).toBe("DIAGNOSTIC");
  });

  it("8. Slice count >= 10, anatomy high → DIAGNOSTIC", () => {
    const images = Array.from({ length: 8 }, (_, i) => ({ imageBase64: "x", fileName: `d${i}.jpg` }));
    const intake = images.map((_, i) =>
      makeIntake(i, `d${i}.jpg`, { upload_type: "diagnostic-image", diagnostic_value: "high" })
    );
    const detection = detectLocalizerSequence({
      images,
      perImageIntake: intake,
    });
    expect(detection.sequenceType).toBe("DIAGNOSTIC");
  });
});
