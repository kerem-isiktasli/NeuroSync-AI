/**
 * Hippocampal dataset evaluation harness.
 * Run: npx tsx src/lib/dicom/__tests__/hippocampalEval.ts
 *
 * For each case in the dataset:
 * 1. Load NIfTI volume (use nifti-reader-js)
 * 2. Run getAnatomicallyBalancedSliceIndices on the volume slice count
 * 3. Check what % of sampled slices contain hippocampal tissue (mask value > 0)
 * 4. Report: case_id, total_slices, sampled_count, slices_with_hippocampus, coverage_percent
 */

import * as fs from "fs";
import * as path from "path";
import { getAnatomicallyBalancedSliceIndices } from "../sliceRenderer";

const DATASET_PATH = process.env.DATASET_PATH || "./hippocampus_dataset";
const MAX_ANALYZE = 16; // match prod

interface EvalResult {
  caseId: string;
  totalSlices: number;
  sampledCount: number;
  slicesWithHippocampus: number;
  coveragePercent: number;
  missed: boolean;
}

async function evaluateCase(caseDir: string): Promise<EvalResult> {
  const caseId = path.basename(caseDir);

  const files = fs.readdirSync(caseDir);
  const maskFile = files.find(
    (f) => f.includes("_seg") && f.endsWith(".nii.gz")
  );

  if (!maskFile) {
    return {
      caseId,
      totalSlices: 0,
      sampledCount: 0,
      slicesWithHippocampus: 0,
      coveragePercent: 0,
      missed: true,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nifti = require("nifti-reader-js");
  const rawBuf = fs.readFileSync(path.join(caseDir, maskFile));

  let data: Buffer = rawBuf;
  if (nifti.isCompressed(rawBuf)) {
    data = nifti.decompress(rawBuf);
  }

  if (!nifti.isNIFTI(data)) {
    return {
      caseId,
      totalSlices: 0,
      sampledCount: 0,
      slicesWithHippocampus: 0,
      coveragePercent: 0,
      missed: true,
    };
  }

  const header = nifti.readHeader(data);
  const image = nifti.readImage(header, data);

  const xDim = header.dims[1]!;
  const yDim = header.dims[2]!;
  const zDim = header.dims[3]!;
  const sliceSize = xDim * yDim;

  const maskArray = new Int16Array(image);
  const totalSlices = zDim;

  const hippocampalSlices = new Set<number>();
  for (let z = 0; z < zDim; z++) {
    for (let i = 0; i < sliceSize; i++) {
      if (maskArray[z * sliceSize + i]! > 0) {
        hippocampalSlices.add(z);
        break;
      }
    }
  }

  const sampledIndices = getAnatomicallyBalancedSliceIndices(
    totalSlices,
    MAX_ANALYZE
  );

  const capturedSlices = sampledIndices.filter((idx) =>
    hippocampalSlices.has(idx)
  );

  const coveragePercent =
    hippocampalSlices.size > 0
      ? Math.round(
          (capturedSlices.length / hippocampalSlices.size) * 100
        )
      : 100;

  return {
    caseId,
    totalSlices,
    sampledCount: sampledIndices.length,
    slicesWithHippocampus: capturedSlices.length,
    coveragePercent,
    missed: capturedSlices.length === 0,
  };
}

async function main() {
  if (!fs.existsSync(DATASET_PATH)) {
    console.error(`Dataset path not found: ${DATASET_PATH}`);
    process.exit(1);
  }

  const caseDirs = fs
    .readdirSync(DATASET_PATH)
    .filter((d) =>
      fs.statSync(path.join(DATASET_PATH, d)).isDirectory()
    )
    .map((d) => path.join(DATASET_PATH, d))
    .slice(0, 30);

  const results: EvalResult[] = [];
  for (const dir of caseDirs) {
    results.push(await evaluateCase(dir));
  }

  const avgCoverage =
    results.length > 0
      ? results.reduce((s, r) => s + r.coveragePercent, 0) / results.length
      : 0;
  const missedCount = results.filter((r) => r.missed).length;

  console.log("\n=== HIPPOCAMPAL SAMPLING EVALUATION ===");
  console.log(`Cases evaluated: ${results.length}`);
  console.log(`Avg hippocampal coverage: ${avgCoverage.toFixed(1)}%`);
  console.log(
    `Cases with zero hippocampal slices sampled: ` +
      `${missedCount}/${results.length}`
  );
  console.log("\nPer-case results:");
  for (const r of results) {
    console.log(
      `  ${r.caseId}: ` +
        `${r.slicesWithHippocampus} hippocampal slices ` +
        `sampled of ${r.sampledCount} total, ` +
        `coverage=${r.coveragePercent}%` +
        `${r.missed ? " ← MISSED" : ""}`
    );
  }

  console.log("\n=== RECOMMENDATION ===");
  if (avgCoverage < 50 || missedCount > 3) {
    console.log(
      "WARNING: Current balanced sampling " +
        "misses hippocampal region in many cases."
    );
    console.log(
      "Consider: increase MAX_ANALYZE to 24, " +
        "or add anatomy-aware sampling that " +
        "overweights mid-volume slices for brain."
    );
  } else {
    console.log(
      "Sampling coverage is acceptable for " + "hippocampal detection."
    );
  }
}

main().catch(console.error);
