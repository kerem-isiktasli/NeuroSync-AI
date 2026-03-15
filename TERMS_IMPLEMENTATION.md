# Terms of Use & Medical Disclaimer – Implementation

## Summary

A mandatory acceptance gate was added so users must accept the Terms of Use and Medical Disclaimer before using the app. Acceptance is stored in Firestore for signed-in users and in localStorage for demo users. A version field allows forcing re-acceptance when terms change.

---

## 1. TermsModal component

**File:** `src/features/dashboard/components/TermsModal.tsx`

- **Sections:**
  - **Terms of Use:** Informational use only; no medical diagnoses; consult healthcare professionals.
  - **Medical Disclaimer:** AI may be incomplete/incorrect; RapiMed not responsible for decisions based on AI output.
  - **Data Use:** Reports may be processed by AI; data kept private, not shared with third parties except for processing.
- **Behavior:**
  - Scrollable body with `ref`; scroll position is checked so “Agree and Continue” is only enabled when the user has scrolled to the bottom (within 10px).
  - Checkbox: “I understand and agree to the Terms and Medical Disclaimer.” Required to enable the button.
  - “Agree and Continue” disabled until both scrolled-to-bottom and checkbox are satisfied. On click, calls `onAccept()`; shows “Saving…” when `isAccepting` is true.
  - Optional “Log out instead” when `onLogout` is provided (used on dashboard so users can leave without accepting).
- **UI:** Matches RapiMed (emerald/slate, rounded panels, borders). Works in light and dark (Tailwind `dark:` classes).

---

## 2. Route / access guard

**File:** `src/app/dashboard/page.tsx`

- After auth is resolved (`loading === false`), a terms check runs:
  - **Signed-in user:** `getTermsAcceptance(userId)` from Firestore; `hasAcceptedCurrentTerms(result)` decides if the user has accepted the current terms version.
  - **Demo user:** `getDemoTermsAcceptance()` from localStorage; same `hasAcceptedCurrentTerms(result)`.
- If the user has **not** accepted the current terms (`!termsAccepted`):
  - Only `<TermsModal />` is rendered (full-screen overlay). No sidebar, no main content, no Dashboard / New Analysis / My Reports / Chat / Upload.
- If the user **has** accepted:
  - Full app (sidebar + main) is shown as before.
- Loading: a single loading state covers both “verifying auth” and “checking terms” (spinner + “Checking terms…” or existing verifying copy).

So access to Dashboard, New Analysis, My Reports, Chat, and Upload is blocked until terms are accepted.

---

## 3. Firestore write (and read) logic

**File:** `src/lib/termsFirestore.ts`

- **Stored shape (Firestore)**  
  Document path: `users/{userId}`. Fields:
  - `termsAccepted: true`
  - `termsAcceptedAt: serverTimestamp()`
  - `termsVersion: "1.0"` (from `CURRENT_TERMS_VERSION` in `src/lib/terms.ts`)
  - Written with `setDoc(..., { merge: true })` so other user fields are preserved.
- **Read:** `getTermsAcceptance(userId)` returns `{ termsAccepted, termsAcceptedAt, termsVersion }` or `null` if the doc doesn’t exist.
- **Write:** `setTermsAcceptance(userId)` writes the three fields above.
- **Demo users (no Firebase uid):**  
  `getDemoTermsAcceptance()` / `setDemoTermsAcceptance()` use localStorage keys `rapimed_terms_accepted` and `rapimed_terms_version` so demo users can also pass the gate and be re-prompted when the version changes.

**File:** `src/lib/terms.ts`

- `CURRENT_TERMS_VERSION = "1.0"`.
- `hasAcceptedCurrentTerms(acceptance)` returns `true` only if `acceptance.termsAccepted === true` and `acceptance.termsVersion === CURRENT_TERMS_VERSION`.

---

## 4. Files changed

| File | Purpose |
|------|--------|
| `src/lib/terms.ts` | `CURRENT_TERMS_VERSION`, localStorage key constants. |
| `src/lib/termsFirestore.ts` | Firestore get/set for terms; demo localStorage get/set; `hasAcceptedCurrentTerms()`. |
| `src/features/dashboard/components/TermsModal.tsx` | New modal: three sections, scroll gate, checkbox, Agree button, optional Log out. |
| `src/app/dashboard/page.tsx` | `userId` state; terms state (`termsCheckLoading`, `termsAccepted`, `termsAccepting`); effect to run terms check after auth; `handleAcceptTerms`; guard: when `!termsAccepted` render only `<TermsModal />`; pass `onLogout={handleLogout}`. |

---

## 5. Testing

- **New user (no prior acceptance):**  
  After login (or demo), terms check runs; `termsAccepted` stays false → only TermsModal is shown. User must scroll to bottom and check the box to enable “Agree and Continue”. After accept, Firestore (or demo localStorage) is updated and `termsAccepted` is set true → full app is shown.

- **Returning user (already accepted current version):**  
  Terms check finds `termsAccepted: true` and `termsVersion === CURRENT_TERMS_VERSION` → `termsAccepted` is set true → TermsModal is not shown; user goes straight to the app.

- **Terms version change (re-acceptance):**  
  Bump `CURRENT_TERMS_VERSION` (e.g. to `"1.1"`) in `src/lib/terms.ts`. Existing stored data still has `termsVersion: "1.0"`. `hasAcceptedCurrentTerms()` returns false → TermsModal is shown again; user must accept the new version. After they accept, the new version is written and they can use the app again.

- **Demo user:**  
  Same flow using localStorage; version check and re-prompt on version bump behave the same.

- **Log out instead:**  
  On the terms screen, “Log out instead” calls `handleLogout` and redirects to login without accepting.

---

## 6. Future-proofing

- To require re-acceptance for everyone, update `CURRENT_TERMS_VERSION` in `src/lib/terms.ts` (e.g. to `"1.1"`). No data migration is required; the next time each user loads the dashboard, they will see the modal until they accept the new version.
