# Gogh Frontend Audit — YT SEO Architect (OmniRoute)

**Date:** 2026-08-07
**Method:** Gogh six-skill design brain, source-cited rulebook (claim packs: theory TH01–TH15, taste-skill T010–T014, Impeccable I013, Vercel web-design-guidelines V007–V009). Every rule below cites a claim-pack row; no invented thresholds.
**Scope:** Public pages + global CSS. `index.html`, `about.html`, `pricing.html`, `tools.html`, `contact.html`, `blog.html`, `404.html`, `dashboard.html`, `dist/style.css`, `dist/nav.css`, `dist/utilities.css`, `dist/blog-article.css`, `dist/design-tokens.css`.

---

## Page verdicts

| Page | Verdict | Gate |
|---|---|---|
| `index.html` | **FAIL — page-breaking** | unclosed `<script>` kills all JS + footer |
| `dashboard.html` | **FAIL — a11y & token drift at scale** | 6 unmanaged modals, ~241 unlabeled icons |
| `about.html` | **FAIL — legacy orange/purple skin** | zero token usage |
| `contact.html` | **FAIL — legacy orange/purple skin** | zero token usage |
| `404.html` | **FAIL — off-palette accent** | hardcoded orange |
| `pricing.html` | **PASS w/ issues** | minor token/typography drift |
| `tools.html` | **PASS w/ issues** | broken `var(--primary)` ref, tab semantics |
| `blog.html` | **PASS w/ issues** | internal "17 vs 90+" contradiction |
| `dist/design-tokens.css` | **PASS** | clean, well-structured ledger |
| `dist/nav.css` / `dist/utilities.css` | **PASS** | fully tokenized (the pattern to copy) |
| `dist/style.css` | **FAIL — competing token system** | duplicate `:root`, ~82 purple refs, 40 undefined vars |
| `dist/blog-article.css` | **PASS w/ issues** | hardcoded font/colors duplicate tokens |

---

## CRITICAL — fix first

1. **`index.html:1340` — unclosed `<script>` breaks the page.**
   The `<script>` opened at 1340 is never closed. The HTML parser swallows lines 1341–1541 (including the entire second `<footer>`) as script text until the `</script>` inside line 1543. Result: a JS `SyntaxError`, so the reveal observer (1352), stagger (1369), counters (1387), carousel (1421), and `lucide.createIcons` (1483) **never execute**, and the footer never renders. Verified directly: 7 `<script>` tags vs 6 `</script>`.
   **Fix:** add `</script>` before the footer at line 1506 and delete the duplicate footer (a real one already exists at 1300–1327).

2. **`style.css:119-158` — a second competing `:root` token block.** Redefines `--primary`, `--accent`, `--border`, `--text-muted`, `--bg-glass`, `--font-mono` with different values than `design-tokens.css`. Two sources of truth → the same token resolves differently depending on stylesheet order.
   **Fix:** consolidate to one `:root` (design-tokens.css is the ledger).

3. **`style.css` — ~82 purple/violet/indigo refs** (`#8b5cf6`, `#6366f1`, `#a78bfa`, `#a855f7`, `#4f46e5`, `#ec4899`, plus rgba forms), directly contradicting the file's own "Global Purple Ban" block (161–167). Example: `.message.user` hard-gradients `#6366f1 → #4f46e5`.
   **Fix:** route through `--primary` / `--accent` (cyan/green).

4. **`style.css` — ~40 references to undefined custom properties** (`--bg-input`, `--bg-main`, `--border-color`, `--accent-primary`, `--surface`, `--emerald-bg`, …). Defined in **neither** `:root`. Every card/input/select relying on them renders transparent/inherit.
   **Fix:** define them or retarget to token equivalents (`--bg-elevated`, `--bg-surface`, `--border`).

---

## MAJOR — by theme

### Color / token discipline (T013)
- **`about.html`** — hardcoded orange `#f97316` is the de-facto accent (hero, headings, CTAs); `rgba(139,92,246,…)` violet in the story callout; tokens loaded at line 57 but **never used**. Body bg `#0a0a0f` ≠ token `--bg-page`.
- **`contact.html`** — same orange skin (hero, form headings, submit, links); violet `rgba(139,92,246,0.08)` in CTA gradient; `#22c55e` green instead of token `--green`; tokens loaded but unused.
- **`404.html`** — orange `#f97316` gradient + button; `#0a0a0f` bg.
- **`pricing.html:55,65`** — `var(--cyan)` mixed with hardcoded `#2563eb` (blue-600) in hero + CTA.
- **`index.html:517,1210,1212`** — orange `#f97316` in accent glow and video mock; dead `#10b981` rule (697).
- **`dashboard.html`** — purple in ~20 spots (e.g. `#a78bfa`, `#818cf8`) despite "Purple is Banned" comment (621); `--war-accent #00d4ff` and `#06b6d4` coexist with `--cyan`; `#00ff88` duplicated literally instead of `var(--green)`.
- **`style.css`** — hardcoded gradient partners `#2563eb`, `#ea580c`; off-palette status colors `#10b981/#ef4444/#f59e0b/#3b82f6` instead of `--success/--warning/--danger`.

### Dashes (T010 — em-dash ban)
- Violated on essentially every page: `index.html` (27+ visible), `about.html` (14+), `pricing.html` (4+), `tools.html` (2), `contact.html` (1), `blog.html` (3), plus `<title>`/meta/JSON-LD on each page.
- **Fix:** replace `—`/`–` with `:`, `,`, `-`, or parentheses. Note: this is taste-skill's opinionated rule — you can accept it as house style, but if you keep em-dashes, that's a deliberate deviation, not a bug.

### Hero (T011) — `index.html` only
- Headline forced into ~3 lines by `<br>` (789); subtexts at ~33 and ~29 words (≤20); hero carries ~8+ text elements (badge, h1, 2 paras, 2 CTAs, 8 stats) vs the max 4; no in-viewport CTA on `about.html` (only a bottom-of-page link).

### Accessibility (V008/V009)
- **`dashboard.html`**:
  - **6 modals/overlays** (incl. coach-chat-panel) are plain `<div>`s with `display` toggling — no `role="dialog"`, `aria-modal`, focus trap, Esc, or initial-focus. **Critical.**
  - **~241 `data-lucide` icons lack `aria-hidden`** — decorative icons leak into assistive tech (only 14 have it).
  - **~30 `nav-item`/`folder-item` `<a>`s have no `href`** and act as buttons — not keyboard-focusable.
  - **Dozens of `div onclick` interactives** (history-toggle, suggested-question, coach-suggested, folder-headers, thumbnail drop-zone, Sign Out) — no keyboard access.
  - Icon-only buttons without `aria-label` (sidebar-collapse, mobile-menu, coach send, FAB, close/send buttons).
  - `coach-input` `outline:none` with no focus replacement (3562).
  - Forms with placeholder-only labels (goal, coach, transcript inputs); `type="text"` where `type="url"` applies (3 spots); redundant `role="main"`/`role="navigation"`; `<th onclick>` sortables mouse-only; heading skips h2→h4 in 7 views.
- **`tools.html:119-122`** — search input `outline:none` with weak border-only focus; category filter tabs have no `aria-pressed`/`aria-selected`.
- **`contact.html:31`** — inputs `outline:none`, border-color-only focus.
- **`style.css`** — 12 `outline:none` on form controls (some with weak border-only replacement).
- **`blog.html:475-478`** — newsletter form has no `action`/`method`/JS handler → submits and reloads, doing nothing.
- **`404.html:23`** — "404" is a `<div>`, not an `<h1>`; no page-level heading.

### Motion (TH15)
- **`index.html`** — 5+ distinct effects (fadeInUp grid, infinite borderGlow, reveal/stagger, carousel auto-advance, count-up JS); class mismatch risk: JS adds `visible` (1355) while CSS defines `.reveal.revealed` (714) — if external CSS lacks `.visible`, sections stay offset 30px.
- **`dashboard.html`** — 17 `@keyframes` in-file + external refs; neural-canvas runs continuously in background (battery cost, ignores reduced-motion in JS).
- **`style.css`** — 21 `animation:…infinite` rules with **no `@media (prefers-reduced-motion: reduce)` block** (present in utilities.css but missing here); `@keyframes` re-declared up to 4× (`shimmer`) with different bodies — last-wins makes identical-looking elements animate at different speeds.
- **`index.html`** — reduced-motion guard exists (669–675) and JS guards it (1346), but cannot rescue the dead script engine.

### Layout variance & whitespace (T012, TH08)
- **`index.html`** — 5 of 11 sections reuse the same "centered h2 + p + 3-col grid" skeleton (pillars 831, toolkit 1033, free-tools 1102, results 1170, FAQ 1247); bento says "17 tools" but shows 9 cells (1035); `.bento-section` padding 32px vs 60–80px elsewhere.
- **`tools.html`** — all 6 tool-groups are the same card-grid family (acceptable for a directory — flagged as a minor, your call).

### Typography & structure (TH07, TH10)
- `about.html` / `contact.html` — 800px containers → ~90ch prose (target 45–75ch).
- `about.html` — no semantic landmarks (`header`/`main`/`footer`), no skip link.
- `blog.html` — heading hierarchy jumps h1 → h3, no h2.
- `index.html` — three skip-links (two to `#main-content`, one to `#pricing`).

### Content / copy
- **Tool-count contradiction (cross-page AND intra-page):** `about.html:96` + `tools.html:277` claim "90+ tools"; `contact.html:150,176` and `blog.html:399` say "17 tools"; `blog.html:451` (same page as 399) says "90+". A user can catch this in five seconds. **Reconcile to one number.**
- **GitHub handle inconsistency:** `contact.html:122` links `github.com/thiza3062/yt-seo-architect`; `about.html` footer + JSON-LD use `github.com/nhlaka3`.
- `blog.html:408-409` — shipped dev comments ("Articles are injected from JavaScript or via the CMS").
- `index.html:1301,1535` — hardcoded "May 2026" / "© 2026".

---

## Recommended fix order

1. **Unclosed `<script>` in `index.html`** — page is currently broken; this is a 1-line fix with outsized impact.
2. **Tool-count reconciliation** — user-visible inconsistency across every marketing page.
3. **Consolidate `:root` / delete duplicate token block in `style.css`**, then sweep purple/violet/indigo to cyan/green tokens (82 refs in style.css, ~20 in dashboard, handful on the legacy pages).
4. **A11y pass on `dashboard.html`** — modal `role="dialog"` + focus traps (6), `aria-hidden` on ~241 icons, button-ify the `div onclick` controls, add missing `aria-label`s.
5. **Add `prefers-reduced-motion: reduce` block to `style.css`** and consolidate duplicate `@keyframes`.
6. **Em-dash sweep** across visible copy + meta tags (house-style decision).
7. **Hero trim on `index.html`** (T011) — cut subtexts to ≤20 words, drop the `<br>`, reduce text-element count.

---

*Gogh quality-gate note: findings are source-cited to the claim packs named at the top; items marked `[verify]` in the raw scans (class-name mismatches, JS canvas/rAF behavior, nested-card composition) are flagged for manual confirmation rather than asserted. Nothing in this report is an invented rule — thresholds come from TH02/T010/T011/T012/T013/TH15/V008/V009 in the Gogh source ledger.*
