/**
 * Universal Anatomy Mapper — Generalizes anatomical region detection.
 * Returns region + optional vertebra range (only for spine).
 * Does NOT assume spine for all studies.
 */
export type AnatomicalRegionUniversal =
  | "C-SPINE"
  | "T-SPINE"
  | "L-SPINE"
  | "THORACOLUMBAR"
  | "SACRUM"
  | "CHEST"
  | "BRAIN"
  | "ABDOMEN"
  | "PELVIS"
  | "MUSCULOSKELETAL"
  | "VASCULAR"
  | "UNKNOWN";

export type VertebraRange =
  | { start: "C1"; end: "C7" }
  | { start: "T1"; end: "T12" }
  | { start: "L1"; end: "L5" }
  | { start: "T1"; end: "L5" }
  | { start: "S1"; end: "S5" }
  | null;

export interface AnatomyMappingUniversal {
  region: AnatomicalRegionUniversal;
  /** Only set for spine regions. null for brain, chest, abdomen, etc. */
  vertebraRange: VertebraRange;
  /** True only when region is spine-related (C-SPINE, T-SPINE, L-SPINE, THORACOLUMBAR, SACRUM). */
  isSpine: boolean;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s_-]/g, "");
}

/**
 * Map modality + series/body part to anatomical region.
 * Spine regions get vertebra range; others do not.
 */
export function mapAnatomyUniversal(params: {
  modality: string;
  seriesDescription?: string;
  bodyPartExamined?: string;
}): AnatomyMappingUniversal {
  const { modality, seriesDescription = "", bodyPartExamined = "" } = params;
  const mod = normalize(modality);
  const desc = normalize(seriesDescription);
  const body = normalize(bodyPartExamined);
  const combined = `${desc} ${body}`;

  // Brain
  if (
    (mod.includes("ct") || mod.includes("mr")) &&
    (combined.includes("brain") ||
      combined.includes("head") ||
      combined.includes("cranial") ||
      combined.includes("neuro") ||
      body.includes("head"))
  ) {
    return { region: "BRAIN", vertebraRange: null, isSpine: false };
  }

  // Chest (non-spine thoracic)
  if (
    (mod.includes("ct") || mod.includes("mr") || mod.includes("xr")) &&
    (combined.includes("chest") ||
      combined.includes("thorax") ||
      combined.includes("lung") ||
      combined.includes("pulmonary") ||
      body.includes("chest")) &&
    !combined.includes("spine") &&
    !combined.includes("t-spine")
  ) {
    return { region: "CHEST", vertebraRange: null, isSpine: false };
  }

  // Abdomen
  if (
    (mod.includes("ct") || mod.includes("mr") || mod.includes("us")) &&
    (combined.includes("abdomen") ||
      combined.includes("abdominal") ||
      combined.includes("liver") ||
      combined.includes("kidney") ||
      body.includes("abdomen"))
  ) {
    return { region: "ABDOMEN", vertebraRange: null, isSpine: false };
  }

  // Pelvis
  if (
    (mod.includes("ct") || mod.includes("mr") || mod.includes("us")) &&
    (combined.includes("pelvis") || combined.includes("pelvic") || body.includes("pelvis"))
  ) {
    return { region: "PELVIS", vertebraRange: null, isSpine: false };
  }

  // MSK (non-spine)
  if (
    combined.includes("knee") ||
    combined.includes("shoulder") ||
    combined.includes("hip") ||
    combined.includes("ankle") ||
    combined.includes("wrist") ||
    combined.includes("musculoskeletal")
  ) {
    return { region: "MUSCULOSKELETAL", vertebraRange: null, isSpine: false };
  }

  // Vascular
  if (combined.includes("angio") || combined.includes("vascular") || combined.includes("cta")) {
    return { region: "VASCULAR", vertebraRange: null, isSpine: false };
  }

  // ─── SPINE REGIONS (with vertebra range) ───
  // T-spine before C-spine: "thoracic spine" contains "c" which could falsely match cervical.

  if (
    mod.includes("ct") &&
    (combined.includes("thoracic") && combined.includes("spine")) &&
    !combined.includes("cervical") &&
    !combined.includes("c-spine")
  ) {
    return { region: "T-SPINE", vertebraRange: { start: "T1", end: "T12" }, isSpine: true };
  }

  if (
    (mod.includes("ct") || mod.includes("mr")) &&
    (combined.includes("cspine") ||
      combined.includes("c-spine") ||
      combined.includes("cervical") ||
      combined.includes("neck") ||
      (body.includes("spine") && (desc.includes("cervical") || desc.includes("c-spine"))))
  ) {
    return { region: "C-SPINE", vertebraRange: { start: "C1", end: "C7" }, isSpine: true };
  }

  if (
    mod.includes("ct") &&
    (combined.includes("lumbar") ||
      combined.includes("l-spine") ||
      combined.includes("l spine") ||
      combined.includes("lower back") ||
      body.includes("lumbar"))
  ) {
    return { region: "L-SPINE", vertebraRange: { start: "L1", end: "L5" }, isSpine: true };
  }

  if (
    mod.includes("ct") &&
    (combined.includes("thoracolumbar") ||
      combined.includes("t-l spine") ||
      (combined.includes("t11") && combined.includes("l1")))
  ) {
    return { region: "THORACOLUMBAR", vertebraRange: { start: "T1", end: "L5" }, isSpine: true };
  }

  if ((combined.includes("sacrum") || combined.includes("sacral")) && mod.includes("ct")) {
    return { region: "SACRUM", vertebraRange: { start: "S1", end: "S5" }, isSpine: true };
  }

  // MRI spine
  if (mod.includes("mr")) {
    if (
      combined.includes("cspine") ||
      combined.includes("c-spine") ||
      combined.includes("cervical")
    ) {
      return { region: "C-SPINE", vertebraRange: { start: "C1", end: "C7" }, isSpine: true };
    }
    if (
      combined.includes("chest") ||
      combined.includes("thorax") ||
      combined.includes("thoracic") ||
      combined.includes("t spine")
    ) {
      return { region: "T-SPINE", vertebraRange: { start: "T1", end: "T12" }, isSpine: true };
    }
    if (
      combined.includes("lumbar") ||
      combined.includes("l-spine") ||
      combined.includes("l spine")
    ) {
      return { region: "L-SPINE", vertebraRange: { start: "L1", end: "L5" }, isSpine: true };
    }
  }

  return { region: "UNKNOWN", vertebraRange: null, isSpine: false };
}
