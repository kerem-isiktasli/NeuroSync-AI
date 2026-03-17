# E2E Test Assets for RapiMed

Real browser E2E tests require real image files. Use one of these approaches:

## Option 1: Generate minimal test images

```bash
node scripts/generate-test-assets.mjs
```

This creates 100x100+ PNG files in `test-assets/` using Sharp:

- `single-image.png` – single medical image test
- `multi-1.png`, `multi-2.png` – multi-file upload test
- `report-screenshot.png` – report screenshot / OCR path test
- `mixed-image.png` – mixed fusion test (use with report-screenshot.png)

## Option 2: Use your own real medical images

Place real medical images in `test-assets/` with these names:

| File                 | Purpose                         |
|----------------------|----------------------------------|
| `single-image.png`   | Single-image upload flow        |
| `multi-1.png`        | First image for multi-file      |
| `multi-2.png`        | Second image for multi-file     |
| `report-screenshot.png` | Screenshot of a written report |
| `mixed-image.png`    | Medical image for mixed fusion  |

Supported formats: `.dcm`, `.png`, `.jpg`, `.jpeg`. Use `.png` for consistency.

## Running E2E tests

1. Start the app: `npm run dev`
2. Generate or add test assets
3. Run: `npm run e2e`

Tests that require assets will be skipped if files are missing.
