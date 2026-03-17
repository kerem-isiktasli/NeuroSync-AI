/**
 * DICOM Slice Renderer — Convert volume slice to viewable PNG for AI analysis.
 * Applies window/level normalization so structures are visible.
 */
import sharp from "sharp";
import type { VolumeOutput } from "./volumeBuilder";

const MAX_SIDE = 512;
const DEFAULT_WINDOW_WIDTH = 400;
const DEFAULT_WINDOW_CENTER = 40;

/**
 * Sample equidistant slice indices to preserve anatomical coverage.
 * Returns indices for: first, last, and evenly spaced middle slices.
 */
export function getAnatomicallyBalancedSliceIndices(
  totalSlices: number,
  maxSlices: number
): number[] {
  if (totalSlices <= maxSlices) {
    return Array.from({ length: totalSlices }, (_, i) => i);
  }
  const indices: number[] = [0];
  if (totalSlices > 1) indices.push(totalSlices - 1);
  const remaining = maxSlices - indices.length;
  if (remaining <= 0) return indices;
  const step = (totalSlices - 2) / (remaining + 1);
  for (let i = 1; i <= remaining; i++) {
    const idx = Math.round(step * i);
    if (idx > 0 && idx < totalSlices - 1 && !indices.includes(idx)) {
      indices.push(idx);
    }
  }
  return indices.sort((a, b) => a - b);
}

/**
 * Extract slice pixels from volume and apply window/level.
 */
function windowLevel(
  pixels: Float32Array,
  windowWidth: number,
  windowCenter: number
): Uint8Array {
  const out = new Uint8Array(pixels.length);
  const minVal = windowCenter - windowWidth / 2;
  const maxVal = windowCenter + windowWidth / 2;
  const range = maxVal - minVal || 1;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i]!;
    const normalized = (v - minVal) / range;
    out[i] = Math.max(0, Math.min(255, Math.round(normalized * 255)));
  }
  return out;
}

/**
 * Render a single slice from the volume to base64 PNG.
 */
export async function renderSliceToPng(params: {
  volume: VolumeOutput;
  sliceIndex: number;
  windowWidth?: number;
  windowCenter?: number;
  maxSide?: number;
}): Promise<string> {
  const {
    volume,
    sliceIndex,
    windowWidth = DEFAULT_WINDOW_WIDTH,
    windowCenter = DEFAULT_WINDOW_CENTER,
    maxSide = MAX_SIDE,
  } = params;

  const { width, height, volumeTensor } = volume;
  const sliceSize = width * height;
  const offset = sliceIndex * sliceSize;
  const slicePixels = volumeTensor.slice(offset, offset + sliceSize);

  const wl = windowLevel(
    slicePixels,
    windowWidth,
    windowCenter
  );

  let resizeW = width;
  let resizeH = height;
  if (width > maxSide || height > maxSide) {
    const ratio = maxSide / Math.max(width, height);
    resizeW = Math.round(width * ratio);
    resizeH = Math.round(height * ratio);
  }

  const jpegBuffer = await sharp(Buffer.from(wl), {
    raw: {
      width,
      height,
      channels: 1,
    },
  })
    .resize(resizeW, resizeH)
    .jpeg({ quality: 90 })
    .toBuffer();

  return jpegBuffer.toString("base64");
}
