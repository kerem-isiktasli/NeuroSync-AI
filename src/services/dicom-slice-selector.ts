/**
 * DICOM slice selection for AI analysis — target counts and variance-stratified sampling.
 * Aligns with large-study guidance: prefer informative slices across superior/mid/inferior thirds.
 */
import type { VolumeOutput } from "@/lib/dicom/volumeBuilder";

function parseIntEnv(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Studies with fewer slices than this analyze every slice (subject to hard cap). */
export function getLargeStudyThreshold(): number {
  return parseIntEnv("LARGE_STUDY_THRESHOLD", 60);
}

/**
 * How many slices to send through Vertex for image analysis.
 * - Below threshold: all slices (up to env hard cap)
 * - 60–150: ~50% of volume, capped at 90
 * - Above 150: 90 (quota / latency tradeoff)
 */
export function getSelectionTarget(totalSlices: number): number {
  if (totalSlices <= 0) return 0;
  const hardCap = parseIntEnv("MAX_DICOM_SLICES_ANALYZED", 90);
  const cap = Math.min(Math.max(hardCap, 1), 200);
  const t = getLargeStudyThreshold();
  if (totalSlices < t) return Math.min(totalSlices, cap);
  if (totalSlices <= 150) {
    return Math.min(Math.max(Math.round(totalSlices * 0.5), 1), 90, cap, totalSlices);
  }
  return Math.min(90, cap, totalSlices);
}

export function computeSlicePixelVariance(
  volume: VolumeOutput,
  sliceIndex: number
): number {
  const { width, height, volumeTensor } = volume;
  const sliceSize = width * height;
  const offset = sliceIndex * sliceSize;
  if (offset + sliceSize > volumeTensor.length) return 0;
  const pixels = volumeTensor.subarray(offset, offset + sliceSize);
  let sum = 0;
  for (let i = 0; i < pixels.length; i++) sum += pixels[i]!;
  const mean = pixels.length > 0 ? sum / pixels.length : 0;
  let acc = 0;
  for (let i = 0; i < pixels.length; i++) {
    const d = pixels[i]! - mean;
    acc += d * d;
  }
  return pixels.length > 0 ? acc / pixels.length : 0;
}

export function selectVarianceStratifiedSliceIndices(
  volume: VolumeOutput,
  totalSlices: number,
  maxSlices: number
): { indices: number[]; strategy: string } {
  if (totalSlices <= 0) return { indices: [], strategy: "empty" };
  if (totalSlices <= maxSlices) {
    return {
      indices: Array.from({ length: totalSlices }, (_, i) => i),
      strategy: "all",
    };
  }

  type Entry = { index: number; variance: number };
  const withVar: Entry[] = Array.from({ length: totalSlices }, (_, i) => ({
    index: i,
    variance: computeSlicePixelVariance(volume, i),
  }));

  const third = Math.max(1, Math.floor(totalSlices / 3));
  const topSlices = withVar.slice(0, third);
  const midSlices = withVar.slice(third, third * 2);
  const botSlices = withVar.slice(third * 2);

  const topCount = Math.round(maxSlices * 0.2);
  const midCount = Math.round(maxSlices * 0.6);
  const botCount = Math.max(0, maxSlices - topCount - midCount);

  function topNByVariance(arr: Entry[], n: number): number[] {
    if (n <= 0 || arr.length === 0) return [];
    return [...arr]
      .sort((a, b) => b.variance - a.variance)
      .slice(0, Math.min(n, arr.length))
      .map((x) => x.index);
  }

  const selected = new Set<number>([
    ...topNByVariance(topSlices, topCount),
    ...topNByVariance(midSlices, midCount),
    ...topNByVariance(botSlices, botCount),
  ]);

  const indices = [...selected].sort((a, b) => a - b);
  return {
    indices,
    strategy: `variance-stratified (${indices.length}/${totalSlices})`,
  };
}
