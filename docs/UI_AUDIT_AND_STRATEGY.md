# RapiMed — UI/UX Audit & Design Strategy

## STAGE 1 — UI/UX AUDIT SUMMARY

### Visual hierarchy
- **Weak:** Page titles vary (text-2xl vs text-3xl); no clear display/body distinction. Report Interpretation header is small and italic; dashboard lacks a strong “command center” headline.
- **Weak:** Section labels mix uppercase tracking-widest with normal case; feels inconsistent.
- **Opportunity:** Establish a clear scale: display (hero) → h1 → h2 → h3 → body → caption.

### Spacing
- **Weak:** Card padding is inconsistent (p-6, p-8, p-4); some areas feel cramped (sidebar when collapsed), others loose.
- **Weak:** No defined spacing scale; mix of gap-2, gap-4, gap-6, gap-8.
- **Opportunity:** Use a consistent scale (e.g. 4, 8, 12, 16, 24, 32) for padding/margins and gaps.

### Typography
- **Weak:** Heavy use of uppercase tracking-widest for labels can feel harsh; font-mono used inconsistently (status vs body).
- **Weak:** Line-height and paragraph spacing not standardized; readability in long report text could improve.
- **Opportunity:** Softer section labels (e.g. small caps or weight, not all-caps everywhere); consistent body line-height (e.g. 1.6).

### Contrast & color
- **Fixed (recent):** Theme tokens in place; light mode improved.
- **Remaining:** Auth page and a few components still use hardcoded slate/emerald (e.g. AuthPage, ChatView typing dots, TermsModal spinner, MyReportsView table header).
- **Opportunity:** Replace all remaining hardcoded colors with theme tokens; ensure disabled and hover states use tokens.

### Alignment & grid
- **OK:** Dashboard uses a 12-column grid; left 5 / right 7 split is clear.
- **Weak:** Main content max-w-[1600px] with no consistent inner max-width for text-heavy areas; report panel could use a reading width.
- **Opportunity:** Define content width for report interpretation (e.g. max-w-3xl for prose).

### Card composition
- **Weak:** Single “luxo-card” style for all panels; hierarchy between “upload” and “report” could be clearer (e.g. report panel more elevated).
- **Weak:** Settings/Subscription cards are very similar; active plan could be more distinct.
- **Opportunity:** Surface levels: page bg → sidebar → panel → elevated card → modal; use border and shadow consistently.

### Sidebar balance
- **Weak:** Collapsed state (w-20) hides labels; hover-to-expand is good but icon-only can feel sparse.
- **Weak:** Credits card appears only when expanded; brand block could be tighter.
- **Opportunity:** Slightly more padding when expanded; clearer active state; credits more visible.

### Content density
- **OK:** Dashboard is not cluttered.
- **Weak:** Report area when empty shows a minimal “ANALİZ BEKLENİYOR...” with low visual weight; feels like an afterthought.
- **Opportunity:** Empty state with clear illustration/copy and primary CTA (e.g. “Upload a scan to see your report here”).

### Empty states
- **Weak:** AIReport empty/loading: single line of text, low prominence.
- **Weak:** My Reports empty state is good but could feel more intentional (icon + headline + body + action).
- **Opportunity:** Every empty state: icon, headline, short body, primary action where relevant.

### Loading states
- **OK:** Dashboard loading (spinner + “Checking terms…” / “Verifying neural link”) is clear.
- **Weak:** Upload progress overlay is functional but could feel more premium (e.g. subtle skeleton or step labels).
- **Weak:** Report “Analiz Yapılıyor...” is minimal; no skeleton for report structure.
- **Opportunity:** Skeleton blocks for report (header, sections) when loading; upload steps (Upload → Encrypt → Analyze) clearer.

### Status visibility
- **OK:** Severity badges use theme tokens; credits in sidebar.
- **Weak:** “Vita 3 online” and status dots are small; processing state in upload could be more prominent.
- **Opportunity:** Consistent status chip style (pill with icon); processing with clear step indicator.

### Trust signals & medical credibility
- **OK:** Terms modal has Terms, Medical Disclaimer, Data Use; good structure.
- **Weak:** Auth page “Secured by NeuroSync Defense Protocol” is generic; no subtle “AI-assisted, not a diagnosis” on dashboard/report.
- **Opportunity:** Short trust line near upload (“Encrypted & private”) and near report (“AI-assisted interpretation only. Always consult a physician.”); disclaimer placement consistent.

### Theme consistency
- **OK:** Most UI uses theme tokens; dark mode works.
- **Remaining:** Auth, ChatView (typing dots, CheckCheck), TermsModal (spinner), MyReportsView (one th) still have hardcoded colors.
- **Opportunity:** Full tokenization; light mode explicitly tested for contrast.

### Responsiveness
- **OK:** Grid collapses to single column; sidebar collapses to icons.
- **Weak:** Modal and card sizing on small viewports not fully audited; possible overflow on tables.
- **Opportunity:** Ensure modals are responsive; tables scroll horizontally or stack on small screens.

### Summary verdict
- **Strengths:** Theme tokens, no fake widgets, clear product structure, Terms and Firebase flows intact.
- **Gaps:** Hierarchy and rhythm (typography, spacing, surfaces), empty/loading polish, full tokenization, trust microcopy, and a more intentional “premium command center” dashboard and “interpretation workstation” report experience.

---

## STAGE 2 — DESIGN STRATEGY SUMMARY

### 1. Typography
- **Scale:** Define in Tailwind/globals: `text-display` (hero), `text-h1`–`text-h3`, `text-body`, `text-caption`, `text-label`.
- **Section labels:** Prefer `text-label` (small, semibold, subtle uppercase or normal) over aggressive all-caps everywhere.
- **Readability:** Body `leading-relaxed` (1.625); report content `max-w-prose` or `max-w-3xl` where appropriate.

### 2. Spacing
- **Scale:** 4, 8, 12, 16, 24, 32 (Tailwind 1–8 where applicable); use for padding, gaps, margins.
- **Cards:** Consistent inner padding (e.g. p-6 or p-8 for main cards).
- **Sections:** space-y-8 for major sections; space-y-4 for related items.

### 3. Surfaces
- **Layers:** bg (page) → surface (sidebar, panels) → surface-elevated (cards) → overlay (modals). Use theme tokens; avoid extra gradients unless for one hero card.

### 4. Borders & shadows
- **Borders:** theme-border everywhere; subtle. Optional 1px ring on focus (theme-focus-ring).
- **Shadows:** Light: subtle elevation (shadow-sm); cards: shadow-sm or default. Dark: reduce or soften; avoid neon everywhere.

### 5. Color
- **Identity:** Emerald accent (theme-accent) for primary actions and key highlights; slate neutrals for text/surfaces.
- **Status:** success / warning / danger from theme tokens; chips with bg-*/10 and border-*/20.
- **Light mode:** Ensure surface-elevated and text-primary have clear contrast; no washed-out panels.

### 6. Components
- **Buttons:** Primary = theme-accent; secondary = surface + border; ghost = hover surface. Consistent radius (e.g. rounded-xl) and padding.
- **Cards:** luxo-card as base; optional “elevated” variant (slightly stronger shadow).
- **Inputs:** theme-surface or surface-elevated, theme-border, focus ring theme-focus-ring.
- **Badges/pills:** theme-success/warning/danger with /10 and /20; consistent padding and text size.
- **Empty states:** Icon (theme-accent or muted), headline (h3), body (text-secondary), optional CTA.
- **Loading:** Skeleton components where useful; spinner with theme-accent; step labels for upload.

### 7. Motion
- **Transitions:** 200–300ms for hover/focus; ease-out or custom ease.
- **Page/view:** Existing AnimatePresence; keep subtle (opacity, slight y).
- **No gimmicks:** No flashy or distracting animations.

### 8. Trust & medical
- **Upload:** Short line “Encrypted & private” or equivalent.
- **Report:** Footer or subtitle “AI-assisted interpretation. Not a diagnosis. Consult a physician.”
- **Auth:** Keep one security line; align with theme tokens.

---

## Implementation order (high level)

1. **Design system** — globals.css (spacing vars, typography classes), Tailwind extend (if needed).
2. **Tokenization** — Replace remaining hardcoded colors in Auth, ChatView, TermsModal, MyReportsView.
3. **Dashboard** — Main heading/subheading; upload and report panel hierarchy; empty/loading for report.
4. **Report experience** — AIReport layout; section labels; document context; confidence/status; optional collapsible sections.
5. **Sidebar** — Logo, spacing, active state, credits card.
6. **Empty/loading/error** — Unified patterns; skeletons for report loading.
7. **Micro-interactions** — Hover/active on buttons and cards; focus rings.
8. **Light mode** — Final contrast pass; trust microcopy.
9. **Responsive** — Modals, tables, overflow.
10. **Deliverables** — Files changed, components updated, before/after, remaining weak points.

---

## DELIVERABLES (Implementation Summary)

### 1. UI audit summary
- See **STAGE 1 — UI/UX AUDIT SUMMARY** above (visual hierarchy, spacing, typography, contrast, alignment, cards, sidebar, density, empty/loading states, trust, theme, responsiveness).

### 2. Design strategy summary
- See **STAGE 2 — DESIGN STRATEGY SUMMARY** and **Implementation order** above (typography scale, spacing, surfaces, borders/shadows, color, components, motion, trust).

### 3. Files changed
| File | Changes |
|------|--------|
| `src/app/globals.css` | Design system: `.text-display`, `.text-h1`–`.text-h3`, `.text-body`, `.text-caption`, `.text-label`; `.luxo-card` refined (hover shadow, radius); `.surface-panel`, `.surface-elevated`; `.premium-btn` uses theme-accent + active scale; global input/textarea focus ring theme tokens; `.empty-state`, `.empty-state-icon`, `.skeleton`. |
| `tailwind.config.ts` | No structural change (theme tokens already present). |
| `src/app/dashboard/page.tsx` | Dashboard: “Report center” heading + trust subheading; report panel header with “AI-assisted… Consult a physician”; main margin by sidebar state (ml-60 / ml-[72px]); sidebar: brand (theme-accent icon), nav gap/spacing, credits card compact, profile (initial avatar, theme tokens), logout button; SidebarItem typed. |
| `src/features/diagnosis/components/UploadZone.tsx` | Drag state: theme-accent ring, no heavy glow; analyzing state: theme-accent rings and center icon; progress bar theme-accent; container radius/transition. |
| `src/features/diagnosis/components/AIReport.tsx` | Loading: icon box, “Analyzing your report…”, progress bar animation; empty: `.empty-state` + “No report yet” + copy; document header (text-h2, caption, severity pill text-label); section labels use `.text-label`. |
| `src/features/dashboard/components/MyReportsView.tsx` | Table header cell theme token; empty state uses `.empty-state`, `.empty-state-icon`, `.text-h3`, `.text-body`, `.text-caption`. |
| `src/features/dashboard/components/SettingsView.tsx` | Table divide-theme-border; theme toggle knob and preference toggles use theme-surface-elevated + border (no hardcoded white). |
| `src/features/dashboard/components/ChatView.tsx` | CheckCheck and typing dots use theme-accent/theme-accent-foreground. |
| `src/features/dashboard/components/TermsModal.tsx` | Spinner uses theme-accent-foreground. |
| `src/features/auth/AuthPage.tsx` | Full theme tokenization; layout (theme-bg, theme-surface-elevated, theme-border); form inputs focus ring; premium-btn; error theme-danger; trust line “Encrypted & secure.”; responsive padding. |

### 4. Major visual improvements
- **Dashboard:** Clear “Report center” headline and trust subheading; report panel has dedicated header with medical disclaimer; layout and spacing tightened.
- **Report (AIReport):** Intentional empty state (“No report yet” + copy); loading state with progress bar; document context block and severity pill refined; section labels standardized (text-label).
- **Sidebar:** Themed brand icon; tighter spacing; credits card compact; profile with initial avatar; margin transitions with sidebar expand/collapse.
- **Upload:** Softer drag/analyzing visuals (theme-accent, no neon); cleaner progress bar.
- **Auth:** Token-based, readable in light/dark; trust line; consistent inputs and buttons.
- **Empty/loading:** Shared empty-state and empty-state-icon patterns; AIReport and My Reports use them.

### 5. Reusable design-system primitives added
- **Typography (globals.css):** `.text-display`, `.text-h1`, `.text-h2`, `.text-h3`, `.text-body`, `.text-caption`, `.text-label`.
- **Surfaces:** `.surface-panel`, `.surface-elevated`; `.luxo-card` updated.
- **Empty states:** `.empty-state`, `.empty-state-icon`.
- **Loading:** `.skeleton` (utility for future skeletons).

### 6. Before/after (key screens)
- **Dashboard:** Before: no page title, small italic “Report Interpretation,” report area felt secondary. After: “Report center” + trust line; report panel has clear title and “AI-assisted… Consult a physician”; empty state explains next step.
- **Report panel (empty):** Before: minimal “ANALİZ BEKLENİYOR…” low prominence. After: “No report yet” with icon, short body, and clear CTA to upload.
- **Report panel (loading):** Before: small spinner + one line. After: icon box, “Analyzing your report…”, subcopy, animated progress bar.
- **Sidebar:** Before: emerald hardcoded, gradient avatar. After: theme-accent icon, initial-based avatar, compact credits, margin shifts with expand.
- **Auth:** Before: slate/emerald hardcoded, generic security line. After: full theme tokens, “Encrypted & secure,” consistent focus and buttons.

### 7. Remaining UI weak points
- **Responsive:** Modal and table behavior on very small viewports not fully tested; horizontal scroll for tables may be needed.
- **Report content:** No collapsible sections yet; reading width (max-w-prose) could be applied to long report text for optimal line length.
- **Landing:** Not in scope; landing pages unchanged.
- **Toasts:** Sonner styling may still use next-themes if ThemeProvider is not at root; consider aligning with theme tokens.
- **Signup page:** Not updated in this pass; should get same token treatment as Auth (login) for consistency.
