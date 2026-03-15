import {
  getClassificationPrompt,
  type DomainRoute,
  type ClassificationResult,
  type ImagePlane,
  type DiagnosticValue,
  DOMAIN_ROUTES,
} from "./classificationPrompts";
import { getDomainPrompt } from "./domainPrompts";
import { getSynthesisSystemPrompt, buildSynthesisUserMessage } from "./synthesisPrompts";

export { getClassificationPrompt, getDomainPrompt, getSynthesisSystemPrompt, buildSynthesisUserMessage };
export type { DomainRoute, ClassificationResult, ImagePlane, DiagnosticValue };

export function isValidDomainRoute(value: string): value is DomainRoute {
  return (DOMAIN_ROUTES as readonly string[]).includes(value);
}

export function resolveDomainRoute(raw?: string): DomainRoute {
  if (!raw) return "unknown";
  const normalized = raw.trim().toLowerCase();
  if (isValidDomainRoute(normalized)) return normalized;

  if (normalized.includes("spine") || normalized.includes("lumbar") || normalized.includes("cervical") || normalized.includes("thoracic")) {
    return "spine-mri";
  }
  if (normalized.includes("brain") || normalized.includes("head") || normalized.includes("cranial")) {
    return "brain-imaging";
  }
  if (normalized.includes("chest") || normalized.includes("thorax") || normalized.includes("lung") || normalized.includes("pulmonary")) {
    return "chest-imaging";
  }
  if (normalized.includes("abdomen") || normalized.includes("liver") || normalized.includes("kidney") || normalized.includes("pelvi")) {
    return "abdomen-imaging";
  }
  if (normalized.includes("knee") || normalized.includes("shoulder") || normalized.includes("hip") || normalized.includes("ankle") || normalized.includes("wrist") || normalized.includes("musculoskeletal")) {
    return "musculoskeletal-general";
  }
  if (normalized.includes("photo") || normalized.includes("skin") || normalized.includes("wound") || normalized.includes("derma")) {
    return "medical-photo";
  }

  return "unknown";
}

export const ROUTING_TABLE: Record<DomainRoute, string> = {
  "spine-mri": "Neuroradiology — Spine MRI Specialist",
  "brain-imaging": "Neuroradiology — Brain Imaging Specialist",
  "chest-imaging": "Thoracic Radiology — Chest Imaging Specialist",
  "abdomen-imaging": "Abdominal Radiology — Abdominal Imaging Specialist",
  "musculoskeletal-general": "Musculoskeletal Radiology — MSK Specialist",
  "medical-photo": "Clinical Photography — Lesion Assessment Specialist",
  "unknown": "General Radiology — Universal Assessment",
};
