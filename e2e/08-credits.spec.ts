import { test, expect } from "@playwright/test";
import { signInAndAcceptTerms } from "./helpers";

test.describe("Section 8 — Credits Test", () => {
  test.beforeEach(async ({ page }) => {
    await signInAndAcceptTerms(page);
  });

  test("8.1 Credits visible in UI", async ({ page }) => {
    await page.hover(page.locator("aside").first());
    await page.waitForTimeout(500);
    const creditsText = page.getByText(/credits|kredi/i).first();
    await expect(creditsText).toBeVisible({ timeout: 5000 });
    const num = page.locator("aside").getByText(/\d+/).first();
    await expect(num).toBeVisible();
  });

  test("8.2 Credits persist after refresh", async ({ page }) => {
    await page.hover(page.locator("aside").first());
    await page.waitForTimeout(500);
    const before = await page.locator("aside").getByText(/\d+/).first().textContent();

    await page.reload();
    await page.waitForURL(/\/dashboard/);
    await page.hover(page.locator("aside").first());
    await page.waitForTimeout(500);
    const after = await page.locator("aside").getByText(/\d+/).first().textContent();

    expect(after).toBe(before);
  });
});
