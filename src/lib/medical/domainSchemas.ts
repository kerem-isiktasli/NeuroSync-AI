/**
 * Domain-Specific Finding Schemas — Phase 4.
 * Each domain has its own structured output schema.
 * Universal wrapper holds any domain result.
 */

import type { MedicalDomain } from "./domainRouter";

// ─── SPINE ────────────────────────────────────────────────

export interface SpineFindingSchema {
  domain: "spine";
  vertebraeFindings: Array<{ level: string; finding: string }>;
  canalForaminaFindings: string[];
  discFindings: string[];
  abnormalities: string[];
  impression: string;
  recommendedNextSteps: string[];
}

// ─── BRAIN ───────────────────────────────────────────────

export interface BrainFindingSchema {
  domain: "brain";
  lesionLocalization: Array<{ region: string; finding: string }>;
  hemorrhageEdemaMassEffect: string[];
  ventricularFindings: string[];
  extraAxialFindings: string[];
  abnormalities: string[];
  impression: string;
  recommendedNextSteps: string[];
}

// ─── CHEST ───────────────────────────────────────────────

export interface ChestFindingSchema {
  domain: "chest";
  lungLobeFindings: Array<{ lobe: string; finding: string }>;
  pleuraEffusionConsolidation: string[];
  noduleFindings: string[];
  mediastinumFindings: string[];
  abnormalities: string[];
  impression: string;
  recommendedNextSteps: string[];
}

// ─── ABDOMEN ──────────────────────────────────────────────

export interface AbdomenFindingSchema {
  domain: "abdomen-pelvis";
  organFindings: Array<{ organ: string; finding: string }>;
  liverFindings: string[];
  kidneyFindings: string[];
  bowelBladderFindings: string[];
  abnormalities: string[];
  impression: string;
  recommendedNextSteps: string[];
}

// ─── DOCUMENT (RADIOLOGY) ─────────────────────────────────

export interface DocumentFindingSchema {
  domain: "document-only";
  impression: string;
  findings: string[];
  clinicalHistory: string;
  recommendations: string[];
  limitations: string[];
}

// ─── LAB ───────────────────────────────────────────────────

export interface LabFindingSchema {
  domain: "lab";
  analytes: Array<{
    name: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: "high" | "low" | "critical" | "normal";
  }>;
  abnormalFlags: string[];
  referenceRanges: string[];
  clinicalInterpretationCaveats: string[];
  impression: string;
  recommendations: string[];
  limitations: string[];
}

// ─── PATHOLOGY ──────────────────────────────────────────────

export interface PathologyFindingSchema {
  domain: "pathology";
  specimen: string;
  diagnosis: string;
  histologicType?: string;
  grade?: string;
  stage?: string;
  markers?: string[];
  margins?: string[];
  limitations: string[];
  impression: string;
  recommendations: string[];
}

// ─── MUSCULOSKELETAL / VASCULAR / GENERAL ─────────────────

export interface GeneralFindingSchema {
  domain: "musculoskeletal" | "vascular" | "general-radiology";
  findings: string[];
  abnormalities: string[];
  impression: string;
  recommendedNextSteps: string[];
}

// ─── MIXED FUSION ────────────────────────────────────────

export interface MixedFusionSchema {
  domain: "mixed-fusion";
  imageFindingsSummary: string;
  documentFindingsSummary: string;
  agreementPoints: string[];
  contradictions: Array<{ imageFinding: string; reportFinding: string; note: string }>;
  finalImpression: string;
  confidenceScore: number;
  recommendedNextSteps: string[];
}

// ─── UNIVERSAL WRAPPER ────────────────────────────────────

export type DomainFinding =
  | SpineFindingSchema
  | BrainFindingSchema
  | ChestFindingSchema
  | AbdomenFindingSchema
  | DocumentFindingSchema
  | LabFindingSchema
  | PathologyFindingSchema
  | GeneralFindingSchema
  | MixedFusionSchema;

export interface UniversalReportWrapper {
  modality: string;
  region: string;
  domain: MedicalDomain;
  studyAdequacy: string;
  limitations: string[];
  confidence: number;
  additionalDataRequested: string[];
  domainFindings: DomainFinding;
}
