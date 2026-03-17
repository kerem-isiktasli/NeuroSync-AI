/**
 * Anatomy Mapper — Detect anatomical region from modality and series metadata.
 * Maps to vertebra ranges: C1–C7, T1–T12, L1–L5.
 */
export type AnatomicalRegion =
  | "C-SPINE"
  | "CHEST"
  | "LUMBAR"
  | "THORACOLUMBAR"
  | "SACRUM"
  | "UNKNOWN";

export type VertebraRange =
  | { start: "C1"; end: "C7" }
  | { start: "T1"; end: "T12" }
  | { start: "L1"; end: "L5" }
  | { start: "T1"; end: "L5" }
  | { start: "S1"; end: "S5" }
  | null;

export interface AnatomyMapping {
  region: AnatomicalRegion;
  vertebraRange: VertebraRange;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Map modality + series description / body part to anatomical region and vertebra range.
 * Rules:
 *   CT C-SPINE → cervical vertebrae C1–C7
 *   CT CHEST  → thoracic vertebrae T1–T12
 *   CT LUMBAR → L1–L5
 */
export function mapAnatomy(params: {
  modality: string;
  seriesDescription?: string;
  bodyPartExamined?: string;
}): AnatomyMapping {
  const { modality, seriesDescription = "", bodyPartExamined = "" } = params;
  const mod = normalize(modality);
  const desc = normalize(seriesDescription);
  const body = normalize(bodyPartExamined);

  const combined = `${desc} ${body}`;

  // C-spine / cervical
  if (
    mod.includes("ct") &&
    (combined.includes("cspine") ||
      combined.includes("c-spine") ||
      combined.includes("cervical") ||
      combined.includes("neck") ||
      (body.includes("spine") && desc.includes("c")))
  ) {
    return { region: "C-SPINE", vertebraRange: { start: "C1", end: "C7" } };
  }

  // Chest / thoracic
  if (
    mod.includes("ct") &&
    (combined.includes("chest") ||
      combined.includes("thorax") ||
      combined.includes("thoracic") ||
      combined.includes("lung") ||
      combined.includes("t spine") ||
      body.includes("chest"))
  ) {
    return { region: "CHEST", vertebraRange: { start: "T1", end: "T12" } };
  }

  // Lumbar
  if (
    mod.includes("ct") &&
    (combined.includes("lumbar") ||
      combined.includes("l-spine") ||
      combined.includes("l spine") ||
      combined.includes("lower back") ||
      body.includes("lumbar"))
  ) {
    return { region: "LUMBAR", vertebraRange: { start: "L1", end: "L5" } };
  }

  // Thoracolumbar
  if (
    mod.includes("ct") &&
    (combined.includes("thoracolumbar") ||
      combined.includes("t-l spine") ||
      combined.includes("t11") ||
      combined.includes("t12") && combined.includes("l1"))
  ) {
    return { region: "THORACOLUMBAR", vertebraRange: { start: "T1", end: "L5" } };
  }

  // Sacrum
  if (
    (combined.includes("sacrum") || combined.includes("sacral")) &&
    mod.includes("ct")
  ) {
    return { region: "SACRUM", vertebraRange: { start: "S1", end: "S5" } };
  }

  // MRI - same region logic
  if (mod.includes("mr")) {
    if (
      combined.includes("cspine") ||
      combined.includes("c-spine") ||
      combined.includes("cervical")
    ) {
      return { region: "C-SPINE", vertebraRange: { start: "C1", end: "C7" } };
    }
    if (
      combined.includes("chest") ||
      combined.includes("thorax") ||
      combined.includes("thoracic")
    ) {
      return { region: "CHEST", vertebraRange: { start: "T1", end: "T12" } };
    }
    if (
      combined.includes("lumbar") ||
      combined.includes("l-spine") ||
      combined.includes("l spine")
    ) {
      return { region: "LUMBAR", vertebraRange: { start: "L1", end: "L5" } };
    }
  }

  return { region: "UNKNOWN", vertebraRange: null };
}
