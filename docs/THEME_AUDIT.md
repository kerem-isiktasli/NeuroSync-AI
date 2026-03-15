# RapiMed Light Theme – Theme Audit & Implementation

## 1. Theme audit summary

### Current theme setup (before fixes)

- **Tailwind:** `darkMode: "class"` in `tailwind.config.ts` – theme is driven by the `.dark` class on the document root.
- **CSS variables:** `globals.css` already had shadcn-style variables (`--background`, `--foreground`, `--card`, etc.) and sidebar variables. There were **no semantic theme tokens** shared across light/dark for app UI (surfaces, text hierarchy, accent, states).
- **Component colors:** Many components used **hardcoded dark-oriented classes** such as:
  - `text-slate-200`, `text-white`, `text-black dark:text-white`
  - `bg-slate-900`, `bg-slate-800`, `bg-white dark:bg-slate-900/50`
  - `border-slate-700`, `border-white/5`, `dark:border-white/10`
  - `text-emerald-600 dark:text-emerald-400`, `bg-emerald-500`, `bg-slate-200 dark:bg-slate-700`
- **Dark toggle:** Implemented in `SettingsContext` – toggles `document.documentElement.classList.toggle('dark', theme === 'dark')` and persists to `localStorage` (`neurosync_theme`). **No change required** for persistence.

### Root cause of light-mode issues

- Surfaces and text were tuned for dark mode; in light mode the same classes (or missing light variants) produced **low contrast** and **barely visible text**.
- Reliance on `dark:` variants and fixed slate/white values meant **no single source of truth** for “background”, “surface”, “text-primary”, etc., in both themes.

### What was fixed

1. **Semantic theme tokens** were added in `globals.css` (`:root` and `.dark`) and mapped in `tailwind.config.ts`, so components can use stable utility classes that adapt to the active theme.
2. **Hardcoded colors were replaced** across the app with these tokens (see “Components updated” below).
3. **Light mode values** were chosen for readability and a professional look (slate neutrals, emerald accent preserved).

---

## 2. Semantic token implementation

### Tokens (CSS variables in `src/app/globals.css`)

| Token | Light (`:root`) | Dark (`.dark`) | Usage |
|-------|------------------|----------------|--------|
| `--theme-bg` | `0 0% 100%` | `222 47% 6%` | Page background |
| `--theme-surface` | `210 40% 98%` | `222 47% 9%` | Cards, panels, inputs |
| `--theme-surface-elevated` | `0 0% 100%` | `222 47% 12%` | Raised cards, hover |
| `--theme-border` | `214 32% 91%` | `217 33% 17%` | Borders, dividers |
| `--theme-text-primary` | `222 47% 11%` | `210 40% 98%` | Headings, primary text |
| `--theme-text-secondary` | `215 16% 27%` | `215 20% 75%` | Body, secondary text |
| `--theme-text-muted` | `215 16% 47%` | `215 16% 57%` | Captions, hints |
| `--theme-accent` | `160 84% 39%` (emerald) | same | CTAs, links, brand |
| `--theme-accent-foreground` | `0 0% 100%` | same | Text on accent |
| `--theme-success` | `160 84% 39%` | same | Success, low severity |
| `--theme-warning` | `38 92% 50%` | same | Warnings, medium/high |
| `--theme-danger` | `0 84% 60%` | `0 62% 50%` | Errors, critical |
| `--theme-focus-ring` | `160 84% 39%` | same | Focus outlines |

All values are **HSL triplets** (no `hsl()` in the variable value). Tailwind uses them as `hsl(var(--theme-*))`.

### Tailwind utilities (`tailwind.config.ts`)

Under `theme.extend.colors.theme`:

- `bg-theme-bg`, `bg-theme-surface`, `bg-theme-surface-elevated`
- `border-theme-border`, `border-theme-focus-ring`
- `text-theme-text-primary`, `text-theme-text-secondary`, `text-theme-text-muted`
- `bg-theme-accent`, `text-theme-accent`, `text-theme-accent-foreground`
- `text-theme-success`, `bg-theme-success/10`, etc.
- `text-theme-warning`, `text-theme-danger`, and equivalent background/border variants

Opacity modifiers (e.g. `bg-theme-success/10`) work because the theme colors are defined as Tailwind color keys.

### `.luxo-card` (globals.css)

Updated to use `--theme-surface-elevated` and `--theme-border` so cards stay consistent in both themes.

---

## 3. Files changed

| File | Change |
|------|--------|
| `src/app/globals.css` | Added semantic `--theme-*` variables for `:root` and `.dark`; updated `.luxo-card` to use theme tokens. |
| `tailwind.config.ts` | Extended `theme.extend.colors.theme` with all semantic tokens (bg, surface, surface-elevated, border, text-primary, text-secondary, text-muted, accent, accent-foreground, success, warning, danger, focus-ring). |
| `src/app/dashboard/page.tsx` | Replaced hardcoded slate/white/dark classes with theme tokens (layout, sidebar, cards, upload/report columns). |
| `src/features/dashboard/components/SettingsView.tsx` | Headers, cards, toggles, purchase history table – all use theme tokens. |
| `src/features/dashboard/components/TermsModal.tsx` | Overlay, panel, header, sections, checkbox, footer, buttons – theme tokens. |
| `src/features/dashboard/components/ChatView.tsx` | Container, bubbles, input bar, send button, insufficient-credits – theme tokens. |
| `src/features/dashboard/components/MyReportsView.tsx` | Headers, search/filter, empty state, table (wrapper, header, rows, badges, actions) – theme tokens. |
| `src/features/dashboard/components/SupportView.tsx` | Headers, ticket card, FAQ, “coming soon” – theme tokens. |
| `src/features/dashboard/components/SubscriptionView.tsx` | Headers, plan card, tier cards and buttons – theme tokens. |
| `src/features/dashboard/components/PricingModal.tsx` | Backdrop, panel, form, Pay button, disclaimer – theme tokens. |
| `src/features/dashboard/components/SupportTicketModal.tsx` | Backdrop, panel, form, submit – theme tokens. |
| `src/features/diagnosis/components/UploadZone.tsx` | Title, drop zone, progress, idle/analyzing/success/error states – theme tokens. |
| `src/features/diagnosis/components/AIReport.tsx` | Loading/empty states, header, diagnosis/findings/treatment/references sections, action plan, severity badges, PDF buttons, error text – theme tokens. |

**No changes:** `src/context/SettingsContext.tsx` – theme toggle and persistence were already correct.

---

## 4. Components updated

- **Dashboard:** `src/app/dashboard/page.tsx` (layout, sidebar, credits card, user profile, main content cards).
- **Settings:** `SettingsView.tsx` (language/theme/preferences, purchase history).
- **Modals:** `TermsModal.tsx`, `PricingModal.tsx`, `SupportTicketModal.tsx`.
- **Chat:** `ChatView.tsx`.
- **Reports:** `MyReportsView.tsx`.
- **Support:** `SupportView.tsx`.
- **Subscription:** `SubscriptionView.tsx`.
- **Diagnosis:** `UploadZone.tsx`, `AIReport.tsx`.

---

## 5. Visual identity preserved

- **Emerald accent:** `--theme-accent`, `--theme-success`, and `--theme-focus-ring` use the same emerald hue (`160 84% 39%`) in both themes.
- **Slate neutrals:** Light theme uses slate-tinted surfaces and text (`222 47% 11%` primary, `215 16% 27%` secondary, etc.); dark theme uses the same family with inverted luminance.

---

## 6. Light-mode readability

- **Card backgrounds:** `bg-theme-surface` / `bg-theme-surface-elevated` with sufficient contrast against `--theme-bg`.
- **Table rows:** MyReportsView table uses theme backgrounds and borders; rows and hover states use theme tokens.
- **Hover states:** Buttons and interactive elements use `hover:bg-theme-surface-elevated`, `hover:border-theme-accent/20`, or equivalent token-based hover classes.
- **Disabled states:** `disabled:opacity-50` and `disabled:cursor-not-allowed` kept; buttons use theme backgrounds so they remain visible when disabled.
- **Focus outlines:** `--theme-focus-ring` is available for focus styles; existing ring utilities can use `ring-theme-focus-ring` where needed.

---

## 7. Theme toggle persistence

- **Mechanism:** `SettingsContext` reads `localStorage.getItem('neurosync_theme')` on init and applies the theme by toggling the `.dark` class on `document.documentElement` and setting `document.documentElement.style.colorScheme`.
- **Saving:** On theme change, `localStorage.setItem('neurosync_theme', theme)` is called.
- **Result:** Toggle persists across refresh and sessions; no code changes were required for this deliverable.

---

## Testing checklist

- [ ] **Routes:** Open dashboard, Settings, Chat, My Reports, Support, Subscription in **light mode** and confirm layout and text are visible.
- [ ] **Text contrast:** Check headings, body text, captions, and table content for readability (no “invisible” or very low-contrast text).
- [ ] **Elements:** Buttons, inputs, cards, modals, and badges should be clearly visible (no invisible borders or backgrounds).
- [ ] **Toggle:** Switch to light, refresh page – theme should stay light; switch to dark, refresh – theme should stay dark.
- [ ] **AIReport:** After running a diagnosis, open report in light mode; verify header, sections, severity badge, action plan, references, and PDF buttons are readable and on-token.
