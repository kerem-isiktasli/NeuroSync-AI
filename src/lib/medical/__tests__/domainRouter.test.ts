/**
 * Domain Router Tests — Verify correct routing for representative cases.
 */
import { describe, it, expect } from "vitest";
import { routeToDomain } from "../domainRouter";

describe("routeToDomain", () => {
  it("1. spine DICOM study → spine", () => {
    const r = routeToDomain({
      uploadType: "dicom-study",
      modality: "CT",
      anatomicalRegion: "L-SPINE",
      hasDicomStudy: true,
    });
    expect(r.domain).toBe("spine");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("2. brain image or MRI screenshot → brain", () => {
    const r = routeToDomain({
      uploadType: "diagnostic-image",
      modality: "MRI",
      anatomicalRegion: "Brain",
      hasDiagnosticImages: true,
    });
    expect(r.domain).toBe("brain");
  });

  it("3. chest CT or chest screenshot → chest", () => {
    const r = routeToDomain({
      uploadType: "diagnostic-image",
      modality: "CT",
      anatomicalRegion: "Chest",
      hasDiagnosticImages: true,
    });
    expect(r.domain).toBe("chest");
  });

  it("4. abdomen/pelvis study → abdomen-pelvis", () => {
    const r = routeToDomain({
      uploadType: "dicom-study",
      modality: "CT",
      anatomicalRegion: "Abdomen",
      hasDicomStudy: true,
    });
    expect(r.domain).toBe("abdomen-pelvis");
  });

  it("5. report screenshot → document-only when no diagnostic images", () => {
    const r = routeToDomain({
      uploadType: "report-image",
      hasReportDocuments: true,
      hasDiagnosticImages: false,
    });
    expect(r.domain).toBe("document-only");
  });

  it("6. PDF report → document-only when no images", () => {
    const r = routeToDomain({
      uploadType: "pdf-report",
      hasReportDocuments: true,
      hasDiagnosticImages: false,
    });
    expect(r.domain).toBe("document-only");
  });

  it("7. mixed image + report → mixed-fusion", () => {
    const r = routeToDomain({
      uploadType: "mixed",
      modality: "MRI",
      anatomicalRegion: "Lumbar",
      hasDiagnosticImages: true,
      hasReportDocuments: true,
    });
    expect(r.domain).toBe("mixed-fusion");
  });

  it("does NOT default to spine for brain", () => {
    const r = routeToDomain({
      uploadType: "dicom-study",
      modality: "MRI",
      anatomicalRegion: "Brain",
      hasDicomStudy: true,
    });
    expect(r.domain).not.toBe("spine");
    expect(r.domain).toBe("brain");
  });

  it("does NOT default to spine for chest", () => {
    const r = routeToDomain({
      uploadType: "diagnostic-image",
      modality: "CT",
      anatomicalRegion: "Thorax",
      hasDiagnosticImages: true,
    });
    expect(r.domain).not.toBe("spine");
    expect(r.domain).toBe("chest");
  });
});
