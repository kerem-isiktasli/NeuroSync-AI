/**
 * Build the deep-analysis queue from Flash triage scores (clusters + neighbor expansion).
 */

export interface TriageRow {
  slice_id: number;
  /** 0–1, higher = more concerning. */
  score: number;
  triage_failed: boolean;
}

/** Slices that are not “clear” (below triageClearBelow) or failed triage → candidate for deep. */
export function collectFlaggedIndices(
  rows: TriageRow[],
  triageClearBelow: number
): number[] {
  const out: number[] = [];
  for (const r of rows) {
    if (!r) continue;
    const unclear = r.triage_failed || r.score >= triageClearBelow;
    if (unclear) out.push(r.slice_id);
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Merge nearby flagged indices into clusters (gap ≤ maxGap). */
export function mergeClusters(sorted: number[], maxGap: number): number[][] {
  if (sorted.length === 0) return [];
  const clusters: number[][] = [];
  let cur: number[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const x = sorted[i]!;
    if (x - cur[cur.length - 1]! <= maxGap) cur.push(x);
    else {
      clusters.push(cur);
      cur = [x];
    }
  }
  clusters.push(cur);
  return clusters;
}

/**
 * Upper bound on how many slices we allow in the deep stage after neighbor expansion.
 */
export function computeDeepBudget(
  totalSlices: number,
  flaggedCount: number,
  clusterCount: number,
  neighborRadius: number
): number {
  if (totalSlices <= 0) return 0;
  const r = Math.max(0, neighborRadius);
  const expansion = 1 + 2 * r;
  const estimated =
    flaggedCount + Math.max(0, clusterCount) * expansion;
  return Math.min(
    totalSlices,
    Math.max(estimated, flaggedCount > 0 ? 1 : 0, Math.min(8, totalSlices))
  );
}

export function buildDeepQueue(
  rows: TriageRow[],
  totalSlices: number,
  triageClearBelow: number,
  clusterMaxGap: number,
  neighborRadius: number,
  budget: number
): {
  deepIndices: number[];
  flaggedCount: number;
  truncated: boolean;
  truncatedDropCount: number;
} {
  const flaggedIndices = collectFlaggedIndices(rows, triageClearBelow);
  const flaggedCount = flaggedIndices.length;

  if (totalSlices <= 0 || flaggedCount === 0) {
    return {
      deepIndices: [],
      flaggedCount,
      truncated: false,
      truncatedDropCount: 0,
    };
  }

  const clusters = mergeClusters(flaggedIndices, clusterMaxGap);
  const deepSet = new Set<number>();
  const r = Math.max(0, neighborRadius);

  for (const cluster of clusters) {
    const lo = Math.min(...cluster);
    const hi = Math.max(...cluster);
    const start = Math.max(0, lo - r);
    const end = Math.min(totalSlices - 1, hi + r);
    for (let i = start; i <= end; i++) deepSet.add(i);
  }

  const flaggedSet = new Set(flaggedIndices);
  let allSorted = [...deepSet].sort((a, b) => a - b);

  if (allSorted.length <= budget) {
    return {
      deepIndices: allSorted,
      flaggedCount,
      truncated: false,
      truncatedDropCount: 0,
    };
  }

  const priority = (i: number) => (flaggedSet.has(i) ? 0 : 1);
  allSorted = [...allSorted].sort(
    (a, b) => priority(a) - priority(b) || a - b
  );
  const kept = allSorted.slice(0, budget).sort((a, b) => a - b);
  return {
    deepIndices: kept,
    flaggedCount,
    truncated: true,
    truncatedDropCount: deepSet.size - budget,
  };
}
