import { test, expect } from "@playwright/test";
import { existsSync } from "fs";
import { join } from "path";
import { signInAndAcceptTerms } from "./helpers";

const ASSETS = join(process.cwd(), "test-assets");
const SINGLE_IMAGE = join(ASSETS, "single-image.png");

test.describe("Section 6 — PDF Export Test", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndAcceptTerms(page);
  });

  test("6.1 Skip if no test asset for report", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }
  });

  test("6.2 Produce report then export PDF", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SINGLE_IMAGE);

    await page.getByText(/Report interpretation|Rapor/i).waitFor({ state: "visible", timeout: 90_000 });

    // PDF export button - "EXPORT REPORT" or "RAPORU DIŞA AKTAR"
    const exportBtn = page.getByRole("button", { name: /EXPORT REPORT|RAPORU DIŞA AKTAR|Export report|export/i }).first();
    await exportBtn.waitFor({ state: "visible", timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      exportBtn.click(),
    ]);

    const path = await download.path();
    expect(path).toBeTruthy();
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("6.3 PDF download file opens and has content", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SINGLE_IMAGE);

    await page.getByText(/Report interpretation|Rapor/i).waitFor({ state: "visible", timeout: 90_000 });

    const exportBtn = page.getByRole("button", { name: /EXPORT REPORT|RAPORU DIŞA AKTAR|Export report|export/i }).first();
    await exportBtn.waitFor({ state: "visible", timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      exportBtn.click(),
    ]);

    const path = await download.path();
    expect(path).toBeTruthy();
    const fs = await import("fs/promises");
    const buf = await fs.readFile(path!);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
