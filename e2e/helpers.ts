import { Page } from "@playwright/test";

/**
 * Sign in with real Firebase auth (Google or email).
 * Demo mode has been removed; tests require a real authenticated user.
 * For CI: use a test account and stored auth state if available.
 */
export async function signInAndAcceptTerms(
  page: Page,
  options?: { email?: string; password?: string }
) {
  await page.goto("/login");
  if (options?.email && options?.password) {
    await page.getByPlaceholder(/name@example|email/i).fill(options.email);
    await page.getByPlaceholder(/password|••••••/i).fill(options.password);
    await page.getByRole("button", { name: /Sign In/i }).click();
  } else {
    await page.getByRole("button", { name: /Continue with Google|Google/i }).click();
    // Google OAuth popup/redirect - tests must handle externally or use stored state
  }
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  const termsModal = page.getByRole("heading", { name: /Terms of Use/i });
  if (await termsModal.isVisible()) {
    const scrollArea = page.locator("[class*='overflow-y-auto'][class*='overscroll']").first();
    await scrollArea.evaluate((el) => {
      (el as HTMLElement).scrollTop = (el as HTMLElement).scrollHeight;
    });
    await page.waitForTimeout(500);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /Agree and Continue|Accept|Kabul|Devam/i }).click();
    await page.waitForTimeout(1500);
  }
}
