/**
 * Unit tests for study-level correlation and multi-file reasoning.
 * Run with: npm run test
 */

import { describe, it, expect } from "vitest";
import { buildStudyMetadata, selectDiagnosticImages } from "../studyAggregator";
import {
  parseStructuredReconciliation,
  getStructuredReconciliationPrompt,
} from "../structuredReconciliation";
import type { ClassificationResult, DomainRoute } from "../classificationPrompts";

function makeClassification(overrides: Partial<ClassificationResult> = {}): ClassificationResult {
  return {
    modality: "MRI",
    anatomical_region: "Lumbar spine",
    domain_route: "spine-mri" as DomainRoute,
    image_quality: "high",
    image_plane: "sagittal",
    is_localizer: false,
    diagnostic_value: "high",
    series_type_guess: "T2",
    confidence: 85,
    limitations: [],
    ...overrides,
  };
}

describe("buildStudyMetadata", () => {
  it("1-image upload → partial adequacy", () => {
    const images = [
      { fileName: "mri1.jpg", classification: makeClassification(), domainRoute: "spine-mri" as DomainRoute },
    ];
    const meta = buildStudyMetadata(images);
    expect(meta.imageCount).toBe(1);
    expect(meta.diagnosticImageCount).toBe(1);
    expect(meta.studyAdequacy).toBe("partial");
    expect(meta.perImageClassifications).toHaveLength(1);
    expect(meta.perImageClassifications[0].image_plane).toBe("sagittal");
    expect(meta.perImageClassifications[0].diagnostic_value).toBe("high");
  });

  it("3-image diagnostic upload → diagnostic adequacy, multiple planes", () => {
    const images = [
      { fileName: "sag.jpg", classification: makeClassification({ image_plane: "sagittal" }), domainRoute: "spine-mri" as DomainRoute },
      { fileName: "ax.jpg", classification: makeClassification({ image_plane: "axial" }), domainRoute: "spine-mri" as DomainRoute },
      { fileName: "cor.jpg", classification: makeClassification({ image_plane: "coronal" }), domainRoute: "spine-mri" as DomainRoute },
    ];
    const meta = buildStudyMetadata(images);
    expect(meta.imageCount).toBe(3);
    expect(meta.diagnosticImageCount).toBe(3);
    expect(meta.studyAdequacy).toBe("diagnostic");
    expect(meta.planesAvailable).toContain("sagittal");
    expect(meta.planesAvailable).toContain("axial");
    expect(meta.planesAvailable).toContain("coronal");
    expect(meta.perImageClassifications).toHaveLength(3);
  });

  it("mixed diagnostic + localizer → localizerPresent, diagnostic count excludes localizers", () => {
    const images = [
      { fileName: "diag.jpg", classification: makeClassification(), domainRoute: "spine-mri" as DomainRoute },
      { fileName: "loc.jpg", classification: makeClassification({ is_localizer: true, diagnostic_value: "low" }), domainRoute: "spine-mri" as DomainRoute },
    ];
    const meta = buildStudyMetadata(images);
    expect(meta.localizerPresent).toBe(true);
    expect(meta.diagnosticImageCount).toBe(1);
    expect(meta.nonDiagnosticImageCount).toBe(1);
    expect(meta.perImageClassifications[1].is_localizer).toBe(true);
  });

  it("all-localizer → localizer-only, diagnosticImageCount 0", () => {
    const images = [
      { fileName: "loc1.jpg", classification: makeClassification({ is_localizer: true, diagnostic_value: "low" }), domainRoute: "spine-mri" as DomainRoute },
      { fileName: "loc2.jpg", classification: makeClassification({ is_localizer: true, diagnostic_value: "low" }), domainRoute: "spine-mri" as DomainRoute },
    ];
    const meta = buildStudyMetadata(images);
    expect(meta.studyAdequacy).toBe("localizer-only");
    expect(meta.diagnosticImageCount).toBe(0);
    expect(meta.nonDiagnosticImageCount).toBe(2);
  });
});

describe("selectDiagnosticImages", () => {
  it("filters out localizers and non-diagnostic", () => {
    const perImage = [
      { imageIndex: 0, fileName: "d1.jpg", modality: "MRI", anatomical_region: "Spine", domain_route: "spine-mri" as DomainRoute, image_plane: "sagittal" as const, is_localizer: false, diagnostic_value: "high" as const, series_type_guess: "T2", confidence: 80, limitations: [] },
      { imageIndex: 1, fileName: "loc.jpg", modality: "MRI", anatomical_region: "Spine", domain_route: "spine-mri" as DomainRoute, image_plane: "unknown" as const, is_localizer: true, diagnostic_value: "low" as const, series_type_guess: "", confidence: 50, limitations: [] },
      { imageIndex: 2, fileName: "d2.jpg", modality: "MRI", anatomical_region: "Spine", domain_route: "spine-mri" as DomainRoute, image_plane: "axial" as const, is_localizer: false, diagnostic_value: "medium" as const, series_type_guess: "T2", confidence: 75, limitations: [] },
    ];
    const selected = selectDiagnosticImages(perImage);
    expect(selected).toEqual([0, 2]);
  });
});

describe("parseStructuredReconciliation", () => {
  it("parses valid structured reconciliation JSON", () => {
    const raw = JSON.stringify({
      agreements: [
        { finding: "L4-L5 disc bulge", image_indices: [0, 1], confidence: "high" },
      ],
      disagreements: [],
      reinforcements: [
        { structure_or_level: "L4-L5", image_indices: [0, 1], evidence: "Sagittal and axial both show mild bulge" },
      ],
      weak_or_inconsistent: ["L5-S1 assessment limited to single plane"],
      summary: "Multi-plane correlation strengthens L4-L5 finding.",
    });
    const result = parseStructuredReconciliation(raw);
    expect(result).not.toBeNull();
    expect(result!.agreements).toHaveLength(1);
    expect(result!.agreements[0].finding).toBe("L4-L5 disc bulge");
    expect(result!.agreements[0].confidence).toBe("high");
    expect(result!.reinforcements).toHaveLength(1);
    expect(result!.reinforcements[0].structure_or_level).toBe("L4-L5");
    expect(result!.weak_or_inconsistent).toContain("L5-S1 assessment limited to single plane");
  });

  it("returns null for invalid JSON", () => {
    expect(parseStructuredReconciliation("not json")).toBeNull();
    expect(parseStructuredReconciliation("{}")).not.toBeNull();
  });
});

describe("getStructuredReconciliationPrompt", () => {
  it("returns empty string for fewer than 2 diagnostic images", () => {
    const studyMeta = {
      imageCount: 1,
      modality: "MRI",
      anatomicalRegion: "Spine",
      planesAvailable: ["sagittal"],
      localizerPresent: false,
      diagnosticImageCount: 1,
      nonDiagnosticImageCount: 0,
      studyAdequacy: "partial" as const,
      seriesGuesses: ["T2"],
      perImageClassifications: [],
    };
    const perImage = [
      { imageIndex: 0, fileName: "mri.jpg", image_plane: "sagittal", diagnostic_value: "high", series_type_guess: "T2", is_localizer: false, findings: "L4-L5 bulge", diagnosis: "Mild disc bulge", limitations: [] },
    ];
    const prompt = getStructuredReconciliationPrompt(studyMeta, perImage, "en");
    expect(prompt).toBe("");
  });

  it("returns prompt for 2+ diagnostic images", () => {
    const studyMeta = {
      imageCount: 2,
      modality: "MRI",
      anatomicalRegion: "Lumbar",
      planesAvailable: ["sagittal", "axial"],
      localizerPresent: false,
      diagnosticImageCount: 2,
      nonDiagnosticImageCount: 0,
      studyAdequacy: "diagnostic" as const,
      seriesGuesses: ["T2"],
      perImageClassifications: [],
    };
    const perImage = [
      { imageIndex: 0, fileName: "sag.jpg", image_plane: "sagittal", diagnostic_value: "high", series_type_guess: "T2", is_localizer: false, findings: "L4-L5 mild bulge", diagnosis: "Disc bulge", limitations: [] },
      { imageIndex: 1, fileName: "ax.jpg", image_plane: "axial", diagnostic_value: "high", series_type_guess: "T2", is_localizer: false, findings: "L4-L5 bilateral foraminal narrowing", diagnosis: "Stenosis", limitations: [] },
    ];
    const prompt = getStructuredReconciliationPrompt(studyMeta, perImage, "en");
    expect(prompt.length).toBeGreaterThan(100);
    expect(prompt).toContain("L4-L5 mild bulge");
    expect(prompt).toContain("L4-L5 bilateral foraminal narrowing");
  });
});
