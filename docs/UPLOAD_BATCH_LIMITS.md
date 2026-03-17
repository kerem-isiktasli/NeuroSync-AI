# Upload & Analysis Batch Limits

Production-grade limits for image and DICOM batches.

## Supported Limits

| Input Type | Max Count | Per-Item Limit | Notes |
|-----------|-----------|----------------|-------|
| JPG/PNG screenshots | 50 | 20 MB each | Multipart FormData |
| DICOM slices | 150 (ingest) | 1 GB total study | 24 slices analyzed (representative sampling) |

## Transport Architecture

- **Images (JPG/PNG)**: `POST /api/analyze` — **multipart/form-data**
  - Fields: `images` (File[]), `language`, `scholarData` (optional)
  - Fallback: JSON body with `images: [{ imageBase64, fileName }]` for single-image or small batches

- **DICOM**: `POST /api/dicom/analyze` — **multipart/form-data**
  - Fields: `files` or `files[]` (File[]), `language`, `scholarData` (optional)

## Representative Sampling (DICOM)

When `totalAnalyzed < totalUsable`, the report explicitly states:

- **English**: "Representative sampling: X of Y slices analyzed for AI interpretation."
- **Turkish**: "Temsili örnekleme: X/Y kesit AI yorumu için incelendi."

This appears in:
- `report_sections.technical_summary`
- `report_sections.limitations` (when sampling applies)

## Test Script

```bash
npm run upload-batch-test
```

- **Image tests**: 5, 27, 50 JPG — generates and POSTs via multipart
- **DICOM tests**: Set `DICOM_SAMPLE=path/to/sample.dcm` to enable 3, 27, 47, 100 slice tests

Requires dev server: `npm run dev`

## Files Changed

| File | Changes |
|------|---------|
| `src/app/api/analyze/route.ts` | Multipart support, `maxDuration=300`, `MAX_IMAGES=50`, pre-existing `summary` key fix |
| `src/services/core-bridge.ts` | `analyzeStudyBatch` uses FormData (multipart), `base64ToBlob` helper, ReportMode casting |
| `src/lib/dicomAnalysisPipeline.ts` | `MAX_DICOM_SLICES_INGEST=150`, explicit sampling notice in `technical_summary` and `limitations` |
| `src/lib/dicom/studyImageAnalyzer.ts` | `MAX_SLICES_TO_ANALYZE=24` |
| `scripts/upload-batch-test.mjs` | New batch test script |
| `package.json` | `upload-batch-test` script |

## Environment Overrides

- `MAX_DICOM_SLICES_FOR_AI` — ingest cap (default 150)
- `MAX_DICOM_SLICES_ANALYZED` — slices analyzed for AI (default 24)
