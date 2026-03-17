# RapiMed — Manual E2E Browser Validation Runbook

This runbook guides manual end-to-end validation using the real browser UI, real authenticated users, and real uploaded files. Use it when automated Playwright tests cannot run (e.g., no test assets, or you need human verification).

---

## Prerequisites

- App running: `npm run dev`
- Real Firebase-authenticated user **or** Demo Mode for smoke testing
- Real medical images (PNG/JPG) and optionally a report screenshot
- Browser DevTools (F12) for console/network capture

---

## Section 1 — Authenticated Session

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `http://localhost:3000/login` | Login page loads |
| 2 | Click **Demo Mode** (or sign in with Google/email) | Redirect to `/dashboard` |
| 3 | Confirm dashboard shows "Report center" and upload zone | Dashboard loads |
| 4 | Confirm sidebar shows Credits and user area | Not in error state |
| 5 | Open DevTools → Console; note any errors | No Firestore/permission errors |

**Pass** if dashboard loads and no blocking console errors.

---

## Section 2 — Real Single-Image Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Stay on Dashboard | Upload zone visible |
| 2 | Click "Select file" / "Dosya seç" and pick one real medical image | Progress / uploading state |
| 3 | Wait for analysis | "Scan complete" / "Taram tamamlandı" |
| 4 | Confirm report panel shows Summary, findings, concern level | Report visible |
| 5 | Open DevTools → Network; filter by "analyze" | API call succeeds (200) |
| 6 | Go to **My Reports** | Report appears in list (or empty if demo/local) |
| 7 | Refresh page (F5) | Report still visible (persistence) |
| 8 | Click report in My Reports | Report opens in New Analysis / Chat |

**Pass** if upload → analysis → report → persistence → reopen all work.

---

## Section 3 — Real Multi-File Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Dashboard → Select **multiple** images (2–3) from same study | All files accepted |
| 2 | Wait for analysis | "Scan complete" |
| 3 | Inspect report | Richer content vs single-image (e.g., study adequacy, multi-image reasoning) |
| 4 | Check Firestore (or My Reports) | Report saved |
| 5 | Reopen from My Reports | Report loads |

**Judgment**: Multi-file reasoning is **broken / weak / acceptable / strong** based on:
- Presence of `study_adequacy_summary` or equivalent
- Whether findings reference multiple images

---

## Section 4 — Report Screenshot Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Upload a **screenshot/photo of a written doctor/radiology report** | Intake accepts it |
| 2 | Wait for analysis | Report generated |
| 3 | Check if OCR path ran | Network: look for OCR-related calls |
| 4 | Inspect report text | Uses extracted text if OCR wired |
| 5 | Persistence & reopen | Works as in Section 2 |

**If OCR is not working**: State clearly; note missing API calls or generic output.

---

## Section 5 — Mixed Fusion Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Upload **one medical image** + **one report screenshot** | Both accepted |
| 2 | Wait for analysis | Report generated |
| 3 | Inspect report | Reflects both image and report text if fusion wired |
| 4 | Check for agreement/mismatch section | If implemented |
| 5 | Persistence & reopen | Works |

**If fusion is not functioning**: State clearly with evidence.

---

## Section 6 — PDF Export Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Have at least one complete report on Dashboard | Report panel visible |
| 2 | Click **"EXPORT REPORT"** / **"RAPORU DIŞA AKTAR"** | PDF downloads |
| 3 | Open PDF | Opens without error |
| 4 | Verify content | Summary, findings, modality, header visible |
| 5 | Verify Turkish text (if TR locale) | Renders correctly |
| 6 | Check section order | Logical (Summary → Findings → etc.) |
| 7 | Verify no duplicated concern level | Single concern badge |
| 8 | Compare PDF content to UI report | Matches |

**Pass** if PDF opens, content visible, matches UI, Turkish renders.

---

## Section 7 — Report Chat Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open a saved report (from My Reports or after upload) | Chat view with report context |
| 2 | Send: "What do I have?" | Specific answer based on report |
| 3 | Send: "What more data do you need?" | Refers to report fields |
| 4 | Send: "Should I be concerned?" | Concern-specific answer |
| 5 | Send: "What should I ask my doctor?" | Questions from report |
| 6 | Send: "What should I do next?" | Next steps |
| 7 | Send: "Which level is affected?" | Anatomical specificity |
| 8 | Send: "Is this based on the images or the report?" | Clarifies source |

**Pass** if answers are report-aware, no raw provider errors, no generic filler; follow-ups work; context preserved.

---

## Section 8 — Credits Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Hover sidebar; note starting credits | Number visible |
| 2 | Upload a report | Credits decrease (analysis cost) |
| 3 | Ask several report-chat questions | Credits decrease (chat cost) |
| 4 | Refresh page | Credits persist (no incorrect reset) |
| 5 | If reachable: go to 0 credits | Low-credit behavior (e.g., disabled upload) |

**Pass** if upload and chat deductions work; credits persist; no stuck state.

---

## Section 9 — Firestore / Reports Test

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open Firestore Console (if applicable) | Access granted |
| 2 | Upload report; watch Firestore | Report doc created |
| 3 | Check status transitions | uploaded → processing → complete (or failed) |
| 4 | Inspect doc fields | title, modality, summary, diagnosisResult, etc. |
| 5 | My Reports query | Returns reports |
| 6 | Delete report from My Reports | Doc removed (or UI updated) |
| 7 | Reopen remaining report | Works |

**Pass** if docs created, status correct, My Reports loads, delete works.

---

## Section 10 — Final Output Format

Record results in this structure:

1. **Authenticated Session Result** — PASS/FAIL + notes  
2. **Single-Image Browser Test** — PASS/FAIL + notes  
3. **Multi-File Browser Test** — PASS/FAIL + multi-file reasoning judgment  
4. **Report Screenshot Test** — PASS/FAIL + OCR status  
5. **Mixed Fusion Test** — PASS/FAIL + fusion status  
6. **PDF Export Test** — PASS/FAIL + notes  
7. **Report Chat Test** — PASS/FAIL + notes  
8. **Credits Test** — PASS/FAIL + notes  
9. **Firestore / Reports Test** — PASS/FAIL + notes  
10. **Top 10 Failures Found** — root cause, file/function, severity, evidence  
11. **PASS/FAIL Table** (see below)

### PASS/FAIL Table

| Flow | Result | Root Cause (if FAIL) | Severity | Evidence |
|------|--------|----------------------|----------|----------|
| Authenticated sign-in | | | | |
| Single-image upload | | | | |
| Multi-file upload | | | | |
| Report screenshot OCR | | | | |
| Mixed fusion | | | | |
| Firestore persistence | | | | |
| My Reports loading | | | | |
| PDF export | | | | |
| Report chat | | | | |
| Credits deduction | | | | |

---

## Capturing Evidence

For each failure:

- **Browser console**: Copy console errors (right-click → Save as… or screenshot)
- **Network**: Export HAR or screenshot failed requests
- **Firestore**: Screenshot document or copy JSON
- **Root cause**: Identify exact file/function (e.g., `src/app/api/analyze/route.ts`, `runReportOcr`)

---

## Running Automated E2E (Playwright)

```bash
# Generate test assets
npm run test-assets

# Start app (in another terminal)
npm run dev

# Run E2E
npm run e2e
```

Tests that require assets skip cleanly if files are missing. Use real medical images for full validation.
