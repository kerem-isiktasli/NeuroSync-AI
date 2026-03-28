#!/usr/bin/env node
/**
 * Single-image POST to /api/analyze — for local debugging.
 * Run: node scripts/one-image-analyze-test.mjs
 * Requires: npm run dev, BASE_URL optional (default http://localhost:3000)
 */
import sharp from "sharp";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const MINI_PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const buf = await sharp(Buffer.from(MINI_PNG_B64, "base64"))
  .resize(64, 64)
  .jpeg({ quality: 85 })
  .toBuffer();

const file = new File([buf], "debug-tiny.jpg", { type: "image/jpeg" });
const formData = new FormData();
formData.append("images", file);
formData.set("language", "en");

const t0 = Date.now();
const res = await fetch(`${BASE}/api/analyze`, {
  method: "POST",
  body: formData,
});

console.log("HTTP", res.status, "firstByteMs", Date.now() - t0);
const text = await res.text();
console.log("bodyChars", text.length);

let events = 0;
let sawResult = false;
let sawError = false;
let lastProgress = "";
for (const block of text.split("\n\n")) {
  if (!block.startsWith("data: ")) continue;
  events++;
  try {
    const payload = JSON.parse(block.slice(6));
    if (payload.type === "result") sawResult = true;
    if (payload.type === "error") sawError = true;
    if (payload.type === "progress" && payload.data?.message) {
      lastProgress = payload.data.message;
    }
  } catch {
    /* ignore */
  }
}

console.log("sse_data_blocks", events);
console.log("saw_result", sawResult, "saw_error", sawError);
if (lastProgress) console.log("last_progress", lastProgress.slice(0, 200));
console.log("--- tail ---\n", text.slice(-1500));

if (!res.ok) process.exit(1);
if (sawError && !sawResult) process.exit(2);
