import { test, expect } from "@playwright/test";
import { existsSync } from "fs";
import { join } from "path";
import { signInAndAcceptTerms } from "./helpers";

const ASSETS = join(process.cwd(), "test-assets");
const SINGLE_IMAGE = join(ASSETS, "single-image.png");

test.describe("Section 2 — Real Single-Image Test", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndAcceptTerms(page);
  });

  test("2.1 Skip if no test assets — add real images to test-assets/", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }
  });

  test("2.2 Upload single real image through UI", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SINGLE_IMAGE);

    // Progress / analyzing should appear
    await expect(page.getByText(/uploading|yükleme|analyzing|inceleme/i)).toBeVisible({ timeout: 5000 });

    // Wait for analysis to complete (scan complete / report visible)
    await expect(page.getByText(/scan complete|taram tamamlandı|Report interpretation|Rapor/i)).toBeVisible({
      timeout: 90_000,
    });
  });

  test("2.3 Report visible in UI after single-image analysis", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SINGLE_IMAGE);

    await expect(page.getByText(/Report interpretation|Rapor yorumlama/i)).toBeVisible({ timeout: 95_000 });
    // Summary or diagnosis section
    await expect(
      page.getByText(/Summary|Özet|diagnosis|teşhis|findings|bulgular/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
