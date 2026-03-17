/**
 * Vertebra Indexing — Map slices to vertebral levels (C1, C2, …).
 * Uses spatial spacing to interpolate missing levels.
 */
import type { OrderedSlice } from "./studyAssembler";
import type { VertebraRange } from "./anatomyMapper";

export type VertebraLevel = string;

export interface VertebraIndexMap {
  [level: string]: number;
}

const CERVICAL_LEVELS = ["C1", "C2", "C3", "C4", "C5", "C6", "C7"];
const THORACIC_LEVELS = [
  "T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12",
];
const LUMBAR_LEVELS = ["L1", "L2", "L3", "L4", "L5"];
const SACRAL_LEVELS = ["S1", "S2", "S3", "S4", "S5"];

function getLevelsForRange(range: VertebraRange | null): VertebraLevel[] {
  if (!range) return [];
  const { start, end } = range;
  if (start.startsWith("C") && end.startsWith("C")) {
    const si = CERVICAL_LEVELS.indexOf(start);
    const ei = CERVICAL_LEVELS.indexOf(end);
    return CERVICAL_LEVELS.slice(Math.max(0, si), ei + 1);
  }
  if (start.startsWith("T") && end.startsWith("T")) {
    const si = THORACIC_LEVELS.indexOf(start);
    const ei = THORACIC_LEVELS.indexOf(end);
    return THORACIC_LEVELS.slice(Math.max(0, si), ei + 1);
  }
  if (start.startsWith("L") && end.startsWith("L")) {
    const si = LUMBAR_LEVELS.indexOf(start);
    const ei = LUMBAR_LEVELS.indexOf(end);
    return LUMBAR_LEVELS.slice(Math.max(0, si), ei + 1);
  }
  if (start.startsWith("T") && end.startsWith("L")) {
    return [...THORACIC_LEVELS, ...LUMBAR_LEVELS];
  }
  if (start.startsWith("S") && end.startsWith("S")) {
    const si = SACRAL_LEVELS.indexOf(start);
    const ei = SACRAL_LEVELS.indexOf(end);
    return SACRAL_LEVELS.slice(Math.max(0, si), ei + 1);
  }
  return [];
}

/**
 * Map slice indices to vertebral levels using linear interpolation.
 * Slice 0 = most inferior (e.g. C7 for c-spine), last = most superior (C1).
 * Or vice versa depending on acquisition direction. We use sliceLocation for ordering.
 */
export function indexSlicesToVertebrae(
  slices: OrderedSlice[],
  vertebraRange: VertebraRange | null
): VertebraIndexMap {
  const levels = getLevelsForRange(vertebraRange);
  const map: VertebraIndexMap = {};

  if (slices.length === 0 || levels.length === 0) {
    return map;
  }

  // Slice locations (z) - may increase or decrease
  const zValues = slices.map((s) => s.metadata.sliceLocation);
  const zMin = Math.min(...zValues);
  const zMax = Math.max(...zValues);
  const zSpan = zMax - zMin || 1;

  // Normalize slice index to [0, 1] along the range
  for (let i = 0; i < slices.length; i++) {
    const z = zValues[i]!;
    const t = (z - zMin) / zSpan;
    const levelIndex = Math.round(t * (levels.length - 1));
    const levelIndexClamped = Math.max(0, Math.min(levelIndex, levels.length - 1));
    const level = levels[levelIndexClamped]!;
    if (!map[level] || map[level]! > i) {
      map[level] = i;
    }
  }

  // Interpolate missing levels
  const sortedByZ = slices
    .map((s, i) => ({ i, z: s.metadata.sliceLocation }))
    .sort((a, b) => a.z - b.z);

  for (let l = 0; l < levels.length; l++) {
    const level = levels[l]!;
    if (map[level] !== undefined) continue;

    const t = l / (levels.length - 1 || 1);
    const zTarget = zMin + t * zSpan;

    let bestIdx = 0;
    let bestDist = Infinity;
    for (const { i, z } of sortedByZ) {
      const d = Math.abs(z - zTarget);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    map[level] = bestIdx;
  }

  return map;
}
