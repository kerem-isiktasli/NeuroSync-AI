/**
 * Radiology Report Builder — Generate structured radiology report from pipeline output.
 */
import type { AssembledStudy } from "./studyAssembler";
import type { AnatomyMapping } from "./anatomyMapper";
import type { VertebraIndexMap } from "./vertebraIndexing";
import type { PathologyScanResult, SliceObservation } from "./pathologyScanner";

export interface VertebraFinding {
  level: string;
  finding: string;
}

export interface RadiologyReport {
  studyType: string;
  region: string;
  vertebraeFindings: VertebraFinding[];
  abnormalities: string[];
  impression: string;
  recommendedNextSteps: string[];
}

function observationsToAbnormalities(obs: SliceObservation[]): string[] {
  return obs
    .filter((o) => o.confidence >= 0.5)
    .map((o) => {
      const level = o.vertebraLevel ? ` (${o.vertebraLevel})` : "";
      return `${o.pathologyType.replace(/_/g, " ")}${level}: ${o.description}`;
    });
}

function observationsToImpression(obs: SliceObservation[], summary: string): string {
  if (obs.length === 0) return summary || "No significant abnormalities detected.";
  const byType = obs.reduce<Record<string, number>>((acc, o) => {
    acc[o.pathologyType] = (acc[o.pathologyType] ?? 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(byType)
    .map(([t, n]) => `${t.replace(/_/g, " ")}: ${n} observation(s)`)
    .join("; ");
  return `${parts}. ${summary}`;
}

function deriveNextSteps(
  obs: SliceObservation[],
  region: string
): string[] {
  const steps: string[] = [];
  if (obs.some((o) => o.pathologyType === "fracture")) {
    steps.push("Consider orthopedic or neurosurgery consultation.");
    steps.push("Clinical correlation and follow-up imaging as indicated.");
  }
  if (obs.some((o) => o.pathologyType === "disc_compression")) {
    steps.push("MRI may provide additional soft tissue detail if clinically indicated.");
  }
  if (obs.some((o) => o.pathologyType === "spinal_canal_narrowing")) {
    steps.push("Correlate with clinical symptoms. Consider MRI for cord signal evaluation.");
  }
  if (obs.some((o) => o.pathologyType === "mass_tumor")) {
    steps.push("Tissue characterization with MRI or biopsy as clinically appropriate.");
  }
  if (steps.length === 0) {
    steps.push("Routine follow-up per clinical indication.");
  }
  return steps;
}

/**
 * Build vertebrae findings from vertebra index map and pathology observations.
 */
function buildVertebraeFindings(
  vertebraMap: VertebraIndexMap,
  observations: SliceObservation[]
): VertebraFinding[] {
  const levels = Object.keys(vertebraMap).sort();
  const byLevel = observations.reduce<Record<string, string[]>>((acc, o) => {
    if (o.vertebraLevel) {
      acc[o.vertebraLevel] = acc[o.vertebraLevel] ?? [];
      acc[o.vertebraLevel].push(o.description);
    }
    return acc;
  }, {});

  return levels.map((level) => ({
    level,
    finding: (byLevel[level] ?? []).join("; ") || "No significant finding.",
  }));
}

/**
 * Build a structured radiology report from assembled study, anatomy mapping,
 * vertebra indexing, and pathology scan results.
 */
export function buildRadiologyReport(params: {
  study: AssembledStudy;
  anatomy: AnatomyMapping;
  vertebraIndexMap: VertebraIndexMap;
  pathologyScan: PathologyScanResult;
}): RadiologyReport {
  const { study, anatomy, vertebraIndexMap, pathologyScan } = params;
  const { observations, summary } = pathologyScan;

  const abnormalities = observationsToAbnormalities(observations);
  const impression = observationsToImpression(observations, summary);
  const recommendedNextSteps = deriveNextSteps(observations, anatomy.region);
  const vertebraeFindings = buildVertebraeFindings(vertebraIndexMap, observations);

  return {
    studyType: study.modality,
    region: anatomy.region,
    vertebraeFindings,
    abnormalities,
    impression,
    recommendedNextSteps,
  };
}
