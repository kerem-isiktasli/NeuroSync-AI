# RapiMed Stable Product Scope (Recovery Pass)

**Date:** 2026-03-16  
**Priority:** Reliability over breadth

---

## Current Stable Scope (Post-Recovery)

| Capability | Status | Limits |
|------------|--------|--------|
| **Single JPG/PNG** | ✅ Active | Supported |
| **JPG/PNG batch** | ✅ Active | Max 10 upload, first 5 processed |
| **Single DICOM** | ✅ Active | Supported |
| **DICOM batch** | ✅ Active | Max 30 ingest, 6 slices analyzed |
| **PDF export** | ✅ Active | Works when report generated |
| **My Reports** | ✅ Active | Firestore persistence |
| **Report chat** | ✅ Active | Context-aware |
| **PDF upload** | ❌ Disabled | Removed from accept list |
| **Report OCR** | ❌ Disabled | Returns "OCR not supported" |
| **Mixed (image+PDF)** | ❌ Disabled | PDF rejected |
| **Literature search** | ⚠️ Limited | Only for ≤2 images |

---

## Regression Sources Identified

1. **Extraction unparseable** — Vertex sometimes returns non-JSON or malformed JSON
   - *Fix:* Robust `extractJSONFromText` + fallback extraction object instead of throw

2. **Multi-image hang** — 27+ images = 27 intake + 27×(classify+extract) = 80+ Vertex calls
   - *Fix:* Cap at 5 processed images, phase timeout 100s

3. **DICOM hang** — 24 slices analyzed = 24 Vertex + synthesis; 47 files = long assembly
   - *Fix:* 6 slices analyzed, 30 ingest cap

4. **PDF in accept** — UI allowed PDF selection but API rejects
   - *Fix:* Removed PDF from accept

---

## Features Intentionally Disabled

- PDF upload / document extraction
- Report screenshot OCR (returns honest "not supported")
- Mixed image+PDF upload
- Large batch processing (27, 47+ images)

---

## Env Overrides (Optional)

- `MAX_DICOM_SLICES_ANALYZED` — default 6
- `MAX_DICOM_SLICES_FOR_AI` — default 30
- `STABLE_MAX_PROCESS` — hardcoded 5 in route; increase after validation
