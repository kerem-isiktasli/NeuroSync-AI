/**
 * Domain Router — Phase 2.
 * Maps uploads into specialist domains based on:
 * - upload type, modality, anatomical region, metadata, OCR content.
 * Does NOT assume spine-first.
 */

export type MedicalDomain =
  | "spine"
  | "brain"
  | "chest"
  | "abdomen-pelvis"
  | "musculoskeletal"
  | "vascular"
  | "general-radiology"
  | "document-only"
  | "mixed-fusion";

export interface DomainRouterInput {
  uploadType: string;
  modality?: string;
  anatomicalRegion?: string;
  documentTypeGuess?: string;
  ocrContentSnippet?: string;
  hasDicomStudy?: boolean;
  hasDiagnosticImages?: boolean;
  hasReportDocuments?: boolean;
}

export interface DomainRouterResult {
  domain: MedicalDomain;
  confidence: number;
  reasoning: string[];
}

const SPINE_KEYWORDS = [
  "spine", "cervical", "lumbar", "thoracic", "spinal", "vertebra",
  "disc", "c-spine", "l-spine", "t-spine", "sacrum", "coccyx",
  "cord", "cauda", "foramen", "canal", "s1", "l5", "c7",
];

const BRAIN_KEYWORDS = [
  "brain", "head", "cranial", "cerebral", "ventricle", "mri brain",
  "ct head", "neuro", "sella", "pituitary", "cerebellum", "stroke",
];

const CHEST_KEYWORDS = [
  "chest", "thorax", "lung", "pulmonary", "mediastinum", "cardiac",
  "cxr", "chest x-ray", "ct chest", "hrct", "nodule", "consolidation",
  "effusion", "pleura",
];

const ABDOMEN_KEYWORDS = [
  "abdomen", "abdominal", "liver", "kidney", "spleen", "pancreas",
  "pelvis", "pelvic", "bowel", "bladder", "ct abdomen", "mri abdomen",
  "ultrasound", "us abdomen",
];

const MSK_KEYWORDS = [
  "knee", "shoulder", "hip", "ankle", "wrist", "elbow",
  "musculoskeletal", "msk", "joint", "bone", "fracture", "ligament",
  "tendon", "meniscus", "rotator",
];

const VASCULAR_KEYWORDS = [
  "vascular", "angiography", "cta", "mra", "dvt", "aorta",
  "carotid", "vessel", "stenosis",
];

function matchesKeywords(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

/**
 * Route to medical domain. Does NOT default to spine.
 */
export function routeToDomain(input: DomainRouterInput): DomainRouterResult {
  const mod = (input.modality ?? "").toLowerCase();
  const region = (input.anatomicalRegion ?? "").toLowerCase();
  const ocr = (input.ocrContentSnippet ?? "").toLowerCase();
  const combined = `${mod} ${region} ${ocr}`.toLowerCase();
  const reasoning: string[] = [];

  // Document-only: no imaging, just reports/documents
  if (
    input.uploadType === "pdf-report" ||
    input.uploadType === "report-image" ||
    input.uploadType === "pathology-lab-document"
  ) {
    if (input.hasDiagnosticImages) {
      reasoning.push("Has report docs but also diagnostic images");
      return {
        domain: "mixed-fusion",
        confidence: 0.85,
        reasoning: ["Mixed: report + images → fusion"],
      };
    }
    reasoning.push("Document-only upload");
    return {
      domain: "document-only",
      confidence: 0.9,
      reasoning,
    };
  }

  // Mixed: diagnostic images + report docs
  if (
    input.hasDiagnosticImages &&
    input.hasReportDocuments &&
    (input.uploadType === "mixed" || input.hasDicomStudy)
  ) {
    return {
      domain: "mixed-fusion",
      confidence: 0.88,
      reasoning: ["Mixed upload: images + documents → fusion pipeline"],
    };
  }

  // DICOM or diagnostic image: use anatomy + modality
  if (
    input.uploadType === "dicom-study" ||
    input.uploadType === "diagnostic-image" ||
    input.uploadType === "viewer-screenshot" ||
    input.uploadType === "localizer"
  ) {
    if (matchesKeywords(combined, BRAIN_KEYWORDS)) {
      return {
        domain: "brain",
        confidence: 0.9,
        reasoning: ["Anatomy/modality suggests brain imaging"],
      };
    }
    if (matchesKeywords(combined, CHEST_KEYWORDS)) {
      return {
        domain: "chest",
        confidence: 0.9,
        reasoning: ["Anatomy/modality suggests chest imaging"],
      };
    }
    if (matchesKeywords(combined, ABDOMEN_KEYWORDS)) {
      return {
        domain: "abdomen-pelvis",
        confidence: 0.9,
        reasoning: ["Anatomy/modality suggests abdomen/pelvis"],
      };
    }
    if (matchesKeywords(combined, MSK_KEYWORDS)) {
      return {
        domain: "musculoskeletal",
        confidence: 0.88,
        reasoning: ["Anatomy/modality suggests MSK"],
      };
    }
    if (matchesKeywords(combined, VASCULAR_KEYWORDS)) {
      return {
        domain: "vascular",
        confidence: 0.85,
        reasoning: ["Anatomy/modality suggests vascular"],
      };
    }
    if (matchesKeywords(combined, SPINE_KEYWORDS)) {
      return {
        domain: "spine",
        confidence: 0.9,
        reasoning: ["Anatomy/modality suggests spine imaging"],
      };
    }
  }

  // Fallback: general radiology (NOT spine)
  return {
    domain: "general-radiology",
    confidence: 0.5,
    reasoning: ["Could not determine specific domain; routing to general radiology"],
  };
}
