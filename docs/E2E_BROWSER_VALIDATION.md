# RapiMed — Real Browser E2E Validation

This document describes the **real browser end-to-end validation** setup for RapiMed. Automated Playwright tests and a manual runbook cover all flows requested.

---

## What Was Delivered

### 1. Playwright E2E Test Suite

- **`playwright.config.ts`** — Base URL, Chromium, 120s timeout, screenshots on failure
- **`e2e/helpers.ts`** — `signInDemoAndAcceptTerms()` for auth + Terms modal
- **`e2e/01-auth.spec.ts`** — Authenticated session (Demo Mode, dashboard, no demo banner)
- **`e2e/02-single-image.spec.ts`** — Single-image upload, report visibility
- **`e2e/03-multi-file.spec.ts`** — Multi-file upload, study adequacy
- **`e2e/04-report-screenshot.spec.ts`** — Report screenshot / OCR path
- **`e2e/05-mixed-fusion.spec.ts`** — Mixed image + report fusion
- **`e2e/06-pdf-export.spec.ts`** — PDF download, content verification
- **`e2e/07-report-chat.spec.ts`** — Report-aware chat, no provider errors
- **`e2e/08-credits.spec.ts`** — Credits visibility, persistence after refresh
- **`e2e/09-firestore-reports.spec.ts`** — My Reports, reopen, persistence

### 2. Test Assets

- **`scripts/generate-test-assets.mjs`** — Generates 100x100+ PNGs via Sharp (non-1x1)
- **`test-assets/README.md`** — How to add or generate assets
- **`npm run test-assets`** — Run asset generation

### 3. Manual Runbook

- **`docs/E2E_MANUAL_TEST_RUNBOOK.md`** — Step-by-step manual validation for all 10 sections

---

## How to Run Browser E2E Tests

### Prerequisites

- Node 18+
- App dependencies installed (`npm install`)
- Firebase/Vertex configured if testing real analysis (API keys, `credentials/google-key.json`)

### Quick Start

```bash
# 1. Generate test assets (100x100+ PNGs)
npm run test-assets

# 2. Start the app
npm run dev

# 3. In another terminal, run E2E
npm run e2e
```

### Options

```bash
# Run with UI mode
npm run e2e:ui

# Run specific file
npx playwright test e2e/01-auth.spec.ts

# Run with custom base URL
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run e2e
```

### Test Behavior

- **Auth**: Uses Demo Mode (no real Firebase). Terms modal is accepted automatically.
- **File uploads**: Uses files from `test-assets/`. Tests skip if assets are missing.
- **Analysis**: Calls real `/api/analyze`. Requires Vertex/Anthropic and sufficient credits.
- **Timeouts**: Analysis tests use 90–120s to allow AI inference.

---

## Expected PASS/FAIL Matrix

| Flow | Automated Test | Manual Runbook |
|------|----------------|----------------|
| Authenticated sign-in | `01-auth.spec.ts` | Section 1 |
| Single-image upload | `02-single-image.spec.ts` | Section 2 |
| Multi-file upload | `03-multi-file.spec.ts` | Section 3 |
| Report screenshot OCR | `04-report-screenshot.spec.ts` | Section 4 |
| Mixed fusion | `05-mixed-fusion.spec.ts` | Section 5 |
| Firestore persistence | `09-firestore-reports.spec.ts` | Section 9 |
| My Reports loading | `09-firestore-reports.spec.ts` | Section 9 |
| PDF export | `06-pdf-export.spec.ts` | Section 6 |
| Report chat | `07-report-chat.spec.ts` | Section 7 |
| Credits deduction | `08-credits.spec.ts` | Section 8 |

---

## Limitations

1. **Demo Mode**: Tests use Demo Mode. Real Firebase auth is covered in the manual runbook.
2. **Firestore**: Demo mode may use localStorage for reports; Firestore persistence is validated manually or with a real user.
3. **OCR/Fusion**: Logic is covered; actual OCR quality depends on Vertex Document AI / model behavior.
4. **Analysis**: Tests hit the real API. Vertex/Anthropic must be configured. Failures may be due to credentials, quotas, or model availability.

---

## Evidence Capture

For failures, capture:

- **Browser console**: F12 → Console → right-click → Save as
- **Network**: F12 → Network → filter by `analyze` / `report-chat` → Export HAR
- **Screenshots**: Playwright saves to `test-results/` on failure
- **Firestore**: Firebase Console → Firestore → document snapshot

---

## Output Format (Manual Validation)

When running the manual runbook, fill in the structure from `E2E_MANUAL_TEST_RUNBOOK.md`:

1. Authenticated Session Result
2. Single-Image Browser Test
3. Multi-File Browser Test
4. Report Screenshot Test
5. Mixed Fusion Test
6. PDF Export Test
7. Report Chat Test
8. Credits Test
9. Firestore / Reports Test
10. Top 10 Failures Found
11. PASS/FAIL Table
