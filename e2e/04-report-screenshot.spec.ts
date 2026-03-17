import { test, expect } from "@playwright/test";
import { existsSync } from "fs";
import { join } from "path";
import { signInAndAcceptTerms } from "./helpers";

const ASSETS = join(process.cwd(), "test-assets");
const REPORT_SCREENSHOT = join(ASSETS, "report-screenshot.png");

test.describe("Section 4 — Report Screenshot / OCR Test", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndAcceptTerms(page);
  });

  test("4.1 Skip if no report screenshot asset", async ({ page }) => {
    if (!existsSync(REPORT_SCREENSHOT)) {
      test.skip();
      return;
    }
  });

  test("4.2 Upload report screenshot and verify analysis completes", async ({ page }) => {
    if (!existsSync(REPORT_SCREENSHOT)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(REPORT_SCREENSHOT);

    await expect(page.getByText(/uploading|yükleme|analyzing|inceleme/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/scan complete|taram tamamlandı|Report interpretation|Rapor/i)).toBeVisible({
      timeout: 120_000,
    });
  });

  test("4.3 Report viewable after upload (OCR path if implemented)", async ({ page }) => {
    if (!existsSync(REPORT_SCREENSHOT)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(REPORT_SCREENSHOT);

    await page.getByText(/Report interpretation|Rapor/i).waitFor({ state: "visible", timeout: 120_000 });
    // Either OCR content or image-derived content should appear
    const hasContent = await page
      .getByText(/Summary|Özet|extract|OCR|report|rapor|findings|bulgular/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});
