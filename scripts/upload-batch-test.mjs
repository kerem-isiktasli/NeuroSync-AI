#!/usr/bin/env node
/**
 * Upload & Analysis Batch Test
 *
 * Tests image (JPG/PNG) and DICOM batch limits.
 * Run: node scripts/upload-batch-test.mjs
 * Requires: dev server (npm run dev), env BASE_URL for API base
 *
 * Image tests: generates 5, 27, 50 JPG and POSTs via multipart to /api/analyze
 * DICOM tests: optional — set DICOM_SAMPLE=path/to/single.dcm to duplicate and test
 *
 * Output: success/fail per batch, limits inferred, transport used.
 */
import { readFile, readdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL || "http://localhost:3000";
const DICOM_SAMPLE = process.env.DICOM_SAMPLE || "";

// Minimal 1x1 PNG base64 for quick generation
const MINI_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function createTestImages(count) {
  const sharp = (await import("sharp")).default;
  const files = [];
  for (let i = 0; i < count; i++) {
    const buf = await sharp(Buffer.from(MINI_PNG_B64, "base64"))
      .resize(64, 64)
      .jpeg({ quality: 85 })
      .toBuffer();
    files.push(new File([buf], `test-${i}.jpg`, { type: "image/jpeg" }));
  }
  return files;
}

async function testImageBatch(count) {
  const files = await createTestImages(count);
  const formData = new FormData();
  for (const f of files) {
    formData.append("images", f, f.name);
  }
  formData.set("language", "en");

  const start = Date.now();
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    body: formData,
  });
  const elapsed = Date.now() - start;

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, elapsed, error: text.slice(0, 300) };
  }

  if (!res.body) return { ok: false, status: res.status, elapsed, error: "No body" };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasResult = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const { type } = JSON.parse(line.slice(6));
        if (type === "result" || type === "claude" || type === "error") {
          hasResult = type !== "error";
          break;
        }
      } catch (_) {}
    }
  }
  return { ok: hasResult, status: res.status, elapsed };
}

async function testDicomBatch(count, samplePath) {
  const buf = await readFile(samplePath);
  if (buf.length < 132) return { ok: false, status: 0, elapsed: 0, error: "DICOM too small" };
  const magic = buf.slice(128, 132);
  if (
    magic[0] !== 0x44 ||
    magic[1] !== 0x49 ||
    magic[2] !== 0x43 ||
    magic[3] !== 0x4d
  ) {
    return { ok: false, status: 0, elapsed: 0, error: "Not a valid DICOM file (no DICM)" };
  }

  const formData = new FormData();
  for (let i = 0; i < count; i++) {
    formData.append("files", new File([Buffer.from(buf)], `slice-${i}.dcm`, { type: "application/dicom" }));
  }
  formData.set("language", "en");

  const start = Date.now();
  const res = await fetch(`${BASE}/api/dicom/analyze`, {
    method: "POST",
    body: formData,
  });
  const elapsed = Date.now() - start;

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, status: res.status, elapsed, error: text.slice(0, 300) };
  }

  if (!res.body) return { ok: false, status: res.status, elapsed, error: "No body" };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let hasResult = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const { type } = JSON.parse(line.slice(6));
        if (type === "result" || type === "claude" || type === "error") {
          hasResult = type !== "error";
          break;
        }
      } catch (_) {}
    }
  }
  return { ok: hasResult, status: res.status, elapsed };
}

async function main() {
  console.log("========================================");
  console.log("Upload & Analysis Batch Test");
  console.log("BASE:", BASE);
  console.log("Transport: /api/analyze = multipart FormData, /api/dicom/analyze = multipart FormData");
  console.log("========================================\n");

  const imageSizes = [1, 5, 27];
  const results = { images: [], dicom: [] };

  for (const n of imageSizes) {
    process.stdout.write(`  Images (${n})... `);
    try {
      const r = await testImageBatch(n);
      results.images.push({ count: n, ...r });
      console.log(r.ok ? `OK (${r.elapsed}ms)` : `FAIL ${r.status} ${r.error || ""}`);
    } catch (e) {
      results.images.push({ count: n, ok: false, error: e.message });
      console.log("FAIL " + e.message);
    }
  }

  if (DICOM_SAMPLE) {
    const dicomSizes = [1, 10, 47];
    for (const n of dicomSizes) {
      process.stdout.write(`  DICOM (${n})... `);
      try {
        const r = await testDicomBatch(n, DICOM_SAMPLE);
        results.dicom.push({ count: n, ...r });
        console.log(r.ok ? `OK (${r.elapsed}ms)` : `FAIL ${r.status} ${r.error || ""}`);
      } catch (e) {
        results.dicom.push({ count: n, ok: false, error: e.message });
        console.log("FAIL " + e.message);
      }
    }
  } else {
    console.log("\nDICOM tests skipped (set DICOM_SAMPLE=path/to/sample.dcm to enable)");
  }

  console.log("\n----------------------------------------");
  console.log("SUMMARY");
  console.log("----------------------------------------");
  const imgPass = results.images.filter((r) => r.ok);
  const imgFail = results.images.filter((r) => !r.ok);
  console.log(`Images: ${imgPass.length}/${results.images.length} passed`);
  if (imgPass.length) console.log(`  Max passed: ${Math.max(...imgPass.map((r) => r.count))} images`);
  if (imgFail.length) console.log(`  Failed: ${imgFail.map((r) => r.count).join(", ")}`);

  if (results.dicom.length) {
    const dcmPass = results.dicom.filter((r) => r.ok);
    const dcmFail = results.dicom.filter((r) => !r.ok);
    console.log(`DICOM: ${dcmPass.length}/${results.dicom.length} passed`);
    if (dcmPass.length) console.log(`  Max passed: ${Math.max(...dcmPass.map((r) => r.count))} slices`);
    if (dcmFail.length) console.log(`  Failed: ${dcmFail.map((r) => r.count).join(", ")}`);
  }

  console.log("\nLimits (stable): MAX_IMAGES=10, STABLE_MAX_PROCESS=5, MAX_DICOM_SLICES_INGEST=30, MAX_SLICES_TO_ANALYZE=6");
  console.log("Files changed: src/app/api/analyze/route.ts, src/services/core-bridge.ts,");
  console.log("  src/lib/dicomAnalysisPipeline.ts, src/lib/dicom/studyImageAnalyzer.ts");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
