/**
 * Report Types Tests — verify report type labels and helpers.
 */
import { describe, it, expect } from "vitest";
import {
  getReportModeLabel,
  getReportModeBadgeClass,
  isLimitedReportMode,
  REPORT_MODE_LABELS,
} from "../reportTypes";
import type { ReportMode } from "@/types/diagnosis";

describe("reportTypes", () => {
  describe("getReportModeLabel", () => {
    it("returns English label for FULL_INTERPRETATION_REPORT", () => {
      expect(getReportModeLabel("FULL_INTERPRETATION_REPORT", "en")).toBe("Full Image Interpretation");
    });

    it("returns Turkish label for FULL_INTERPRETATION_REPORT", () => {
      expect(getReportModeLabel("FULL_INTERPRETATION_REPORT", "tr")).toBe("Tam Görüntü Yorumlaması");
    });

    it("returns correct label for METADATA_ONLY_REPORT", () => {
      expect(getReportModeLabel("METADATA_ONLY_REPORT", "en")).toContain("Metadata");
      expect(getReportModeLabel("METADATA_ONLY_REPORT", "en")).toContain("No Pixel");
    });

    it("returns correct label for LOCALIZER_DETECTED_REPORT", () => {
      expect(getReportModeLabel("LOCALIZER_DETECTED_REPORT", "en")).toContain("Localizer");
      expect(getReportModeLabel("LOCALIZER_DETECTED_REPORT", "en")).toContain("NOT Diagnostic");
    });

    it("returns correct label for DOCUMENT_EXTRACTION_REPORT", () => {
      expect(getReportModeLabel("DOCUMENT_EXTRACTION_REPORT", "en")).toContain("Document");
      expect(getReportModeLabel("DOCUMENT_EXTRACTION_REPORT", "en")).toContain("Report Text");
    });

    it("returns correct label for FUSION_REPORT", () => {
      expect(getReportModeLabel("FUSION_REPORT", "en")).toContain("Fusion");
    });

    it("returns fallback for undefined", () => {
      expect(getReportModeLabel(undefined, "en")).toBe("Report");
      expect(getReportModeLabel(undefined, "tr")).toBe("Rapor");
    });

    it("returns string for unknown mode", () => {
      expect(getReportModeLabel("UNKNOWN_MODE" as ReportMode, "en")).toBe("UNKNOWN_MODE");
    });
  });

  describe("getReportModeBadgeClass", () => {
    it("returns emerald for FULL_INTERPRETATION_REPORT", () => {
      const cls = getReportModeBadgeClass("FULL_INTERPRETATION_REPORT");
      expect(cls).toContain("emerald");
    });

    it("returns amber/slate for limited types", () => {
      expect(getReportModeBadgeClass("METADATA_ONLY_REPORT")).toContain("slate");
      expect(getReportModeBadgeClass("LOCALIZER_DETECTED_REPORT")).toContain("amber");
    });

    it("returns neutral for undefined", () => {
      const cls = getReportModeBadgeClass(undefined);
      expect(cls).toContain("theme");
    });
  });

  describe("isLimitedReportMode", () => {
    it("returns false for FULL_INTERPRETATION_REPORT", () => {
      expect(isLimitedReportMode("FULL_INTERPRETATION_REPORT")).toBe(false);
    });

    it("returns false for FUSION_REPORT", () => {
      expect(isLimitedReportMode("FUSION_REPORT")).toBe(false);
    });

    it("returns true for METADATA_ONLY_REPORT", () => {
      expect(isLimitedReportMode("METADATA_ONLY_REPORT")).toBe(true);
    });

    it("returns true for LOCALIZER_DETECTED_REPORT", () => {
      expect(isLimitedReportMode("LOCALIZER_DETECTED_REPORT")).toBe(true);
    });

    it("returns true for DOCUMENT_EXTRACTION_REPORT", () => {
      expect(isLimitedReportMode("DOCUMENT_EXTRACTION_REPORT")).toBe(true);
    });

    it("returns true for LIMITED_IMAGE_ANALYSIS_REPORT", () => {
      expect(isLimitedReportMode("LIMITED_IMAGE_ANALYSIS_REPORT")).toBe(true);
    });
  });

  describe("REPORT_MODE_LABELS coverage", () => {
    const modes: ReportMode[] = [
      "FULL_INTERPRETATION_REPORT",
      "LIMITED_IMAGE_ANALYSIS_REPORT",
      "METADATA_ONLY_REPORT",
      "LOCALIZER_DETECTED_REPORT",
      "DOCUMENT_EXTRACTION_REPORT",
      "FUSION_REPORT",
    ];

    it("has entry for each primary report mode", () => {
      for (const mode of modes) {
        expect(REPORT_MODE_LABELS[mode]).toBeDefined();
        expect(REPORT_MODE_LABELS[mode].en).toBeTruthy();
        expect(REPORT_MODE_LABELS[mode].tr).toBeTruthy();
        expect(REPORT_MODE_LABELS[mode].badgeColor).toBeTruthy();
      }
    });
  });
});
