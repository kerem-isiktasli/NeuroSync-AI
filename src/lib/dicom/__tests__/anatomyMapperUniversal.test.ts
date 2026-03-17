/**
 * Universal Anatomy Mapper Tests — Verify region + isSpine.
 */
import { describe, it, expect } from "vitest";
import { mapAnatomyUniversal } from "../anatomyMapperUniversal";

describe("mapAnatomyUniversal", () => {
  it("1. spine DICOM (lumbar) → L-SPINE, isSpine true", () => {
    const a = mapAnatomyUniversal({
      modality: "CT",
      seriesDescription: "Lumbar Spine",
      bodyPartExamined: "Lumbar",
    });
    expect(a.region).toBe("L-SPINE");
    expect(a.isSpine).toBe(true);
    expect(a.vertebraRange).toEqual({ start: "L1", end: "L5" });
  });

  it("2. brain MRI → BRAIN, isSpine false", () => {
    const a = mapAnatomyUniversal({
      modality: "MRI",
      seriesDescription: "Brain",
      bodyPartExamined: "Head",
    });
    expect(a.region).toBe("BRAIN");
    expect(a.isSpine).toBe(false);
    expect(a.vertebraRange).toBeNull();
  });

  it("3. chest CT (non-spine) → CHEST, isSpine false", () => {
    const a = mapAnatomyUniversal({
      modality: "CT",
      seriesDescription: "Chest",
      bodyPartExamined: "Chest",
    });
    expect(a.region).toBe("CHEST");
    expect(a.isSpine).toBe(false);
    expect(a.vertebraRange).toBeNull();
  });

  it("4. abdomen study → ABDOMEN, isSpine false", () => {
    const a = mapAnatomyUniversal({
      modality: "CT",
      seriesDescription: "Abdomen",
      bodyPartExamined: "Abdomen",
    });
    expect(a.region).toBe("ABDOMEN");
    expect(a.isSpine).toBe(false);
  });

  it("5. thoracic spine (T-spine) → T-SPINE, isSpine true", () => {
    const a = mapAnatomyUniversal({
      modality: "CT",
      seriesDescription: "Thoracic Spine",
      bodyPartExamined: "Spine",
    });
    expect(a.region).toBe("T-SPINE");
    expect(a.isSpine).toBe(true);
    expect(a.vertebraRange).toEqual({ start: "T1", end: "T12" });
  });

  it("6. cervical spine → C-SPINE, isSpine true", () => {
    const a = mapAnatomyUniversal({
      modality: "MRI",
      seriesDescription: "C-Spine",
      bodyPartExamined: "Neck",
    });
    expect(a.region).toBe("C-SPINE");
    expect(a.isSpine).toBe(true);
    expect(a.vertebraRange).toEqual({ start: "C1", end: "C7" });
  });
});
