import { test, expect } from "@playwright/test";
import { existsSync } from "fs";
import { join } from "path";
import { signInAndAcceptTerms } from "./helpers";

const ASSETS = join(process.cwd(), "test-assets");
const IMAGE = join(ASSETS, "mixed-image.png");
const REPORT = join(ASSETS, "report-screenshot.png");

test.describe("Section 5 — Mixed Fusion Test", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndAcceptTerms(page);
  });

  test("5.1 Skip if mixed assets missing", async ({ page }) => {
    if (!existsSync(IMAGE) || !existsSync(REPORT)) {
      test.skip();
      return;
    }
  });

  test("5.2 Upload image + report screenshot (mixed)", async ({ page }) => {
    if (!existsSync(IMAGE) || !existsSync(REPORT)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([IMAGE, REPORT]);

    await expect(page.getByText(/uploading|yükleme|analyzing|inceleme|dosya/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/scan complete|taram tamamlandı|Report interpretation|Rapor/i)).toBeVisible({
      timeout: 150_000,
    });
  });

  test("5.3 Final report reflects fusion if implemented", async ({ page }) => {
    if (!existsSync(IMAGE) || !existsSync(REPORT)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles([IMAGE, REPORT]);

    await page.getByText(/Report interpretation|Rapor/i).waitFor({ state: "visible", timeout: 150_000 });
    // Fusion may show: agreement, mismatch, evidence summary
    const hasContent = await page
      .getByText(/Summary|Özet|agreement|uyum|mismatch|fusion|evidence|findings|bulgular/i)
      .first()
      .isVisible()
      .catch(() => false);
    expect(hasContent).toBeTruthy();
  });
});
