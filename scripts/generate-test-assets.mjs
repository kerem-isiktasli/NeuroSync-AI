#!/usr/bin/env node
/**
 * Generates real (non-1x1) test images for E2E browser validation.
 * Run: node scripts/generate-test-assets.mjs
 * Output: test-assets/*.png
 */
import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "test-assets");

// Minimal valid PNG (100x100 gray) - base64 encoded to avoid sharp in CI if needed
// This is a real image file, not a 1x1 placeholder
async function createWithSharp() {
  const sharp = (await import("sharp")).default;
  await mkdir(outDir, { recursive: true });

  const create = async (name, width, height, opts = {}) => {
    const buf = await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: opts.background ?? { r: 200, g: 210, b: 220 },
      },
    })
      .png()
      .toBuffer();
    await writeFile(join(outDir, name), buf);
    console.log(`Created ${name} (${width}x${height})`);
  };

  await create("single-image.png", 100, 100);
  await create("multi-1.png", 120, 120);
  await create("multi-2.png", 130, 130);
  await create("report-screenshot.png", 400, 300, {
    background: { r: 255, g: 255, b: 255 },
  });
  await create("mixed-image.png", 100, 100);
  console.log("Test assets ready at test-assets/");
}

createWithSharp().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
