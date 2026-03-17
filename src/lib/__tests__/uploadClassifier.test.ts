/**
 * Upload Classifier Tests — Verify correct pipeline routing.
 */
import { describe, it, expect, vi } from "vitest";
import { classifyUploadBatch } from "../uploadClassifier";

function mockFile(name: string, type: string, size = 1000): File {
  return {
    name,
    type,
    size,
    lastModified: 0,
    webkitRelativePath: "",
    arrayBuffer: vi.fn(),
    slice: vi.fn(),
    stream: vi.fn(),
    text: vi.fn(),
  } as unknown as File;
}

describe("classifyUploadBatch", () => {
  it("1. single jpg → image-batch", () => {
    const f = mockFile("scan.jpg", "image/jpeg");
    expect(classifyUploadBatch([f])).toBe("image-batch");
  });

  it("2. multiple jpg/png → image-batch", () => {
    const files = [
      mockFile("a.jpg", "image/jpeg"),
      mockFile("b.png", "image/png"),
      mockFile("c.jpeg", "image/jpeg"),
    ];
    expect(classifyUploadBatch(files)).toBe("image-batch");
  });

  it("3. single real DICOM (.dcm) → dicom-study", () => {
    const f = mockFile("slice.dcm", "application/octet-stream");
    expect(classifyUploadBatch([f])).toBe("dicom-study");
  });

  it("4. multiple real DICOM → dicom-study", () => {
    const files = [
      mockFile("1.dcm", "application/dicom"),
      mockFile("2.dcm", "application/dicom"),
    ];
    expect(classifyUploadBatch(files)).toBe("dicom-study");
  });

  it("5. jpg with application/octet-stream → image-batch (NOT dicom)", () => {
    const f = mockFile("photo.jpg", "application/octet-stream");
    expect(classifyUploadBatch([f])).toBe("image-batch");
  });

  it("6. multiple jpg with empty MIME → image-batch (NOT dicom)", () => {
    const files = [
      mockFile("a.jpg", ""),
      mockFile("b.jpg", ""),
    ];
    expect(classifyUploadBatch(files)).toBe("image-batch");
  });

  it("7. PDF → pdf-report", () => {
    const f = mockFile("report.pdf", "application/pdf");
    expect(classifyUploadBatch([f])).toBe("pdf-report");
  });

  it("8. mixed image + report → mixed", () => {
    const files = [
      mockFile("mri.jpg", "image/jpeg"),
      mockFile("report.pdf", "application/pdf"),
    ];
    expect(classifyUploadBatch(files)).toBe("mixed");
  });

  it("9. mixed DICOM + image → mixed", () => {
    const files = [
      mockFile("slice.dcm", "application/dicom"),
      mockFile("photo.jpg", "image/jpeg"),
    ];
    expect(classifyUploadBatch(files)).toBe("mixed");
  });
});
