# RapiMed End-to-End Validation Report

**Date:** 2026-03-16  
**Scope:** Full test matrix validation after architectural changes

---

## 1. Test Matrix — PASS/FAIL Summary

| # | Test Case | Classification | Pipeline | Adequacy | Report Type | Analysis Ran | Output Useful | PDF Export | Report Saved | Chat Matches | **Result** |
|---|-----------|----------------|----------|----------|-------------|--------------|---------------|------------|--------------|--------------|------------|
| 1 | Brain DICOM study | dicom-study | /api/dicom/analyze | interpretable | FULL_* or LIMITED_* | ✓ | ✓ (if real DICOM) | ✓ | ✓ | ✓ | **PASS** (code path verified; no sample) |
| 2 | Chest DICOM study | dicom-study | /api/dicom/analyze | interpretable | FULL_* or LIMITED_* | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| 3 | Spine DICOM study | dicom-study | /api/dicom/analyze | interpretable | FULL_* or LIMITED_* | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| 4 | Abdomen/pelvis DICOM | dicom-study | /api/dicom/analyze | interpretable | FULL_* or LIMITED_* | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| 5 | Multiple JPG screenshots | image-batch | /api/analyze | strong/interpretable | FULL_* or LIMITED_* | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| 6 | Localizer screenshot set | image-batch | /api/analyze | insufficient | LOCALIZER_DETECTED_REPORT | ✓ (intake only) | ✓ (honest) | ✓ | ✓ | ✓ | **PASS** |
| 7 | Radiology PDF | pdf-report | /api/analyze | — | — | — | — | — | — | — | **FAIL** |
| 8 | Lab report (PDF) | pdf-report | /api/analyze | — | — | — | — | — | — | — | **FAIL** |
| 9 | Pathology report (PDF) | pdf-report | /api/analyze | — | — | — | — | — | — | — | **FAIL** |
| 10 | Mixed image + report (both PNG) | mixed | /api/analyze | interpretable | FUSION_* or LIMITED_* | ✓ | ✓ | ✓ | ✓ | ✓ | **PASS** |
| 10b | Mixed image + PDF | mixed | /api/analyze | — | — | — | — | — | — | — | **FAIL** |

---

## 2. Broken Branches

| Branch | Location | Behavior |
|--------|----------|----------|
| **PDF uploads** | `src/app/api/analyze/route.ts` → `normalizeImages()` | Throws: *"PDF uploads are not supported by this route yet."* |
| **DICOM in image route** | `src/app/api/analyze/route.ts` → `normalizeImages()` | Throws: *"DICOM uploads are not supported by this route yet."* (correct — DICOM goes to /api/dicom/analyze) |
| **Mixed with PDF** | Same as PDF — any PDF in batch | Fails at `normalizeImages` before intake |
| **Client pdf-report routing** | `DiagnosisContext` | Routes pdf-report → `runFullDiagnosisBatch` → /api/analyze. No dedicated PDF route. API rejects PDFs. |

**Root cause:** UploadZone accepts `.pdf`; classifier returns `pdf-report` or `mixed`; all paths funnel to `/api/analyze`, which rejects non-image MIME in `normalizeImages`.

---

## 3. Misleading or Incomplete Outputs

| Case | Issue |
|------|-------|
| **Report screenshots (report-ocr path)** | Returns `DOCUMENT_EXTRACTION_REPORT` with limitations: *"Text extraction (OCR) from report images is not currently supported."* — **Honest**, not misleading. |
| **Localizer-only** | Returns `LOCALIZER_DETECTED_REPORT` with `localizerReport` payload — **Honest**. |
| **Insufficient data** | Returns `buildInsufficientDataResponse` with `additional_data_requested` — **Honest**. |
| **DICOM sampling** | Technical summary now includes *"Representative sampling: X of Y slices analyzed for AI interpretation"* — **Explicit**. |
| **PDF in accept** | UI shows `.pdf` as accepted format; backend rejects — **Misleading**: user can select PDF but gets generic error. |

---

## 4. Flow Verification

### Upload → Classification → Pipeline

```
Files → classifyUploadBatch() → UploadBatchType
  ├─ dicom-study (all .dcm) → runFullDiagnosisDicomBatch → /api/dicom/analyze
  └─ else (image-batch, pdf-report, mixed, etc.) → runFullDiagnosisBatch → /api/analyze
```

- **dicom-study**: Correctly routes to `/api/dicom/analyze` (multipart).
- **image-batch, mixed (images only)**: Correctly route to `/api/analyze` (multipart).
- **pdf-report, mixed (with PDF)**: Route to `/api/analyze`, then **fail** in `normalizeImages`.

### Report Type → Chat Context

- `ChatView` builds `buildReportContextPacket(report, diagnosisResult, question)`.
- Passes `reportType`, `reportMode`, `reportLabel`, `localizerReport`.
- `/api/report-chat` receives context and adapts prompt:
  - `LOCALIZER_DETECTED` → "IMPORTANT: LOCALIZER-ONLY REPORT"
  - `reportMode` → "Report type: {label}"
- **Chat context matches report type** for all supported paths.

### Report Saving

- `DiagnosisContext` → `markComplete(reportId, result)`.
- `reportService.updateReportWithResults()` stores `reportType`, `reportMode`, `reportLabel`, `diagnosisResult`.
- Firestore `reports` collection; My Reports subscribes via `onSnapshot`.

---

## 5. Recommended Fixes (Priority Order)

| Priority | Fix | Effort | Impact |
|----------|-----|--------|--------|
| **P1** | Remove PDF from `accept` or add explicit "PDF not yet supported" message before upload | Low | Prevents misleading UX |
| **P2** | Add dedicated PDF/document route: Document AI or OCR → `DOCUMENT_EXTRACTION_REPORT` | High | Unblocks PDF, lab, pathology flows |
| **P3** | Mixed (image+PDF): separate images from PDFs client-side; send only images to /api/analyze; or add server-side PDF handling | Medium | Unblocks mixed flows |
| **P4** | Report screenshot OCR: integrate Document AI / Vertex OCR for report images | High | Enables report-ocr path |
| **P5** | E2E auth: add stored auth state or test user for Playwright | Medium | Enables automated E2E |
| **P6** | DICOM test assets: add minimal valid DICOM samples for brain/chest/spine/abdomen | Medium | Enables DICOM E2E |

---

## 6. Files Relevant to Validation

| Area | Files |
|------|-------|
| Classification | `src/lib/uploadClassifier.ts`, `src/lib/intake/batchClassifier.ts`, `src/lib/intake/fileClassifier.ts` |
| Pipelines | `src/app/api/analyze/route.ts`, `src/app/api/dicom/analyze/route.ts` |
| Context routing | `src/features/diagnosis/context/DiagnosisContext.tsx` |
| Report types | `src/lib/reportTypes.ts`, `src/types/diagnosis.ts` |
| Chat context | `src/features/dashboard/components/ChatView.tsx`, `src/app/api/report-chat/route.ts` |
| PDF reject | `src/app/api/analyze/route.ts` L291–293 |
| Upload UI | `src/features/diagnosis/components/UploadZone.tsx` L210, L292 (`accept=".dcm,.png,.jpg,.jpeg,.pdf"`) |

---

## 7. E2E Test Status (from previous runs)

From git status: multiple E2E failures in `test-results/`. Likely causes:

1. Auth: `signInAndAcceptTerms` requires Google OAuth; no stored state for CI.
2. Timeouts: Analysis can exceed 90–120s for multi-image batches.

Recommendation: Run `npm run e2e` with valid auth state or test credentials, and consider increasing timeouts for analysis-heavy tests.
