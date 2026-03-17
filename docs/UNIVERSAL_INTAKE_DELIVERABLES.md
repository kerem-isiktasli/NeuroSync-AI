# Universal Medical Intake — Deliverables

## 1. Current Failure Map

See **[INTAKE_ROUTING_FAILURE_MAP.md](./INTAKE_ROUTING_FAILURE_MAP.md)** for the full root-cause audit.

Summary:
- PDF uploads failed at API (normalizeImages threw)
- Mixed PDF+image never processed both
- Client used extension/MIME only; no content signals
- Document-only was flat (no lab/pathology distinction)
- No graded adequacy tiers
- Generic fallback responses could sound authoritative

---

## 2. Files Changed

### New Files
- `src/lib/intake/types.ts` — File/batch classification types, adequacy tiers
- `src/lib/intake/fileClassifier.ts` — Per-file classification (extension + MIME)
- `src/lib/intake/batchClassifier.ts` — Batch-level classification
- `src/lib/intake/pipelineRouter.ts` — Pipeline routing logic
- `src/lib/intake/universalOutput.ts` — Universal output meta builder
- `src/lib/intake/index.ts` — Entry exports
- `src/lib/intake/__tests__/batchClassifier.test.ts` — Intake tests
- `src/lib/medical/processors/labProcessor.ts` — Lab document processor
- `src/lib/medical/processors/pathologyProcessor.ts` — Pathology document processor
- `docs/INTAKE_ROUTING_FAILURE_MAP.md`
- `docs/UNIVERSAL_INTAKE_DELIVERABLES.md` (this file)

### Modified Files
- `src/app/api/analyze/route.ts` — Early batch classification, PDF branch, mixed fusion, observability
- `src/lib/uploadClassifier.ts` — Uses new intake; backward-compatible legacy types
- `src/lib/medical/domainSchemas.ts` — Added LabFindingSchema, PathologyFindingSchema
- `src/lib/medical/processors/index.ts` — Exported lab and pathology processors

---

## 3. New Intake Classifier Design

- **Per-file**: `classifyFile(index, fileName, mimeType, options?)` → `PerFileClassification`
  - fileKind: dicom | medical-image | report-image | pdf-document | lab-document | pathology-document | unknown
  - modalityGuess, anatomicalRegionGuess, documentTypeGuess
  - containsUiOverlay, containsDenseText, isLikelyLocalizer, diagnosticValue, confidence, signals

- **Per-batch**: `classifyBatch(files, options?)` → `BatchClassification`
  - batchType: dicom-study | image-study | report-only | lab-only | pathology-only | mixed-image-report | mixed-document-set | unsupported | unknown
  - pipeline, adequacyTier (insufficient | limited | interpretable | strong), confidence
  - Uses extension + MIME; document type from filename hints (lab, pathology, radiology)

- **Routing**: `routeToPipeline(classification)` → `PipelineRoute`
  - Explicit pipeline and apiPath (dicom | analyze | document)
  - requiresPdfHandling, requiresImageHandling, requiresDocumentExtraction

---

## 4. Specialized Pipelines

| Pipeline           | When                    | API Path | Behavior                                      |
|--------------------|-------------------------|----------|-----------------------------------------------|
| dicom-study        | All DICOM               | dicom    | DICOM parse, study grouping, domain reasoning |
| image-study        | Diagnostic images only  | analyze  | Vertex image analysis, reconciliation        |
| report-only        | Report PDF/images only   | analyze  | Document AI / OCR, radiology structure        |
| lab-only           | Lab PDF(s)              | analyze  | Lab processor, analyte extraction             |
| pathology-only     | Pathology PDF(s)        | analyze  | Pathology processor, specimen/diagnosis       |
| mixed-image-report | Images + PDF/report     | analyze  | Image analysis + report extraction + fusion   |
| mixed-document-set | Multiple PDFs           | analyze  | Document merge (future)                       |
| insufficient-data  | Localizer/weak only     | analyze  | Limited response, no fake interpretation      |
| unsupported        | Unknown/empty            | analyze  | Rejection response                            |

---

## 5. Document Processors

| Processor     | Schema                               | Use Case            |
|---------------|--------------------------------------|---------------------|
| documentProcessor | impression, findings, clinicalHistory, recommendations, limitations | Radiology reports   |
| labProcessor  | analytes[], abnormalFlags, referenceRanges, clinicalInterpretationCaveats | Lab reports         |
| pathologyProcessor | specimen, diagnosis, histologicType, grade, stage, markers, margins | Pathology reports   |

---

## 6. Universal Output Schema

```ts
interface UniversalOutputMeta {
  inputType: string;
  domain: string;
  modality: string;
  anatomicalRegion: string;
  adequacyTier: AdequacyTier;  // insufficient | limited | interpretable | strong
  confidence: number;
  whatWasActuallyAnalyzed: string[];
  whatCouldNotBeDetermined: string[];
  structuredDomainResult?: Record<string, unknown>;
  nextBestUploads: string[];
  pipeline: string;
}
```

Used in limited/insufficient responses to avoid fake-normal summaries.

---

## 7. Prevention of Generic Fake Reports

- **PDF-only**: Returns "Radiology Report OCR Summary" / "Lab Report Extraction" / "Pathology Summary" — states what was extracted.
- ** insufficient-data**: `buildInsufficientDataResponse` with clear limitations (localizer count, report images, "diagnostic slices required").
- **Document extraction failed**: Explicit "PDF content could not be extracted. Document AI configuration may be required."
- **Universal meta**: `whatWasActuallyAnalyzed`, `whatCouldNotBeDetermined`, `nextBestUploads` on limited outputs.
- **No silent fallback**: Pipeline is explicit; adequacy tier reflected in output.

---

## 8. Test Results

### Unit Tests (Intake)
- `classifyBatch` empty → unknown, unsupported ✓
- DICOM-only → dicom-study ✓
- PDF-only → report-only ✓
- Lab PDF filename → lab-only ✓
- Pathology PDF filename → pathology-only ✓
- Image-only → image-study ✓
- PDF + images → mixed-image-report ✓
- Multiple PDFs → mixed-document-set ✓

### Manual Test Matrix (To Run)

| # | Scenario                         | Intake Class     | Pipeline        | Adequacy     | Expected Output Type                    |
|---|----------------------------------|------------------|-----------------|--------------|-----------------------------------------|
| 1 | Real DICOM CT/MRI study          | dicom-study      | dicom-study     | interpretable | DICOM report                            |
| 2 | Multiple JPG/PNG diagnostic      | image-study      | image-study     | strong       | Image analysis report                   |
| 3 | Localizer-heavy screenshots      | image-study      | insufficient    | insufficient | Localizer / limited response            |
| 4 | Radiology report screenshot     | report-only      | report-ocr      | limited      | Report OCR summary                      |
| 5 | Radiology report PDF             | report-only      | report-only     | interpretable | Radiology Report OCR (needs Document AI)|
| 6 | Blood/lab report image or PDF    | lab-only         | lab-only        | limited      | Lab Report Extraction                   |
| 7 | Pathology report image or PDF    | pathology-only   | pathology-only  | limited      | Pathology Summary                       |
| 8 | Mixed image + radiology report   | mixed-image-report| mixed-image-report| interpretable| Fusion result                           |
| 9 | Mixed unrelated document set      | mixed-document-set| mixed-document-set| limited     | Document merge                          |
| 10| Unsupported/random upload        | unknown          | unsupported     | insufficient | Rejection / limitation message          |

---

## 9. Remaining Unsupported Edge Cases

- **DICOM with wrong extension** (e.g. .img): Relies on MIME or buffer magic; may fail.
- **Lab/Pathology PDF without Document AI**: Falls back to radiology extraction or returns extraction-failed.
- **Structured lab analyte parsing**: Lab processor uses rawText; full analyte extraction would need LLM/parsing.
- **Structured pathology parsing**: Same; specimen/diagnosis extraction from raw text needs enhancement.
- **Mixed document set merging**: Multiple PDFs route to mixed-document-set but full merge not implemented.

---

## 10. Observability (Dev Mode)

Logged in `NODE_ENV !== "production"`:
- Per-file intake classification (from batch)
- `batchType`, `pipeline`, `adequacyTier`, `routeReason`
- `[Intake] Mixed PDF+images: saved PDF extraction, continuing with N image(s)`
- `intake-batch-classification` phase in SSE log events
