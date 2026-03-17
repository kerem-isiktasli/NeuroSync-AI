# Intake Layer — Test Scenarios

This document describes manual test scenarios for the pre-analysis intake layer.

## Prerequisites

- Development server running: `npm run dev`
- Valid Vertex AI credentials (`credentials/google-key.json`)
- Demo mode enabled for credits: `localStorage.setItem("neurosync_demo_mode", "1")`

---

## Test Scenarios

### 1. Single Diagnostic Image

**Setup:** Upload one clear MRI/CT slice (sagittal or axial).

**Expected:**
- `upload_type`: diagnostic-image
- `studyAdequacy`: partial
- `recommendedPipeline`: image-analysis
- Full interpretation proceeds
- Report shows normal findings

**Verify:** Check browser console for `phase: "intake-complete"` log. No early exit.

---

### 2. Multiple Diagnostic Images

**Setup:** Upload 2–4 diagnostic slices from the same study (e.g. sagittal + axial).

**Expected:**
- `upload_type`: diagnostic-image for each
- `studyAdequacy`: diagnostic
- `recommendedPipeline`: image-analysis
- Cross-image reconciliation runs
- Report combines findings from multiple planes

**Verify:** Log shows `cross-image-reconciliation` phase. Report has higher specificity.

---

### 3. Localizer-Heavy MRI Screenshots

**Setup:** Upload localizer/scout images only (planning views with reference lines, numbers).

**Expected:**
- `upload_type`: localizer
- `studyAdequacy`: localizer-only
- `recommendedPipeline`: insufficient-data
- Early exit with `buildInsufficientDataResponse`
- Message: "The uploaded images are not sufficient for diagnostic interpretation"
- Suggests uploading diagnostic slices

**Verify:** No Vertex classification/extraction. Immediate result with clear limitations.

---

### 4. Screenshots of Written Radiology Report

**Setup:** Upload a screenshot or photo of a typed/printed radiology report (text-heavy).

**Expected:**
- `upload_type`: report-image
- `contains_report_text`: true
- `studyAdequacy`: report-only
- `recommendedPipeline`: report-ocr
- Early exit with `buildReportOnlyResponse`
- Message: "The uploaded content appears to be a screenshot or photo of a written medical report"
- OCR not supported — suggests uploading diagnostic images

**Verify:** No Vertex analysis. Report explicitly states OCR is not available.

---

### 5. Mixed Upload: Report Screenshot + MRI Screenshot

**Setup:** Upload both a report screenshot and a diagnostic MRI slice.

**Expected:**
- `upload_type`: diagnostic-image (MRI), report-image (report)
- `studyAdequacy`: mixed
- `recommendedPipeline`: fusion
- Only the diagnostic image is processed
- Report image is skipped (not interpreted as a scan)
- Limitations mention report images were detected but not processed via OCR

**Verify:** Log shows `intake-filter` with 1 processed, 1 skipped. Report includes "Report screenshot(s) detected" in Upload Assessment.

---

### 6. Poor-Quality Non-Diagnostic Upload

**Setup:** Upload blurry, cropped, or very low-resolution images.

**Expected:**
- `upload_type`: non-diagnostic or unknown
- `diagnostic_value`: low or none
- `studyAdequacy`: non-diagnostic
- `recommendedPipeline`: insufficient-data
- Early exit with `buildInsufficientDataResponse`

**Verify:** Clear message about insufficient quality. Suggests higher quality images.

---

## Unit Tests

```bash
npm run test
# or
npx vitest run src/lib/ai/__tests__/studyIntake.test.ts
```

Tests cover:
- `buildStudyIntakeSummary` for all 6 scenarios
- `getDiagnosticImageIndices` filtering
- `getReportImageIndices` filtering

---

## Pipeline Flow Summary

| recommendedPipeline  | diagnosticCount | Action                                           |
|---------------------|-----------------|--------------------------------------------------|
| report-ocr          | 0               | Return report-only message (no OCR)              |
| insufficient-data   | 0               | Return insufficient-data message                 |
| image-analysis      | ≥1              | Process diagnostic images only                   |
| fusion              | ≥1              | Process diagnostic images; note report images     |
