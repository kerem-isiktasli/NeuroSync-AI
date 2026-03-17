/**
 * DICOM Study Pipeline — RapiMed radiology AI pipeline.
 *
 * UPLOAD → DICOM STUDY INGESTION → SLICE ORDERING → SERIES GROUPING
 * → VOLUME RECONSTRUCTION → AI ANALYSIS → STRUCTURED RADIOLOGY REPORT
 */

export {
  parseDicomMetadata,
  isDicomBuffer,
  getStudyInstanceUIDFromBuffer,
  getStudyInstanceUIDFromFile,
  validateDicomBatch,
  MAX_DICOM_FILES,
  MAX_STUDY_SIZE_BYTES,
  type SliceMetadata,
} from "./dicomParser";

export {
  assembleStudy,
  type DICOMFile,
  type OrderedSlice,
  type AssembledStudy,
} from "./studyAssembler";

export {
  buildVolume,
  type VolumeOutput,
} from "./volumeBuilder";

export {
  mapAnatomy,
  type AnatomyMapping,
  type AnatomicalRegion,
  type VertebraRange,
} from "./anatomyMapper";

export {
  indexSlicesToVertebrae,
  type VertebraIndexMap,
  type VertebraLevel,
} from "./vertebraIndexing";

export {
  scanPathology,
  type PathologyScanResult,
  type SliceObservation,
  type PathologyType,
} from "./pathologyScanner";

export {
  buildRadiologyReport,
  type RadiologyReport,
  type VertebraFinding,
} from "./radiologyReportBuilder";
