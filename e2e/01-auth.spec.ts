import { test, expect } from "@playwright/test";
import { signInAndAcceptTerms } from "./helpers";

test.describe("Section 1 — Authenticated Session", () => {
  test("1.1 Login page loads, demo mode removed", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: /Continue with Google|Google/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Demo Mode/i })).not.toBeVisible();
  });

  test("1.2 Dashboard loads correctly after auth", async ({ page }) => {
    test.skip(true, "Requires real Firebase auth — use TEST_EMAIL/TEST_PASSWORD or stored auth state");
    await signInAndAcceptTerms(page);
    await expect(page.getByText(/Report center|Report center/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/encrypted and private|Upload a scan|tarama yükleyin/i)).toBeVisible({ timeout: 5_000 });
  });

  test("1.3 User sees dashboard after auth", async ({ page }) => {
    test.skip(true, "Requires real Firebase auth");
    await signInAndAcceptTerms(page);
    const demo = await page.evaluate(() => localStorage.getItem("neurosync_demo_mode"));
    expect(demo).toBe("true");
    await page.locator("aside").first().hover();
    await page.waitForTimeout(500);
    await expect(page.getByText(/Dashboard/i).first()).toBeVisible();
  });
});
