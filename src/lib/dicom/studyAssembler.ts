/**
 * Study Assembler — Group DICOM slices by study/series and sort them.
 * Consumes output from dicomParser and produces ordered study objects.
 */
import {
  parseDicomMetadata,
  type SliceMetadata,
} from "./dicomParser";

export interface DICOMFile {
  buffer: Buffer | Uint8Array;
  fileName?: string;
}

export interface OrderedSlice {
  metadata: SliceMetadata;
  buffer: Buffer | Uint8Array;
  fileName?: string;
  sortIndex: number;
}

export interface AssembledStudy {
  studyUID: string;
  seriesUID: string;
  modality: string;
  sliceCount: number;
  orderedSlices: OrderedSlice[];
}

/**
 * Sort slices by priority: InstanceNumber → SliceLocation → ImagePositionPatient (z).
 */
function compareSlices(a: { metadata: SliceMetadata }, b: { metadata: SliceMetadata }): number {
  const ma = a.metadata;
  const mb = b.metadata;

  if (ma.instanceNumber !== mb.instanceNumber) {
    return ma.instanceNumber - mb.instanceNumber;
  }
  if (ma.sliceLocation !== mb.sliceLocation) {
    return ma.sliceLocation - mb.sliceLocation;
  }
  const za = ma.imagePositionPatient[2] ?? 0;
  const zb = mb.imagePositionPatient[2] ?? 0;
  return za - zb;
}

/**
 * Parse and validate a single DICOM file. Returns null if parse fails.
 */
function parseSingle(buf: Buffer | Uint8Array): SliceMetadata | null {
  try {
    return parseDicomMetadata(buf);
  } catch {
    return null;
  }
}

/**
 * Assemble an array of DICOM files into a study object.
 * - Groups by StudyInstanceUID and SeriesInstanceUID
 * - Sorts slices by InstanceNumber, SliceLocation, ImagePositionPatient
 * - Returns the first study/series (or throws if no valid DICOM)
 */
export function assembleStudy(files: DICOMFile[]): AssembledStudy {
  const parsed: Array<{ metadata: SliceMetadata; file: DICOMFile }> = [];

  for (const file of files) {
    const buf = file.buffer;
    const metadata = parseSingle(buf);
    if (!metadata?.studyInstanceUID || !metadata?.seriesInstanceUID) continue;
    parsed.push({ metadata, file });
  }

  if (parsed.length === 0) {
    throw new Error("No valid DICOM slices could be parsed from the provided files.");
  }

  // Use first slice for study/series UIDs; group by Study+Series
  const first = parsed[0]!;
  const studyUID = first.metadata.studyInstanceUID;
  const seriesUID = first.metadata.seriesInstanceUID;
  const modality = first.metadata.modality ?? "CT";

  // Keep only same study+series
  const sameSeries = parsed.filter(
    (p) =>
      p.metadata.studyInstanceUID === studyUID &&
      p.metadata.seriesInstanceUID === seriesUID
  );

  // Sort
  sameSeries.sort((a, b) => compareSlices(a, b));

  const orderedSlices: OrderedSlice[] = sameSeries.map((p, i) => ({
    metadata: p.metadata,
    buffer: p.file.buffer,
    fileName: p.file.fileName,
    sortIndex: i,
  }));

  return {
    studyUID,
    seriesUID,
    modality,
    sliceCount: orderedSlices.length,
    orderedSlices,
  };
}
