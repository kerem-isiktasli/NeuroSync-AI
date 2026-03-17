/**
 * Tests for localizer report generator.
 */

import { describe, it, expect } from "vitest";
import { generateLocalizerReport, localizerReportToFinalResponse } from "../localizerReport";
import type { LocalizerDetectionResult } from "../localizerDetection";

describe("generateLocalizerReport", () => {
  it("returns structured LOCALIZER_DETECTED report", () => {
    const detection: LocalizerDetectionResult = {
      sequenceType: "LOCALIZER",
      confidence: 0.9,
      detectedIndicators: ["OCR keyword: localizer", "Low slice count"],
    };
    const report = generateLocalizerReport(detection);
    expect(report.reportType).toBe("LOCALIZER_DETECTED");
    expect(report.interpretation).toContain("localizer");
    expect(report.explanation).toContain("positioning scans");
    expect(report.recommendation.some((r) => r.includes("sagittal"))).toBe(true);
    expect(report.recommendation.some((r) => r.includes("axial"))).toBe(true);
    expect(report.recommendation.some((r) => r.includes("coronal"))).toBe(true);
    expect(report.detectedIndicators).toEqual(["OCR keyword: localizer", "Low slice count"]);
    expect(report.confidence).toBe(0.9);
  });

  it("uses default indicators when none provided", () => {
    const detection: LocalizerDetectionResult = {
      sequenceType: "LOCALIZER",
      confidence: 0.75,
      detectedIndicators: [],
    };
    const report = generateLocalizerReport(detection);
    expect(report.reportType).toBe("LOCALIZER_DETECTED");
    expect(report.detectedIndicators.length).toBeGreaterThan(0);
  });
});

describe("localizerReportToFinalResponse", () => {
  it("produces API-compatible FinalResponse shape", () => {
    const report = {
      reportType: "LOCALIZER_DETECTED" as const,
      interpretation: "These images appear to be MRI/CT localizer (scout) images.",
      explanation: "Localizer images are positioning scans...",
      recommendation: ["Upload diagnostic slices.", "Use sagittal/axial/coronal."],
      detectedIndicators: ["OCR keyword: localizer"],
      confidence: 0.85,
    };
    const en = localizerReportToFinalResponse(report, "en");
    expect(en.reportType).toBe("LOCALIZER_DETECTED");
    expect((en as { localizerReport?: unknown }).localizerReport).toBeDefined();
    expect((en as { localizerReport?: { interpretation: string } }).localizerReport?.interpretation).toBe(report.interpretation);
    expect(en.summary).toBe(report.interpretation);
    expect(en.key_findings?.length).toBeGreaterThan(0);
    expect(en.concern_level).toBe("low");
    expect(en.report_sections?.interpretive_impression).toBe(report.explanation);
    expect(en.report_sections?.next_steps).toEqual(report.recommendation);
  });

  it("includes Turkish content when language is tr", () => {
    const report = {
      reportType: "LOCALIZER_DETECTED" as const,
      interpretation: "Test",
      explanation: "Test",
      recommendation: ["A"],
      detectedIndicators: [],
      confidence: 0.8,
    };
    const tr = localizerReportToFinalResponse(report, "tr");
    expect(tr.questions_for_doctor?.[0]).toContain("serisi");
  });
});
