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
 * - Selects the study with the most slices, then the largest series within it (or throws if no valid DICOM)
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

  type ParsedEntry = (typeof parsed)[number];
  const studyMap = new Map<string, Map<string, ParsedEntry[]>>();
  for (const p of parsed) {
    const suid = p.metadata.studyInstanceUID;
    const serid = p.metadata.seriesInstanceUID;
    if (!studyMap.has(suid)) studyMap.set(suid, new Map());
    const seriesMap = studyMap.get(suid)!;
    if (!seriesMap.has(serid)) seriesMap.set(serid, []);
    seriesMap.get(serid)!.push(p);
  }

  let bestStudyUID = "";
  let bestStudySize = 0;
  for (const [sid, seriesMap] of studyMap) {
    const total = [...seriesMap.values()].reduce((s, v) => s + v.length, 0);
    if (total > bestStudySize) {
      bestStudySize = total;
      bestStudyUID = sid;
    }
  }

  const bestStudySeriesMap = studyMap.get(bestStudyUID)!;
  let bestSeriesUID = "";
  let bestSeriesSize = 0;
  for (const [serid, slices] of bestStudySeriesMap) {
    if (slices.length > bestSeriesSize) {
      bestSeriesSize = slices.length;
      bestSeriesUID = serid;
    }
  }

  const sameSeries = bestStudySeriesMap.get(bestSeriesUID)!;
  const studyUID = bestStudyUID;
  const seriesUID = bestSeriesUID;
  const modality = sameSeries[0]!.metadata.modality ?? "CT";

  const allSeriesSizes = [...bestStudySeriesMap.entries()]
    .map(([id, slices]) => `${id.slice(-6)}: ${slices.length} slices`)
    .join(", ");
  console.log(
    `[assembleStudy] Selected series ${seriesUID.slice(-6)} ` +
      `(${bestSeriesSize} slices). All series: [${allSeriesSizes}]`
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
