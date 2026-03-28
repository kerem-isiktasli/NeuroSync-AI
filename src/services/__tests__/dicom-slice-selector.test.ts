import { describe, it, expect } from "vitest";
import {
  getSelectionTarget,
  getLargeStudyThreshold,
  selectVarianceStratifiedSliceIndices,
} from "../dicom-slice-selector";
import type { VolumeOutput } from "@/lib/dicom/volumeBuilder";

function mockVolume(depth: number): VolumeOutput {
  const w = 4;
  const h = 4;
  const volumeTensor = new Float32Array(w * h * depth);
  for (let z = 0; z < depth; z++) {
    for (let i = 0; i < w * h; i++) {
      volumeTensor[z * w * h + i] = z * 10 + (i % 3);
    }
  }
  return {
    width: w,
    height: h,
    depth,
    volumeTensor,
    voxelSpacing: [1, 1, 1] as [number, number, number],
  };
}

describe("getSelectionTarget", () => {
  it("returns all slices for small studies", () => {
    expect(getSelectionTarget(30)).toBe(30);
    expect(getSelectionTarget(59)).toBe(59);
  });

  it("uses proportional cap for medium studies", () => {
    const t = getSelectionTarget(100);
    expect(t).toBeGreaterThan(0);
    expect(t).toBeLessThanOrEqual(90);
    expect(t).toBeLessThan(100);
  });
});

describe("selectVarianceStratifiedSliceIndices", () => {
  it("returns all indices when under cap", () => {
    const v = mockVolume(10);
    const { indices, strategy } = selectVarianceStratifiedSliceIndices(v, 10, 20);
    expect(strategy).toBe("all");
    expect(indices).toEqual(Array.from({ length: 10 }, (_, i) => i));
  });

  it("returns at most maxSlices distinct indices", () => {
    const v = mockVolume(40);
    const maxSlices = 12;
    const { indices, strategy } = selectVarianceStratifiedSliceIndices(
      v,
      40,
      maxSlices
    );
    expect(strategy.startsWith("variance-stratified")).toBe(true);
    expect(indices.length).toBeLessThanOrEqual(maxSlices);
    const uniq = new Set(indices);
    expect(uniq.size).toBe(indices.length);
  });
});

describe("getLargeStudyThreshold", () => {
  it("returns a positive default", () => {
    expect(getLargeStudyThreshold()).toBeGreaterThanOrEqual(1);
  });
});
