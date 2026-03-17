# RapiMed Recovery Pass — Deliverables

**Date:** 2026-03-16

---

## 1. Regression Sources Found

| Source | Location | Fix |
|--------|----------|-----|
| **Extraction unparseable** | `googleHealthcare.runExtraction` → `extractJSONFromText` | Robust parsing + fallback object |
| **Multi-image hang** | 27 images = 80+ sequential Vertex calls | Cap at 5 processed, 100s timeout |
| **DICOM hang** | 24 slices × Vertex + synthesis | 6 slices, 30 ingest cap |
| **PDF UX mismatch** | UploadZone accepts PDF, API rejects | Removed PDF from accept |

---

## 2. Features Disabled or Rolled Back

| Feature | Change |
|---------|--------|
| PDF upload | Removed from `accept` attribute |
| Large image batch | Reject >10 images; process max 5 |
| Large DICOM | Ingest cap 30, analyze 6 slices |
| Literature search | Only for ≤2 images |
| Previous limits | MAX_IMAGES 50→10, DICOM 150→30, slices 24→6 |

---

## 3. Current Stable Product Scope

- **Single JPG/PNG:** Supported
- **JPG/PNG batch:** Max 10, first 5 processed
- **Single DICOM:** Supported
- **DICOM batch:** Max 30 ingest, 6 slices analyzed
- **PDF export:** Supported (when report exists)
- **My Reports:** Supported
- **PDF upload, report OCR, mixed+PDF:** Disabled

---

## 4. Extraction Parsing Fixes

**File:** `src/lib/googleHealthcare.ts`

- **Multiple strategies:** Fences, brace matching, regex `{...}`
- **Fallback on parse failure:** Return controlled object instead of throw:
  ```js
  { diagnosis: "Interpretation could not be extracted...", findings: "Limited visibility...", limitations: [...], severity: "medium", affected_organ: "Unknown" }
  ```
- **Dev logging:** Raw preview logged when parse fails

---

## 5. Hanging Analysis Fixes

| Fix | Location |
|-----|----------|
| Phase timeout 100s | Image loop in `/api/analyze` — break and use partial results |
| Process cap 5 | `imagesToProcess.slice(0, STABLE_MAX_PROCESS)` |
| DICOM slice cap 6 | `studyImageAnalyzer.ts` |
| DICOM ingest cap 30 | `dicomAnalysisPipeline.ts` |
| Phase timing logs | `logPhase()` in analyze route and DICOM pipeline |

---

## 6. Test Results (A–F)

| Test | Type | Pass/Fail | Notes |
|------|------|-----------|-------|
| **A** | Single JPG | **PASS** | ~1.9s |
| **B** | 5 JPGs | **PASS** | Fast path (insufficient-data or limited) for minimal 64×64 test images |
| **C** | 27 JPGs | **REJECT** | By design: max 10 images for stability |
| **D** | Single DICOM | **SKIP** | No DICOM sample (set DICOM_SAMPLE) |
| **E** | 10 DICOM | **SKIP** | No DICOM sample |
| **F** | 47 DICOM | **SKIP** | No DICOM sample |

**Image route:** `/api/analyze` (multipart)  
**DICOM route:** `/api/dicom/analyze` (multipart)

To run DICOM tests: `DICOM_SAMPLE=path/to/sample.dcm npm run upload-batch-test`

---

## 7. Intentionally Disabled Features

- PDF upload and document extraction
- Report screenshot OCR (returns "not supported")
- Mixed image + PDF
- Batches >10 images
- DICOM >30 slices ingest

---

## Files Changed

| File | Changes |
|------|---------|
| `src/lib/googleHealthcare.ts` | Robust extraction, fallback on parse fail |
| `src/app/api/analyze/route.ts` | STABLE_MAX_PROCESS=5, MAX_IMAGES=10, phase timing, 100s timeout, literature ≤2 |
| `src/lib/dicomAnalysisPipeline.ts` | MAX_DICOM_SLICES_INGEST=30, phase timing |
| `src/lib/dicom/studyImageAnalyzer.ts` | MAX_SLICES_TO_ANALYZE=6 |
| `src/features/diagnosis/components/UploadZone.tsx` | Removed PDF from accept |
| `scripts/upload-batch-test.mjs` | Test sizes 1,5,27 and 1,10,47 |
| `docs/STABLE_SCOPE.md` | New |
| `docs/RECOVERY_DELIVERABLES.md` | New |
