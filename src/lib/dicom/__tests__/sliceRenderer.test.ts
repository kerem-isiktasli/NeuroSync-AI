import { describe, it, expect } from "vitest";
import { getAnatomicallyBalancedSliceIndices } from "../sliceRenderer";

describe("getAnatomicallyBalancedSliceIndices", () => {
  it("returns all indices when total <= max", () => {
    expect(getAnatomicallyBalancedSliceIndices(5, 10)).toEqual([0, 1, 2, 3, 4]);
    expect(getAnatomicallyBalancedSliceIndices(3, 3)).toEqual([0, 1, 2]);
  });

  it("includes first and last slice when sampling", () => {
    const indices = getAnatomicallyBalancedSliceIndices(27, 12);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(26);
    expect(indices.length).toBeLessThanOrEqual(12);
  });

  it("distributes middle slices evenly", () => {
    const indices = getAnatomicallyBalancedSliceIndices(100, 16);
    expect(indices).toContain(0);
    expect(indices).toContain(99);
    expect(indices.length).toBe(16);
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });
});
