/**
 * RapiMed Chest X-Ray Capability Guard — deterministic scope check for CXR-style projection studies.
 * No reports, no diagnosis; flags overreach vs accepted_items and locked facts.
 */

import type { AcceptedAdjudicationItem } from "./evidenceAdjudicatorMerger";
import type { FinalReportRenderResult } from "./finalReportRenderer";
import type { LockedStudyFacts } from "./studyFactLocker";

export type ChestXrayGuardRecommendation = "allow" | "repair" | "block";

export interface ChestXrayCapabilityGuardResult {
  passed: boolean;
  issues: string[];
  recommendation: ChestXrayGuardRecommendation;
}

const CHEST_ANATOMY = /\b(chest|lung|lungs|pulmonary|thorax|thoracic|pleur|mediastin|rib\s|ribs\b|cardiac\s+silhouette|heart\s+shadow|hilar\b|apex|costophrenic)\b/i;

const SINGLE_VIEW = /\bsingle\s+(view|image|film|radiograph)\b/i;

/** Obvious emergency language in accepted items — allows higher concern when <= 2 images. */
const OBVIOUS_EMERGENCY = /\b(tension\s+pneumothorax|large\s+pneumothorax|massive\s+pneumothorax|hemothorax|large\s+pleural\s+effusion|tension\s+physiology|flail\s+chest|wide\s+mediastinum|tamponade|tension\s+hydrothorax)\b/i;

/**
 * Highly specific / subtle structural labels that are common CXR overreach when absent from acceptance.
 */
const OVERREACH_SUBSTRINGS = [
  "bronchiectasis",
  "hilar adenopathy",
  "osteopenia",
  "schmorl",
  "schmorl's",
  "pectus excavatum",
  "pectus carinatum",
  "granuloma",
  "endplate",
  "vertebral body height loss",
  "compression deformity",
  "disc space narrowing",
] as const;

/** Blatant non-thoracic primary pathology wording — inappropriate as standalone CXR conclusions. */
const OFF_CHEST_PRIMARY = [
  /\bhepatomegaly\b/i,
  /\bsplenomegaly\b/i,
  /\bintracranial\b/i,
  /\bfemur\b/i,
  /\btibial\b/i,
  /\bknee\s+joint\b/i,
  /\bbrain\s+parenchyma\b/i,
];

function isChestProjectionContext(lf: LockedStudyFacts): boolean {
  if (lf.procedure_class !== "projection_radiography") return false;
  const parts = [
    lf.anatomy.body_region,
    lf.anatomy.organ_system,
    lf.anatomy.primary_structure,
    ...lf.anatomy.substructures,
  ]
    .join(" ")
    .toLowerCase();
  return CHEST_ANATOMY.test(parts);
}

function acceptedEvidenceBlob(items: AcceptedAdjudicationItem[]): string {
  return items
    .map(
      (a) =>
        `${a.label} ${a.rendering_text_safe} ${a.item_rationale ?? ""} ${a.adjudication_location?.primary_structure ?? ""}`
    )
    .join(" ")
    .toLowerCase();
}

function hasObviousEmergencyInAccepted(items: AcceptedAdjudicationItem[]): boolean {
  return items.some((a) =>
    OBVIOUS_EMERGENCY.test(`${a.label} ${a.rendering_text_safe}`)
  );
}

/**
 * Evaluate CXR capability rules. Returns allow when context is not chest projection_radiography.
 */
export function evaluateChestXrayCapabilityGuard(params: {
  locked_study_facts: LockedStudyFacts;
  accepted_items: AcceptedAdjudicationItem[];
  rendered_report_json: FinalReportRenderResult;
}): ChestXrayCapabilityGuardResult {
  const { locked_study_facts: lf, accepted_items, rendered_report_json: rep } =
    params;

  if (!isChestProjectionContext(lf)) {
    return { passed: true, issues: [], recommendation: "allow" };
  }

  const issues: string[] = [];
  let recommendation: ChestXrayGuardRecommendation = "allow";

  const pushBlock = (code: string) => {
    issues.push(code);
    recommendation = "block";
  };

  const pushRepair = (code: string) => {
    issues.push(code);
    if (recommendation === "allow") recommendation = "repair";
  };

  const reportBlob = JSON.stringify(rep).toLowerCase();
  const acceptedBlob = acceptedEvidenceBlob(accepted_items);

  // Rule 5: single view vs image_count
  const ic = lf.image_count;
  if (typeof ic === "number" && ic > 1 && SINGLE_VIEW.test(reportBlob)) {
    pushBlock("single_view_claim_inconsistent_with_image_count");
  }

  // Rule 3: <= 2 images, concern cap without emergency in accepted_items
  if (typeof ic === "number" && ic <= 2) {
    const cl = rep.concern_level;
    if (cl === "high" || cl === "urgent_review") {
      if (!hasObviousEmergencyInAccepted(accepted_items)) {
        pushRepair("concern_exceeds_moderate_without_obvious_emergency_in_accepted_items");
      }
    }
  }

  // Rule 2 (strict slice): substantive findings with zero accepted items
  if (accepted_items.length === 0) {
    const kr = rep.report_sections.key_results.join(" ").trim();
    const imp = rep.report_sections.impression_or_conclusion.trim();
    const det = rep.report_sections.detailed_results.join(" ").trim();
    if (kr.length > 40 || imp.length > 80 || det.length > 120) {
      pushBlock("substantive_report_content_without_accepted_items");
    }
  }

  // Rule 4: specific structural / subtle diagnoses not echoed in accepted text
  for (const term of OVERREACH_SUBSTRINGS) {
    if (reportBlob.includes(term) && !acceptedBlob.includes(term)) {
      pushRepair(`high_specific_finding_not_explicitly_supported_in_accepted_items:${term}`);
    }
  }

  // Rule 1 (light): blatant off-chest primary claims not supported by acceptance
  for (const re of OFF_CHEST_PRIMARY) {
    if (re.test(reportBlob) && !re.test(acceptedBlob)) {
      pushRepair(`finding_outside_typical_cxr_scope:${re.source}`);
    }
  }

  const passed = recommendation === "allow" && issues.length === 0;
  return { passed, issues, recommendation };
}
