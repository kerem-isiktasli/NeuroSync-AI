/**
 * Universal Intake Tests — Verify classification resolution.
 */
import { describe, it, expect } from "vitest";
import {
  resolveUploadType,
  resolveDocumentTypeGuess,
} from "../universalIntake";

describe("resolveUploadType", () => {
  it("resolves dicom-study", () => {
    expect(resolveUploadType("dicom-study")).toBe("dicom-study");
    expect(resolveUploadType("DICOM study")).toBe("dicom-study");
  });

  it("resolves pdf-report", () => {
    expect(resolveUploadType("pdf-report")).toBe("pdf-report");
    expect(resolveUploadType("PDF report")).toBe("pdf-report");
  });

  it("resolves report-image", () => {
    expect(resolveUploadType("report-image")).toBe("report-image");
    expect(resolveUploadType("report")).toBe("report-image");
  });

  it("resolves diagnostic-image", () => {
    expect(resolveUploadType("diagnostic-image")).toBe("diagnostic-image");
  });

  it("resolves pathology-lab-document", () => {
    expect(resolveUploadType("pathology-lab-document")).toBe(
      "pathology-lab-document"
    );
    expect(resolveUploadType("pathology")).toBe("pathology-lab-document");
  });
});

describe("resolveDocumentTypeGuess", () => {
  it("resolves radiology-report", () => {
    expect(resolveDocumentTypeGuess("radiology")).toBe("radiology-report");
  });

  it("resolves pathology-report", () => {
    expect(resolveDocumentTypeGuess("pathology report")).toBe(
      "pathology-report"
    );
  });

  it("resolves lab-report", () => {
    expect(resolveDocumentTypeGuess("lab results")).toBe("lab-report");
  });
});
