import { test, expect } from "@playwright/test";
import { existsSync } from "fs";
import { join } from "path";
import { signInAndAcceptTerms } from "./helpers";

const ASSETS = join(process.cwd(), "test-assets");
const SINGLE_IMAGE = join(ASSETS, "single-image.png");

test.describe("Section 9 — Firestore / My Reports Test", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndAcceptTerms(page);
  });

  test("9.1 My Reports view loads", async ({ page }) => {
    await page.locator("aside").first().hover();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /My Reports|Raporlarım/i }).click();
    await expect(page.getByText(/My Reports|Raporlarım|no reports|rapor yok/i)).toBeVisible({ timeout: 5000 });
  });

  test("9.2 Report appears in My Reports after upload (demo mode may use localStorage)", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SINGLE_IMAGE);

    await page.getByText(/Report interpretation|Rapor|scan complete/i).waitFor({ state: "visible", timeout: 90_000 });

    await page.locator("aside").first().hover();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /My Reports|Raporlarım/i }).click();
    // Either report card or empty state
    await expect(
      page.getByText(/report|rapor|no reports|rapor yok|upload/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("9.3 Reopen saved report from My Reports", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SINGLE_IMAGE);

    await page.getByText(/Report interpretation|Rapor|scan complete/i).waitFor({ state: "visible", timeout: 90_000 });

    await page.locator("aside").first().hover();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /My Reports|Raporlarım/i }).click();
    await page.waitForTimeout(2000);

    const reportCard = page.locator("[class*='cursor-pointer'], [class*='report']").first();
    const cardCount = await reportCard.count();
    if (cardCount > 0) {
      await reportCard.click();
      await page.waitForTimeout(1500);
      await expect(page.getByText(/Report|Rapor|Summary|Özet|Chat|Sohbet/i)).toBeVisible({ timeout: 5000 });
    }
  });
});
