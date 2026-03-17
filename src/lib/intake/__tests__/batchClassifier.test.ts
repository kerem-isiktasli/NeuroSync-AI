/**
 * Universal intake batch classifier tests.
 */
import { describe, it, expect } from "vitest";
import { classifyBatch } from "../batchClassifier";

function mockFile(name: string, mime: string) {
  return { fileName: name, mimeType: mime };
}

describe("classifyBatch", () => {
  it("1. empty batch → unknown", () => {
    const r = classifyBatch([]);
    expect(r.batchType).toBe("unknown");
    expect(r.pipeline).toBe("unsupported");
  });

  it("2. DICOM-only → dicom-study", () => {
    const r = classifyBatch([
      mockFile("slice1.dcm", "application/dicom"),
      mockFile("slice2.dcm", "application/dicom"),
    ]);
    expect(r.batchType).toBe("dicom-study");
    expect(r.pipeline).toBe("dicom-study");
  });

  it("3. PDF-only → report-only", () => {
    const r = classifyBatch([mockFile("report.pdf", "application/pdf")]);
    expect(r.batchType).toBe("report-only");
    expect(r.pipeline).toBe("report-only");
  });

  it("4. lab PDF filename → lab-only", () => {
    const r = classifyBatch([mockFile("blood_lab_results.pdf", "application/pdf")]);
    expect(r.batchType).toBe("lab-only");
    expect(r.pipeline).toBe("lab-only");
  });

  it("5. pathology PDF filename → pathology-only", () => {
    const r = classifyBatch([mockFile("biopsy_report.pdf", "application/pdf")]);
    expect(r.batchType).toBe("pathology-only");
    expect(r.pipeline).toBe("pathology-only");
  });

  it("6. image-only → image-study", () => {
    const r = classifyBatch([
      mockFile("mri1.png", "image/png"),
      mockFile("mri2.png", "image/png"),
    ]);
    expect(r.batchType).toBe("image-study");
    expect(r.pipeline).toBe("image-study");
  });

  it("7. PDF + images → mixed-image-report", () => {
    const r = classifyBatch([
      mockFile("report.pdf", "application/pdf"),
      mockFile("slice1.jpg", "image/jpeg"),
    ]);
    expect(r.batchType).toBe("mixed-image-report");
    expect(r.pipeline).toBe("mixed-image-report");
  });

  it("8. multiple PDFs → mixed-document-set", () => {
    const r = classifyBatch([
      mockFile("a.pdf", "application/pdf"),
      mockFile("b.pdf", "application/pdf"),
    ]);
    expect(r.batchType).toBe("mixed-document-set");
    expect(r.pipeline).toBe("mixed-document-set");
  });
});
