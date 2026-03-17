/**
 * DICOM Parser — Extract metadata from DICOM Part 10 byte streams.
 * Used by studyAssembler for slice ordering and series grouping.
 */
import { parseDicom, type DataSet } from "dicom-parser";

/** DICOM tag constants (format xGGGGEEEE) */
const TAGS = {
  studyInstanceUID: "x0020000d",
  seriesInstanceUID: "x0020000e",
  instanceNumber: "x00200013",
  imagePositionPatient: "x00200032",
  imageOrientationPatient: "x00200037",
  sliceLocation: "x00201041",
  modality: "x00080060",
  bodyPartExamined: "x00180015",
  seriesDescription: "x0008103e",
  rows: "x00280010",
  columns: "x00280011",
  pixelSpacing: "x00280030",
  sliceThickness: "x00180050",
  spacingBetweenSlices: "x00180088",
  bitsAllocated: "x00280100",
  bitsStored: "x00280101",
  samplesPerPixel: "x00280002",
  pixelRepresentation: "x00280103",
} as const;

export interface SliceMetadata {
  studyInstanceUID: string;
  seriesInstanceUID: string;
  instanceNumber: number;
  imagePositionPatient: [number, number, number];
  imageOrientationPatient: [number, number, number, number, number, number];
  sliceLocation: number;
  modality?: string;
  bodyPartExamined?: string;
  seriesDescription?: string;
  rows?: number;
  columns?: number;
  pixelSpacing?: [number, number];
  sliceThickness?: number;
  spacingBetweenSlices?: number;
  /** Raw buffer for pixel data extraction (optional, for volume building) */
  pixelDataOffset?: number;
  pixelDataLength?: number;
  bitsAllocated?: number;
  bitsStored?: number;
  samplesPerPixel?: number;
  pixelRepresentation?: number;
}

function parseDSArray(value: string | undefined): number[] {
  if (!value || typeof value !== "string") return [];
  return value
    .split("\\")
    .map((s) => parseFloat(s.trim()))
    .filter((n) => !Number.isNaN(n));
}

function getFloatArray(ds: DataSet, tag: string, minLen: number): number[] {
  const raw = ds.string(tag);
  const arr = parseDSArray(raw);
  return arr.length >= minLen ? arr.slice(0, minLen) : [];
}

/**
 * Parse DICOM metadata from a buffer/byte array.
 * Returns structured slice metadata for study assembly.
 * @throws if the buffer is not valid DICOM Part 10.
 */
export function parseDicomMetadata(buffer: Buffer | Uint8Array): SliceMetadata {
  const byteArray =
    buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const dataSet = parseDicom(byteArray);

  const studyUID = dataSet.string(TAGS.studyInstanceUID) ?? "";
  const seriesUID = dataSet.string(TAGS.seriesInstanceUID) ?? "";
  const instanceNum = dataSet.intString(TAGS.instanceNumber) ?? 0;

  const ipp = getFloatArray(dataSet, TAGS.imagePositionPatient, 3) as [
    number,
    number,
    number
  ];
  const iop = getFloatArray(dataSet, TAGS.imageOrientationPatient, 6) as [
    number,
    number,
    number,
    number,
    number,
    number
  ];
  const sliceLocArr = getFloatArray(dataSet, TAGS.sliceLocation, 1);
  const sliceLocation = sliceLocArr[0] ?? (ipp.length >= 3 ? ipp[2] : 0);

  const ps = getFloatArray(dataSet, TAGS.pixelSpacing, 2) as [
    number,
    number
  ] | [];

  return {
    studyInstanceUID: studyUID,
    seriesInstanceUID: seriesUID,
    instanceNumber: instanceNum,
    imagePositionPatient:
      ipp.length === 3 ? ipp : ([0, 0, 0] as [number, number, number]),
    imageOrientationPatient:
      iop.length === 6 ? iop : ([1, 0, 0, 0, 1, 0] as [number, number, number, number, number, number]),
    sliceLocation,
    modality: dataSet.string(TAGS.modality) ?? undefined,
    bodyPartExamined: dataSet.string(TAGS.bodyPartExamined) ?? undefined,
    seriesDescription: dataSet.string(TAGS.seriesDescription) ?? undefined,
    rows: dataSet.uint16(TAGS.rows),
    columns: dataSet.uint16(TAGS.columns),
    pixelSpacing: ps.length === 2 ? ps : undefined,
    sliceThickness: dataSet.floatString(TAGS.sliceThickness),
    spacingBetweenSlices: dataSet.floatString(TAGS.spacingBetweenSlices),
    pixelDataOffset: dataSet.elements["x7fe00010"]?.dataOffset,
    pixelDataLength: dataSet.elements["x7fe00010"]?.length,
    bitsAllocated: dataSet.uint16(TAGS.bitsAllocated),
    bitsStored: dataSet.uint16(TAGS.bitsStored),
    samplesPerPixel: dataSet.uint16(TAGS.samplesPerPixel),
    pixelRepresentation: dataSet.uint16(TAGS.pixelRepresentation),
  };
}

/**
 * Extract StudyInstanceUID from a buffer (lightweight parse, stops before pixel data).
 * Returns null if not valid DICOM or tag missing.
 */
export function getStudyInstanceUIDFromBuffer(
  buffer: ArrayBuffer | Uint8Array
): string | null {
  try {
    const byteArray =
      buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const dataSet = parseDicom(byteArray, { untilTag: "x0020000e" });
    return dataSet.string(TAGS.studyInstanceUID) ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract StudyInstanceUID from a File (for client-side validation).
 */
export async function getStudyInstanceUIDFromFile(
  file: File
): Promise<string | null> {
  const buf = await file.arrayBuffer();
  return getStudyInstanceUIDFromBuffer(buf);
}

function looksLikeDicom(file: File): boolean {
  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  return (
    name.endsWith(".dcm") ||
    name.endsWith(".dicom") ||
    type.includes("dicom") ||
    type.includes("application/octet-stream")
  );
}

/** Max files per study. */
export const MAX_DICOM_FILES = 500;

/** Max total study size (1GB). */
export const MAX_STUDY_SIZE_BYTES = 1024 * 1024 * 1024;

/**
 * Validate DICOM file batch: 1-500 files, max 1GB total, identical StudyInstanceUID, no mixed studies.
 * Preserves file order. Throws on validation failure.
 */
export async function validateDicomBatch(files: File[]): Promise<void> {
  if (files.length === 0) {
    throw new Error("No files provided.");
  }
  if (files.length > MAX_DICOM_FILES) {
    throw new Error(`Maximum ${MAX_DICOM_FILES} files supported.`);
  }
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBytes > MAX_STUDY_SIZE_BYTES) {
    const gb = (MAX_STUDY_SIZE_BYTES / (1024 * 1024 * 1024)).toFixed(1);
    throw new Error(`Study size ${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)}GB exceeds maximum ${gb}GB.`);
  }
  const dicomFiles = files.filter(looksLikeDicom);
  if (dicomFiles.length === 0) return;
  if (dicomFiles.length !== files.length) {
    throw new Error("Cannot mix DICOM and non-DICOM files in one upload.");
  }
  if (dicomFiles.length >= 2) {
    const uids = await Promise.all(
      dicomFiles.map((f) => getStudyInstanceUIDFromFile(f))
    );
    const unique = new Set(uids.filter((u): u is string => !!u));
    if (unique.size > 1) {
      throw new Error("Mixed studies not supported");
    }
  }
}

/**
 * Check if a buffer looks like DICOM Part 10 (starts with DICM).
 */
export function isDicomBuffer(buffer: Buffer | Uint8Array): boolean {
  if (buffer.length < 132) return false;
  const preamble = buffer.slice(128, 132);
  return (
    preamble[0] === 0x44 &&
    preamble[1] === 0x49 &&
    preamble[2] === 0x43 &&
    preamble[3] === 0x4d
  );
}
