/**
 * Deterministic ontology registries for routing and storage hints (not model-improvised).
 * Expand these using curated sources at build/offline time—not live Google/Scholar/PubMed during patient requests.
 * DICOM: modality truth. FHIR: resource family separation. RSNA: report structure vocabulary.
 */

/** DICOM Modality standard values (PS3.3 C.7.3.1.1.1) — uppercase routing truth. */
export const DICOM_MODALITY_CODES = new Set([
  "AR",
  "ASMT",
  "AU",
  "BDUS",
  "BI",
  "BMD",
  "CR",
  "CT",
  "DG",
  "DOC",
  "DX",
  "ECG",
  "EPS",
  "ES",
  "FID",
  "GM",
  "HC",
  "HD",
  "IO",
  "IOL",
  "IVOCT",
  "IVUS",
  "KER",
  "KO",
  "LEN",
  "LS",
  "MG",
  "MR",
  "NM",
  "OAM",
  "OCT",
  "OP",
  "OPM",
  "OPT",
  "OPV",
  "OSS",
  "OT",
  "PLAN",
  "PR",
  "PT",
  "PX",
  "REG",
  "RESP",
  "RF",
  "RG",
  "RTDOSE",
  "RTIMAGE",
  "RTPLAN",
  "RTRECORD",
  "RTSTRUCT",
  "RWV",
  "SEG",
  "SM",
  "SMR",
  "SR",
  "STAIN",
  "TG",
  "US",
  "VA",
  "XA",
  "XC",
]);

/** FHIR R4 resource types used for family / storage separation (routing hints). */
export const FHIR_RESOURCE_HINT = {
  imaging_study: "ImagingStudy",
  diagnostic_report: "DiagnosticReport",
  observation: "Observation",
  document_reference: "DocumentReference",
} as const;

/**
 * RSNA-style radiology report section keys (template layer; labels only, not prose).
 * @see https://www.rsna.org/practice-tools/data-tools-and-standards
 */
export const RSNA_RAD_REPORT_SECTION_KEYS = [
  "clinical_information",
  "comparison",
  "technique",
  "findings",
  "impression",
  "recommendations",
] as const;

export type RsnaRadReportSectionKey = (typeof RSNA_RAD_REPORT_SECTION_KEYS)[number];

/** Normalize free text / OCR modality to DICOM code if it matches registry (routing truth). */
export function normalizeDicomModalityCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const u = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (!u) return null;
  if (DICOM_MODALITY_CODES.has(u)) return u;
  const alts: Record<string, string> = {
    MRI: "MR",
    MRA: "MR",
    CAT: "CT",
    "CTSCAN": "CT",
    XRAY: "DX",
    XR: "CR",
    ECHO: "US",
    ULTRASOUND: "US",
  };
  const mapped = alts[u];
  if (mapped && DICOM_MODALITY_CODES.has(mapped)) return mapped;
  return null;
}
