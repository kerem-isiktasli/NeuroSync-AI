# Part A — Root-Cause Audit: Current Failure Map

## Executive Summary

The RapiMed routing system has multiple failure points where uploads are misclassified, routed incorrectly, or produce generic/ misleading output. This document maps each failure area.

---

## 1. Where Misclassification Happens

| Location | Issue | Impact |
|----------|-------|--------|
| **uploadClassifier.ts** | Uses only file extension + MIME. No content signals. | Report screenshot (PNG/JPG) → "image-batch" instead of "report-image". Lab report PDF → "pdf-report" (correct) but no radiology vs lab vs pathology distinction. |
| **DiagnosisContext** | Binary split: dicom-study vs everything else. | PDF-only, mixed (PDF+image), lab, pathology all sent to same /api/analyze path. |
| **isDicomBatch** (route.ts) | Checks MIME + buffer magic bytes. | DICOM files with wrong extension (e.g. .img) may not be detected if MIME is generic. |
| **Per-image intake** | Runs only AFTER images are normalized. | PDFs never reach intake — they are rejected in normalizeImages first. |
| **deriveRecommendedPipeline** | Fallback to "image-analysis" when adequacy is ambiguous. | Weak/localizer-heavy batches can be sent to full image analysis instead of insufficient-data. |

---

## 2. Where Wrong Pipeline Selection Happens

| Location | Issue | Impact |
|----------|-------|--------|
| **route.ts normalizeImages** | Throws for PDF and DICOM. | PDF uploads and mixed (PDF+image) **fail immediately** with "PDF uploads are not supported by this route yet." User gets error, no analysis. |
| **core-bridge.ts** | No branching for pdf-report or mixed. | All non-DICOM go to analyzeStudyBatch → /api/analyze. PDFs are base64-encoded and sent, but API rejects them. |
| **DiagnosisContext** | Only branches on dicom-study. | pdf-report, mixed, report-image (from extension) all use runFullDiagnosisBatch. |
| **Client uploadClassifier** | report-image type exists but is never produced. | Only dicom-study, image-batch, pdf-report, mixed, unknown. No "report-image" batch type from extension (report screenshot = .png → image-batch). |

---

## 3. Where Useful Cases Collapse into Generic Insufficient-Data Reports

| Scenario | Current Behavior | Desired |
|----------|------------------|---------|
| Localizer-only screenshots | Correctly detected → insufficient-data → may run localizer-specific report. | OK when localizer detection runs. |
| Blurry lab report photo | Classified as image-batch → intake may say non-diagnostic → insufficient-data. | Should detect report-image, attempt OCR, return "Lab Report Extraction (Limited)" if OCR partial. |
| Single diagnostic slice | partial adequacy → image-analysis → can produce useful output. | OK. |
| Mixed radiology report + 1 diagnostic image | recommendedPipeline "fusion" when ocrEnabled and fusionEnabled. | Depends on config. If OCR disabled, falls back to image-only path. |
| PDF radiology report | **Never processed** — API throws for PDF. | Should extract via Document AI, return "Radiology Report OCR Summary". |

---

## 4. Where Domain-Specific Outputs Are Flattened

| Location | Issue | Impact |
|----------|-------|--------|
| **domainRouter** | document-only is flat. No radiology vs lab vs pathology. | Lab reports and pathology reports get same "document-only" handling. |
| **documentProcessor** | Single schema: impression, findings, clinicalHistory, recommendations, limitations. | No lab schema (analytes, flags, reference ranges). No pathology schema (specimen, diagnosis, grade, stage). |
| **buildReportOnlyResponse** | Generic "OCR not supported" message. | Does not distinguish radiology vs lab vs pathology document types. |
| **FinalResponseSchema** | Radiotherapy-centric. | All outputs forced into key_findings, report_sections, etc. Lab/pathology need different structures. |

---

## 5. Additional Fragility Points

- **config.ocrEnabled / config.fusionEnabled**: When false, report-ocr and fusion paths are disabled. User gets "OCR not supported" even when infrastructure exists.
- **studyIntake deriveStudyAdequacy**: Binary categories (diagnostic, partial, localizer-only, etc.) — no graded adequacy (insufficient / limited / interpretable / strong).
- **buildFallbackResponse**: Produces generic medical-sounding summary from partial Vertex results. Can sound authoritative when evidence is weak.
- **deriveRecommendedPipeline**: Returns "image-analysis" as final fallback. So any batch with diagnosticCount >= 1 goes to image-analysis even if study is mostly localizer.

---

## 6. Routing Flow Summary (Current)

```
User uploads
  → UploadZone (accepts .dcm, .png, .jpg, .pdf)
  → DiagnosisContext.analyzeFiles
  → classifyUploadBatch (extension + MIME only)
       ├─ dicom-study → runFullDiagnosisDicomBatch → /api/dicom/analyze ✓
       └─ else → runFullDiagnosisBatch → /api/analyze
            → POST { images: [{ imageBase64, fileName }] }
            → route.ts:
                 ├─ isDicomBatch? → DICOM pipeline ✓
                 └─ normalizeImages → THROWS if PDF ✗
                 └─ (images only) → intake (LLM) → recommendedPipeline
                       ├─ report-ocr → OCR, synthesis ✓ (for report screenshots)
                       ├─ insufficient-data → insufficient response ✓
                       ├─ fusion → image + report OCR ✓
                       └─ image-analysis → Vertex + synthesis ✓
```

**Critical gap**: PDF and mixed (PDF+image) never reach the intake/routing logic. They fail at normalizeImages.
