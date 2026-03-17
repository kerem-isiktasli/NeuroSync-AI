# RapiMed Admin Control Plane — Design Document

This document proposes the architecture for a proper internal admin control plane. It is **not** a patient-facing feature; normal patients must not see any sign of the admin area.

---

## 1. Proposed Role Model

### 1.1 Role Hierarchy

| Role       | Scope                  | Capabilities                                                                 |
|-----------|------------------------|-------------------------------------------------------------------------------|
| `admin`   | Full control plane     | All sections: config, prompts, features, users, secrets, audit, sandbox      |
| `operator`| Read + limited writes  | Read config; toggle feature flags; view audit log; no secrets, no user mgmt  |
| `auditor` | Read-only              | View audit log, config history; no writes                                    |

### 1.2 Implementation Strategy

**Option A — Firestore `roles/{userId}` (recommended for now)**  
- Collection `roles` with doc ID = Firebase UID  
- Fields: `{ role: "admin" | "operator" | "auditor", grantedBy: uid, grantedAt: string }`  
- Backward-compatible: `admins/{userId}` existence → treat as `admin` during migration  

**Option B — Firebase Custom Claims**  
- Set via Cloud Function: `admin.auth().setCustomUserClaims(uid, { role: "admin" })`  
- Pro: No Firestore read on every request; token carries role  
- Con: Requires Cloud Function + token refresh after role change  

**Recommendation:** Start with **Option A** (Firestore roles). Migrate to custom claims later if latency or cost becomes an issue. Custom claims require a token refresh after role grant, which adds UX complexity.

### 1.3 Admin vs. Patient Separation

- Roles apply only to `/admin` and `/api/admin/*`  
- Patient app has no role concept; all authenticated users are patients  
- Admin routes never return patient data except in explicitly scoped audit/export flows  

---

## 2. Route Protection Design

### 2.1 Layers

| Layer        | Purpose                                                |
|-------------|---------------------------------------------------------|
| UI          | Hide admin nav; redirect non-admins away from /admin    |
| Middleware  | Block /admin access before page render                 |
| API         | Every admin API verifies role server-side              |
| Firestore   | Admin collections deny client read/write by patients  |

### 2.2 UI Level

- **Admin link visibility:** Fetch `/api/admin/verify` on dashboard load (or use a small `useAdminStatus` hook). Render the Admin nav item only if `admin === true`. No client-side role caching; always verify.
- **Admin page:** Keep existing client-side check; redirect to `/dashboard` if not admin. Middleware adds a second layer.
- **Post-login redirect:** After login, call `/api/admin/verify`; if admin → `router.replace("/admin")`, else → `router.replace("/dashboard")`.

### 2.3 Middleware

```ts
// middleware.ts (Next.js)
// Match: /admin, /api/admin/*
// 1. Allow unauthenticated requests to /login, /signup, /, /api/analyze, etc.
// 2. For /admin and /api/admin/*: require Authorization or session cookie
// 3. If no valid token → redirect to /login (for /admin) or 401 (for API)
// 4. If token valid: call a lightweight admin-check (verify token + Firestore roles lookup, or custom claim)
// 5. If not admin → redirect /admin to /dashboard, return 403 for API
```

**Important:** Middleware cannot easily call Firestore. Two approaches:  
- **A:** Rely on Firebase custom claims in the token; middleware decodes JWT and checks `token.role`  
- **B:** Middleware only enforces auth; admin check happens in page/API (current behavior + middleware auth gate)  

**Recommendation:** Middleware enforces auth for `/admin` and `/api/admin/*`. Role check stays in API and page (server component or client fetch). Custom claims allow a future middleware-only role check.

### 2.4 API Level

- Every admin route must call `verifyAdmin(request)` (or `verifyRole(request, ["admin"])`).
- Return `401` if no token; `403` if not authorized.
- Shared helper: `requireAdmin(request)` → `{ uid }` or throws.

### 2.5 Firestore Rules

- `roles`, `admins`: only server (Admin SDK) or admins (via rules) can read. Patients: `allow read, write: if false` for `roles`. Keep `admins` as today: only self-read for token refresh flows if needed.
- `config`, `config_history`: only server or admin UIDs (from `admins` or `roles`).
- New collections (`prompt_versions`, `audit_log`, `secrets`): no client access; server-only.

---

## 3. DB / Auth Changes Required

### 3.1 New Firestore Collections

| Collection       | Purpose                              | Access           |
|------------------|--------------------------------------|------------------|
| `roles`          | `{ userId, role, grantedBy, grantedAt }` | Server + admin only |
| `prompt_versions`| Versioned prompts for intake, synthesis, etc. | Server read; admin write |
| `audit_log`      | Immutable log of admin actions       | Server append; admin read |
| `feature_flags`  | Fine-grained flags (optional)        | Server read; admin write |
| `secrets`        | **Never** store raw secrets here     | N/A (see Section 4) |

### 3.2 Schema Sketches

**roles/{userId}**
```json
{ "role": "admin", "grantedBy": "uid", "grantedAt": "2025-03-17T00:00:00Z" }
```

**audit_log/{id}**
```json
{
  "actorId": "uid",
  "action": "config.update",
  "resource": "config/active",
  "details": { "keys": ["ocrEnabled"] },
  "ip": "optional",
  "timestamp": "2025-03-17T00:00:00Z"
}
```

### 3.3 Migration from `admins`

1. Create `roles` collection.
2. For each `admins/{uid}` that exists, create `roles/{uid}` with `role: "admin"`.
3. Update `verifyAdmin` to check `roles` first, then fall back to `admins` for backward compatibility.
4. After migration, deprecate `admins` reads (keep write: false for safety).

### 3.4 Firebase Auth

- No change required if using Firestore roles.
- If moving to custom claims: add a Cloud Function `onUserCreate` or `onCall` to set claims when an admin adds a user. Trigger token refresh client-side after role grant.

---

## 4. Secret-Management Design

### 4.1 Principles

1. **No raw secrets in frontend** — Admin UI never receives or displays full API keys.
2. **No raw secrets in Firestore** — Do not store `ANTHROPIC_API_KEY` or similar in Firestore documents.
3. **Server-side only** — Secrets live in env vars, or a secret manager (GCP Secret Manager, Vault).

### 4.2 Secret Store Pattern

| Source              | Use case                          |
|---------------------|-----------------------------------|
| Env vars (.env)     | Local/dev; existing pattern        |
| GCP Secret Manager  | Production; rotate without redeploy |
| Firestore `secrets` | **Never** store raw values        |

### 4.3 Admin UI for Secrets

- **Display:** Masked value, e.g. `sk-ant-••••••••••••••••1234` (last 4 chars optional).
- **Write workflow:** "Rotate" or "Set new" → API accepts new value, writes to Secret Manager (or env override in server restart), never returns full value.
- **APIs:**
  - `GET /api/admin/secrets` → returns `{ anthropic: { configured: true, masked: "••••••1234" } }`
  - `POST /api/admin/secrets/rotate` → body `{ key: "anthropic", value: "new-secret" }` → server writes to secret store, invalidates cache, returns success. Value never logged or stored in DB.

### 4.4 Audit

- Every secret rotation must create an audit log entry: `action: "secret.rotate"`, `resource: "anthropic"` (no value).

---

## 5. Admin IA / Sitemap

### 5.1 Proposed Sections

```
/admin
├── /admin                    → Overview (dashboard)
├── /admin/users              → Users & Roles
├── /admin/intake-questions   → Intake Questions
├── /admin/prompts            → Prompt Versions
├── /admin/pipeline           → Pipeline Config
├── /admin/models             → Model Config
├── /admin/secrets            → Secrets (masked, rotate)
├── /admin/features           → Feature Flags
├── /admin/audit              → Audit Log
└── /admin/sandbox            → Test Sandbox
```

### 5.2 Section Descriptions

| Section         | Content                                                                 |
|-----------------|-------------------------------------------------------------------------|
| Overview        | Summary metrics; last config change; quick links                        |
| Users & Roles   | List users (if permitted); grant/revoke roles (admin only)              |
| Intake Questions| Manage question text, order, conditional logic (backed by `prompt_versions` or dedicated schema) |
| Prompt Versions | Versioned prompts for synthesis, intake, report-chat                     |
| Pipeline Config | Analyze route behavior; timeouts; batch sizes                           |
| Model Config    | Model IDs; fallbacks (current admin config)                             |
| Secrets         | Masked display; rotate workflow                                        |
| Feature Flags   | Fine-grained toggles                                                    |
| Audit Log       | Read-only; filter by actor, action, date                                |
| Test Sandbox    | Run isolated test requests; inspect responses (admin only)              |

### 5.3 Navigation

- Admin layout: sidebar or tabs for these sections.
- No patient-facing nav; admin app is a separate layout under `/admin/*`.

---

## 6. Implementation Order (Safest / Highest Value First)

### Phase 1 — Security & Access

1. **Hide admin nav from non-admins**
   - Add `useAdminStatus()` hook that calls `/api/admin/verify`.
   - Render Admin link only when `admin === true`.
   - **Risk:** Low. **Value:** High (no accidental exposure).

2. **Post-login redirect**
   - After login, call `/api/admin/verify`; if admin → `/admin`, else → `/dashboard`.
   - **Risk:** Low. **Value:** High.

3. **Middleware auth gate**
   - Create `middleware.ts`; for `/admin` and `/api/admin/*`, require valid Firebase token (or session). Redirect to `/login` if missing.
   - **Risk:** Low. **Value:** Medium (defense in depth).

### Phase 2 — Role Model

4. **Introduce `roles` collection**
   - Schema: `roles/{userId}` with `role`, `grantedBy`, `grantedAt`.
   - Migration script: copy `admins` → `roles` with `role: "admin"`.
   - Update `verifyAdmin` to check `roles` first, fallback to `admins`.

5. **Extend verify to support operator/auditor**
   - `GET /api/admin/verify` returns `{ admin: boolean, role?: string }`.
   - Use for future section-level permission checks.

### Phase 3 — Audit Logging

6. **Audit log infrastructure**
   - `audit_log` collection; append-only.
   - Helper: `appendAuditLog({ actorId, action, resource, details })`.
   - Integrate into `/api/admin/config` PATCH and any other write paths.

### Phase 4 — Admin UX Expansion

7. **Admin layout with sub-routes**
   - `/admin` → overview; `/admin/models` → current config; `/admin/features` → flags.
   - Refactor current single admin page into a layout + child routes.

8. **Prompt versions**
   - Store versioned prompts in `prompt_versions`; admin UI to edit and activate versions.
   - Runtime reads active version from config.

### Phase 5 — Secrets & Advanced

9. **Secrets API and UI**
   - `GET /api/admin/secrets` (masked); `POST /api/admin/secrets/rotate` (write-only).
   - Integrate with GCP Secret Manager if available; else document env-only approach.

10. **Users & Roles UI**
    - List users (Firebase Auth listUsers or Firestore `users`); grant/revoke roles.
    - Admin-only.

11. **Test Sandbox**
    - Isolated test mode; admin can send sample requests and inspect responses.
    - Rate-limited; no impact on production data.

---

## Summary Checklist

- [ ] Role model: Firestore `roles` + optional custom claims
- [ ] Route protection: UI hide + middleware auth + API verify
- [ ] Post-login: admin → `/admin`, patient → `/dashboard`
- [ ] DB: `roles`, `audit_log`, `prompt_versions`; no secrets in Firestore
- [ ] Secrets: masked UI, rotate API, server-side store only
- [ ] Audit: every sensitive admin action logged
- [ ] Admin nav: visible only after `/api/admin/verify` returns admin
- [ ] Implementation order: nav hide → redirect → middleware → roles → audit → expand UX → secrets → users → sandbox
