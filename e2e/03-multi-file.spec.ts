import { test, expect } from "@playwright/test";
import { existsSync } from "fs";
import { join } from "path";
import { signInAndAcceptTerms } from "./helpers";

const ASSETS = join(process.cwd(), "test-assets");
const MULTI1 = join(ASSETS, "multi-1.png");
const MULTI2 = join(ASSETS, "multi-2.png");

test.describe("Section 3 — Real Multi-File Test", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndAcceptTerms(page);
  });

  test("3.1 Skip if no multi-file assets", async ({ page }) => {
    if (!existsSync(MULTI1) || !existsSync(MULTI2)) {
      test.skip();
      return;
    }
  });

  test("3.2 Upload multiple real images", async ({ page }) => {
    if (!existsSync(MULTI1) || !existsSync(MULTI2)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([MULTI1, MULTI2]);

    await expect(page.getByText(/uploading|yükleme|analyzing|inceleme|dosya/i)).toBeVisible({ timeout: 5000 });

    await expect(page.getByText(/scan complete|taram tamamlandı|Report interpretation|Rapor/i)).toBeVisible({
      timeout: 120_000,
    });
  });

  test("3.3 Report shows study adequacy or multi-image content", async ({ page }) => {
    if (!existsSync(MULTI1) || !existsSync(MULTI2)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([MULTI1, MULTI2]);

    await expect(page.getByText(/Report interpretation|Rapor/i)).toBeVisible({ timeout: 120_000 });
    // Multi-file may produce study adequacy / anatomical specificity
    const hasRelevantContent = await page
      .locator("[class*='report'], [class*='diagnosis'], [class*='findings']")
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasRelevantContent || await page.getByText(/Summary|Özet|findings|bulgular/i).first().isVisible()).toBeTruthy();
  });
});
