/**
 * Scores intake-classified images and selects the most diagnostically useful subset.
 */

import type { PerImageIntakeResult } from "./intakePrompts";

export interface ScoredImage {
  originalIndex: number;
  fileName: string;
  score: number;
  scoreReasons: string[];
  intake: PerImageIntakeResult;
}

function baseScoreForDiagnosticValue(v: PerImageIntakeResult["diagnostic_value"]): number {
  switch (v) {
    case "high":
      return 60;
    case "medium":
      return 40;
    case "low":
      return 20;
    case "none":
    default:
      return 0;
  }
}

function normalizePlane(plane: string): "axial" | "sagittal" | "coronal" | "other" {
  const p = plane.toLowerCase();
  if (p === "axial" || p === "sagittal" || p === "coronal") return p;
  return "other";
}

/** Proxy for series diversity when intake has no series_type_guess (modality + plane). */
function seriesDiversityKey(intake: PerImageIntakeResult): string {
  const mod = (intake.modality_guess ?? "").trim().toLowerCase();
  const plane = (intake.image_plane ?? "").trim().toLowerCase();
  return `${mod}|${plane}`;
}

export function selectBestSlices(
  perImageIntake: PerImageIntakeResult[],
  maxSlices: number = 25
): number[] {
  if (perImageIntake.length === 0) return [];
  if (perImageIntake.length <= maxSlices) {
    return [...perImageIntake]
      .map((p) => p.imageIndex)
      .sort((a, b) => a - b);
  }

  type Row = {
    intake: PerImageIntakeResult;
    preliminary: number;
    scoreReasons: string[];
  };

  const rows: Row[] = perImageIntake.map((intake) => {
    const reasons: string[] = [];
    let pre = baseScoreForDiagnosticValue(intake.diagnostic_value);
    reasons.push(`base:${intake.diagnostic_value}=${pre}`);

    const isLocalizer = intake.upload_type === "localizer";
    if (isLocalizer) {
      pre -= 50;
      reasons.push("penalty:localizer=-50");
    }
    if (intake.contains_report_text) {
      pre -= 30;
      reasons.push("penalty:report_text=-30");
    }
    if (intake.upload_type === "unknown") {
      pre -= 10;
      reasons.push("penalty:upload_unknown=-10");
    }
    if (intake.confidence < 30) {
      pre -= 15;
      reasons.push("penalty:low_confidence=-15");
    }

    return { intake, preliminary: pre, scoreReasons: reasons };
  });

  rows.sort(
    (a, b) =>
      b.preliminary - a.preliminary ||
      a.intake.imageIndex - b.intake.imageIndex
  );

  const planeCount: Record<string, number> = {};
  const seenSeries = new Set<string>();
  const scored: ScoredImage[] = [];

  for (const row of rows) {
    const { intake } = row;
    const plane = normalizePlane(intake.image_plane);
    const pc = (planeCount[plane] = (planeCount[plane] ?? 0) + 1);
    const planeBonus = pc === 1 ? 15 : pc === 2 ? 8 : pc === 3 ? 4 : 0;
    const planeReason =
      planeBonus > 0 ? `bonus:plane(${plane})#${pc}=+${planeBonus}` : "";

    const sKey = seriesDiversityKey(intake);
    let seqBonus = 0;
    if (!seenSeries.has(sKey)) {
      seenSeries.add(sKey);
      seqBonus = 10;
    }
    const seqReason = seqBonus > 0 ? `bonus:series_unique=${sKey}:+10` : "";

    const reasons = [...row.scoreReasons];
    if (planeReason) reasons.push(planeReason);
    if (seqReason) reasons.push(seqReason);

    const score = row.preliminary + planeBonus + seqBonus;
    scored.push({
      originalIndex: intake.imageIndex,
      fileName: intake.fileName,
      score,
      scoreReasons: reasons,
      intake,
    });
  }

  scored.sort(
    (a, b) => b.score - a.score || a.originalIndex - b.originalIndex
  );

  const top = scored.slice(0, maxSlices);
  const selected = top.map((s) => s.originalIndex).sort((a, b) => a - b);

  if (process.env.NODE_ENV !== "production") {
    const byScore = [...scored].sort((a, b) => b.score - a.score);
    console.log(
      "[sliceSelector] Selected",
      selected.length,
      "of",
      perImageIntake.length,
      "images. Scores:",
      byScore
        .slice(0, 5)
        .map((s) => `${s.fileName}:${s.score}`)
        .join(", ")
    );
  }

  return selected;
}
