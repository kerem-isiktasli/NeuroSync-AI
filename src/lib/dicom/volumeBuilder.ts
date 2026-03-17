/**
 * Volume Builder — Convert ordered DICOM slices into a 3D volume tensor.
 * Depth equals number of slices.
 */
import { parseDicom } from "dicom-parser";
import type { OrderedSlice } from "./studyAssembler";

export interface VolumeOutput {
  width: number;
  height: number;
  depth: number;
  voxelSpacing: [number, number, number];
  volumeTensor: Float32Array;
}

function extractSlicePixels(
  buffer: Buffer | Uint8Array,
  rows: number,
  columns: number,
  bitsAllocated: number,
  pixelRepresentation: number
): Float32Array {
  const byteArray =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const dataSet = parseDicom(byteArray);
  const pixelEl = dataSet.elements["x7fe00010"];
  if (!pixelEl?.dataOffset || !pixelEl.length) {
    return new Float32Array(rows * columns).fill(0);
  }

  const numPixels = rows * columns;
  const out = new Float32Array(numPixels);

  if (bitsAllocated === 8) {
    for (let i = 0; i < numPixels; i++) {
      const v = byteArray[pixelEl.dataOffset + i] ?? 0;
      out[i] = pixelRepresentation === 1 ? (v << 24) >> 24 : v;
    }
  } else if (bitsAllocated === 16) {
    for (let i = 0; i < numPixels; i++) {
      const o = pixelEl.dataOffset + i * 2;
      const lo = byteArray[o] ?? 0;
      const hi = byteArray[o + 1] ?? 0;
      const v = lo | (hi << 8);
      out[i] =
        pixelRepresentation === 1 ? (v > 32767 ? v - 65536 : v) : v;
    }
  } else {
    out.fill(0);
  }
  return out;
}

/**
 * Compute slice spacing from ImagePositionPatient along the slice normal.
 */
function computeSliceSpacing(slices: OrderedSlice[]): number {
  if (slices.length < 2) return 1;
  const a = slices[0]!.metadata.imagePositionPatient[2] ?? 0;
  const b = slices[1]!.metadata.imagePositionPatient[2] ?? 0;
  return Math.abs(b - a) || 1;
}

/**
 * Build a 3D volume from ordered DICOM slices.
 * Volume layout: [z][y][x] flattened as depth * height * width.
 */
export function buildVolume(slices: OrderedSlice[]): VolumeOutput {
  if (slices.length === 0) {
    throw new Error("No slices provided for volume building");
  }

  const first = slices[0]!.metadata;
  const rows = first.rows ?? 512;
  const columns = first.columns ?? 512;
  const depth = slices.length;
  const bitsAllocated = first.bitsAllocated ?? 16;
  const pixelRepresentation = first.pixelRepresentation ?? 0;

  const sliceSpacing = computeSliceSpacing(slices);
  const [rowSpacing = 1, colSpacing = 1] = first.pixelSpacing ?? [1, 1];
  const voxelSpacing: [number, number, number] = [
    colSpacing,
    rowSpacing,
    sliceSpacing,
  ];

  const totalSize = depth * rows * columns;
  const volumeTensor = new Float32Array(totalSize);

  for (let z = 0; z < depth; z++) {
    const slice = slices[z];
    if (!slice) continue;

    let pixels: Float32Array;
    try {
      pixels = extractSlicePixels(
        slice.buffer,
        rows,
        columns,
        bitsAllocated,
        pixelRepresentation
      );
    } catch {
      pixels = new Float32Array(rows * columns).fill(0);
    }

    const base = z * rows * columns;
    for (let i = 0; i < pixels.length; i++) {
      volumeTensor[base + i] = pixels[i];
    }
  }

  return {
    width: columns,
    height: rows,
    depth,
    voxelSpacing,
    volumeTensor,
  };
}
