# RapiMed Platform Hardening — Implementation Summary

## 1. Task 1 — Healthcare / OCR / AI Architecture Correction

### Audit Findings

- **Cloud Healthcare API**: Not used. The app does not integrate DICOMweb or FHIR.
- **Document AI**: Not used. OCR is done via Vertex Gemini vision (provisional).
- **Vertex Gemini** (formerly mislabeled "GoogleHealthcare"): Used for classification, extraction, report OCR, fusion, reconciliation.
- **Anthropic**: Used for synthesis and report chat.

### Changes Made

| File | Change |
|------|--------|
| `src/lib/googleHealthcare.ts` | Renamed class to `VertexImageService`, added architecture header, clarified it is NOT Healthcare API |
| `src/lib/ai/architecture.ts` | **NEW** — Documents pipeline stages and service roles |
| `src/lib/healthcareApiStub.ts` | **NEW** — Stub for future DICOMweb study ingestion |
| `src/lib/documentAiStub.ts` | **NEW** — Stub for future Document AI OCR |
| `src/lib/runtimeConfig.ts` | **NEW** — Server-side config loader from Firestore |
| `src/app/api/analyze/route.ts` | Loads config, gates OCR/literature/fusion by config flags |

### Current Responsibilities

| Service | Role | Status |
|---------|------|--------|
| Cloud Healthcare API | Study ingestion, DICOMweb | **Future** — stub only |
| Document AI | Report OCR | **Future** — stub only |
| Vertex Gemini | Image reasoning, provisional OCR, fusion | **Implemented** |
| Anthropic | Synthesis, chat | **Implemented** |

### Config-Driven Features

- `ocrEnabled` — report-ocr pipeline on/off
- `literatureEnabled` — literature search on/off
- `fusionEnabled` — image vs report fusion on/off

---

## 2. Task 2 — Admin Panel

### Files Changed

| File | Purpose |
|------|---------|
| `src/lib/firebaseAdmin.ts` | **NEW** — Firebase Admin SDK init |
| `src/lib/adminAuth.ts` | **NEW** — Client-side admin check (Firestore `admins` doc) |
| `src/lib/runtimeConfig.ts` | **NEW** — Config loader (uses Admin Firestore) |
| `src/app/api/admin/verify/route.ts` | **NEW** — Verify user is admin via token |
| `src/app/api/admin/config/route.ts` | **NEW** — GET/PATCH config (admin-only) |
| `src/app/admin/page.tsx` | **NEW** — Admin UI |
| `firestore.rules` | Added rules for `admins`, `config`, `config_history` |
| `src/app/dashboard/page.tsx` | Added Admin link in sidebar |

### Admin Auth Mechanism

- **Firestore `admins/{userId}`**: Document existence = admin. No custom claims yet.
- **API protection**: Bearer token verified via Firebase Admin `verifyIdToken`, then check `admins/{uid}`.
- **UI**: Admin page checks `/api/admin/verify`, redirects non-admins to dashboard.

### Firestore Config Schema

```
config/active: {
  vertexModel, vertexFallbackModel, anthropicModel: string
  ocrEnabled, literatureEnabled, fusionEnabled: boolean
  maxImages, maxImageBytes: number
  classificationConfidenceThreshold: number
  promptVersionKey, schemaVersion: string
  updatedAt: string (ISO)
  updatedBy?: string (uid)
}

config_history/{id}: archived config snapshots
```

### What Can Be Changed

- AI model IDs
- Feature flags (OCR, literature, fusion)
- Limits and thresholds
- Prompt/schema version keys

### What Cannot Be Changed

- API keys / secrets
- Source code
- Arbitrary Firestore writes outside allowed keys

---

## 3. Task 3 — Demo Mode Removed

### Files Changed

| File | Change |
|------|--------|
| `src/features/auth/AuthPage.tsx` | Removed Demo Mode button, `handleDemoLogin` |
| `src/app/dashboard/page.tsx` | Removed demo localStorage check, demo terms path |
| `src/context/CreditsContext.tsx` | Removed `isDemoMode`, `canAnalyze`/`canChat` now require credits only |
| `src/lib/termsFirestore.ts` | Removed `getDemoTermsAcceptance`, `setDemoTermsAcceptance` |
| `e2e/helpers.ts` | Renamed to `signInAndAcceptTerms`, requires real auth |
| `e2e/*.spec.ts` | Updated imports; tests 1.2, 1.3 skip (require real auth) |

### Demo Paths Removed

- `localStorage.setItem("neurosync_demo_mode", "true")`
- `localStorage.getItem("neurosync_demo_mode")` checks
- `getDemoTermsAcceptance()` / `setDemoTermsAcceptance()`
- Demo-only persistence (reports/credits already required `userId`; demo had `userId = null`)

### Confirmation

- App requires real Firebase auth. Unauthenticated users are redirected to `/login`.
- Reports, credits, and chat require authenticated users (reports use `userId` in Firestore).

---

## 4. Tests Executed

- **Build**: `npm run build` — ✅ Pass
- **Unit tests**: Existing Vitest suite — not re-run (scope was E2E and platform hardening)
- **E2E**: Auth 1.1 passes (login loads, demo removed). Tests 1.2, 1.3 and upload/chart specs skip without real Firebase auth.

---

## 5. Remaining Caveats

1. **First admin**: Must be added manually to Firestore `admins/{uid}`. See `docs/ADMIN_SETUP.md`.
2. **Config doc**: No initial config document required; runtime uses defaults when missing.
3. **Credits**: Still stored in localStorage (per-browser). Per-user credits in Firestore would be a follow-up.
4. **Custom claims**: Consider migrating to Firebase custom claims for admin role (via Cloud Function).
5. **E2E**: Tests need real Firebase credentials or stored auth state to run full suite.
