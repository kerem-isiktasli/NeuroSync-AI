/**
 * Cloud Healthcare API — STUDY INGESTION (future).
 *
 * Config from env: HEALTHCARE_DATASET, HEALTHCARE_DICOM_STORE, GOOGLE_PROJECT_ID, GOOGLE_LOCATION
 *
 * Purpose: DICOMweb study access, study metadata, NOT diagnostic inference.
 * When implemented, use for:
 * - Fetching DICOM studies from Healthcare API DICOM store
 * - Parsing study/series metadata
 * - Passing retrieved images to Vertex for reasoning
 *
 * NOT for: running AI models, diagnosis, report generation.
 */

export const HEALTHCARE_CONFIG = {
  projectId: process.env.GOOGLE_PROJECT_ID || process.env.VERTEX_PROJECT_ID,
  location: process.env.GOOGLE_LOCATION || "us-central1",
  dataset: process.env.HEALTHCARE_DATASET || "NeuroSync",
  dicomStore: process.env.HEALTHCARE_DICOM_STORE || "rapimed-dicom",
} as const;

export type StudyMetadataFromHealthcare = {
  studyUid: string;
  seriesUids: string[];
  modality?: string;
  bodyPart?: string;
  /** URLs or base64 from DICOMweb RetrieveRendered. */
  imageRefs: string[];
};

/**
 * Stub: Fetch study metadata and image refs from Cloud Healthcare API DICOMweb.
 * Returns null until implemented.
 */
export async function fetchStudyFromHealthcareApi(
  _dicomStorePath: string,
  _studyUid: string
): Promise<StudyMetadataFromHealthcare | null> {
  // Future: use @google-cloud/healthcare or REST DICOMweb APIs
  return null;
}
