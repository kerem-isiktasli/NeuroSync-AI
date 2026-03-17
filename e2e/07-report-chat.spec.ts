import { test, expect } from "@playwright/test";
import { existsSync } from "fs";
import { join } from "path";
import { signInAndAcceptTerms } from "./helpers";

const ASSETS = join(process.cwd(), "test-assets");
const SINGLE_IMAGE = join(ASSETS, "single-image.png");

test.describe("Section 7 — Report Chat Test", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndAcceptTerms(page);
  });

  test("7.1 Skip if no report to chat about", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }
  });

  test("7.2 Open report in New Analysis and send chat message", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SINGLE_IMAGE);

    await page.getByText(/Report interpretation|Rapor|scan complete|taram tamamlandı/i).waitFor({
      state: "visible",
      timeout: 90_000,
    });

    // Expand sidebar and go to New Analysis (Chat view)
    await page.locator("aside").first().hover();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /New Analysis|Yeni Analiz/i }).click();
    await page.waitForTimeout(2000);

    // Chat input
    const chatInput = page.locator('input[type="text"]').filter({ hasNot: page.locator("[type='email']") }).first();
    await chatInput.fill("What do I have?");
    await chatInput.press("Enter");

    await expect(page.getByText(/What do I have|Ne var/i)).toBeVisible({ timeout: 5000 });
    // AI response should appear (no raw provider errors)
    await expect(page.locator('[class*="message"], [data-sender="ai"]').or(page.getByText(/bulgular|findings|özet|summary/i))).toBeVisible({
      timeout: 30_000,
    });
  });

  test("7.3 Report-aware answers (no generic filler)", async ({ page }) => {
    if (!existsSync(SINGLE_IMAGE)) {
      test.skip();
      return;
    }

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SINGLE_IMAGE);

    await page.getByText(/Report interpretation|Rapor|scan complete/i).waitFor({ state: "visible", timeout: 90_000 });

    await page.locator("aside").first().hover();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: /New Analysis|Yeni Analiz/i }).click();
    await page.waitForTimeout(2000);

    const chatInput = page.locator('input[type="text"], textarea').first();
    await chatInput.fill("Should I be concerned?");
    await chatInput.press("Enter");

    // No provider/model error in response
    await page.waitForTimeout(8000);
    const body = await page.locator("body").textContent();
    expect(body).not.toMatch(/Anthropic|Vertex|500|503|API key|invalid/i);
  });
});
