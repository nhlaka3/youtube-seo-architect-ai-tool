# Site-Wide Design Redesign — YT SEO Architect

**Date:** 2026-07-29
**Status:** Approved Design
**Scope:** Hybrid approach — CSS design token overhaul + key page restructures

---

## 1. Design Language

### 1.1 Visual Theme

Vercel-inspired precision (Geist font system, shadow-as-border, clean hierarchy) fused with existing cyan/green brand (Cyber-Luxe Dark). Dark-mode native with glass morphism surfaces, semi-transparent white borders (Linear technique), and multi-layer shadow stacks.

### 1.2 Color Tokens

```css
:root {
  --cyan: #00f2ff;
  --cyan-hover: #00d7e6;
  --cyan-glow: rgba(0, 242, 255, 0.25);
  --green: #00ff88;
  --green-glow: rgba(0, 255, 136, 0.25);

  --bg-deep: #06070a;
  --bg-page: #0a0b10;
  --bg-elevated: rgba(16, 20, 32, 0.7);
  --bg-hover: rgba(16, 20, 32, 0.9);
  --bg-glass: rgba(10, 11, 16, 0.6);

  --text-primary: #f0f2f5;
  --text-secondary: #a8b2c1;
  --text-muted: #5d6676;

  --border: rgba(255, 255, 255, 0.06);
  --border-hover: rgba(0, 242, 255, 0.2);

  --card-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06),
                 0 2px 4px rgba(0, 0, 0, 0.3);
  --card-shadow-hover: 0 0 0 1px rgba(0, 242, 255, 0.15),
                       0 8px 24px rgba(0, 0, 0, 0.4),
                       0 0 40px rgba(0, 242, 255, 0.05);

  --font: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', monospace;
  --tracking-display: -0.03em;
  --tracking-heading: -0.02em;
}
```

### 1.3 Typography Hierarchy

| Element | Size | Weight | Tracking | Line Ht | Font |
|---------|------|--------|----------|---------|------|
| Display (h1 hero) | 3rem (48px) | 700 | -0.03em | 1.05 | Geist |
| Section heading | 2rem (32px) | 600 | -0.02em | 1.15 | Geist |
| Card title | 1.25rem | 600 | -0.01em | 1.3 | Geist |
| Body | 1rem | 400 | normal | 1.6 | Geist |
| Body large | 1.125rem | 400 | normal | 1.7 | Geist |
| Small/meta | 0.875rem | 400 | normal | 1.5 | Geist |
| Caption | 0.75rem | 500 | +0.02em | 1.4 | Geist Mono |

### 1.4 Layout Grid

- Max content width: 1200px
- 12-column implicit CSS grid for card layouts
- 8px spacing scale: 8, 16, 24, 32, 48, 64, 80, 96

### 1.5 Border Radius

- Buttons/inputs: 6px
- Cards: 8px (standard), 12px (featured)
- Pills/badges: 9999px
- Modals: 12px

---

## 2. Navigation & Page Layout

### 2.1 Shared Sticky Header

```
[Logo] YT SEO Architect    Tools ▼  Blog  Glossary  Free Tools
                                                     [Dashboard]
──────────────────────────────────────────────────────────────
[Breadcrumbs: Home > Tools > Tag Generator]
```

- **Sticky** with backdrop-filter blur(24px)
- **Logo** left: "YT SEO Architect" in cyan + white
- **Nav links**: Geist 0.875rem weight 500, `--text-secondary`
- **Tools dropdown**: hover reveal with category items (Keyword Research, Metadata, Analytics, etc.)
- **CTA button**: `--cyan` background, `--bg-deep` text, glow shadow
- **Bottom border**: `1px solid var(--border)`

### 2.2 Breadcrumbs

- Below header on all interior pages
- Separator: `/` in `--text-muted`
- Current page: `--text-primary`, no link
- JSON-LD BreadcrumbList structured data maintained

### 2.3 Footer (4-column)

- **Product**: Tools, Dashboard, Pricing, Changelog
- **Resources**: Blog, Glossary, Guides, API
- **Company**: About, Contact, Privacy, Terms
- **Social**: Twitter, YouTube, GitHub icons + copyright

---

## 3. Page-Specific Layouts

### 3.1 Homepage

1. **Hero** — Full-width canvas, animated gradient background (css-only), 48px display headline, subtitle, search bar for tools
2. **Featured Tools** — 6 tool cards in 3×2 grid, each with Lucide icon, title, description, "Try now" link
3. **Stats Bar** — "17 AI Tools · 100% Free · No Limits" with counter animations
4. **Latest Blog** — 3 post cards with category badge, date, reading time
5. **FAQ** — Existing accordion, restyled with cyan chevrons
6. **Footer**

### 3.2 Blog Listing

1. **Hero banner** — Gradient background, "YouTube SEO Blog" headline, search bar
2. **Category pills** — Horizontal scrollable row: All, Keyword Research, Analytics, Thumbnails, Shorts, Monetization
3. **Featured post** — Large card with hero image, category, title, excerpt
4. **Article grid** — 2-column card grid, each card: category badge, title, excerpt (2 lines), date + reading time
5. **Pagination** — Numbered with prev/next
6. **Sidebar** — Popular posts (sticky), newsletter signup

### 3.3 Blog Article (CSS batch-applies to all 90+)

- **Reading progress bar** — Fixed top, thin cyan line (height: 3px) that fills with scroll
- **Article container** — Max-width 720px, centered, padding 2rem
- **Sticky TOC** — On long guides (>1000 words), auto-generated from h2/h3
- **Typography** — Body 1rem/1.7, headings with negative tracking
- **Code blocks** — Geist Mono, dark container, copy button
- **FAQ accordions** — `<details>` with cyan chevron, matching FAQPage schema
- **Related posts** — 3 card grid at bottom

### 3.4 Free Tools

- **Tool index** (public/tools/index.html): Card grid with category filtering
- **Tool page unified layout**: Hero (tool name + description) → Tool interface (glass card) → Related tools → CTA to dashboard
- Consistent glass card container for all tool interfaces

### 3.5 Glossary

- **Search bar** at top with autocomplete
- **Alphabetical nav** (A-Z jump links)
- **Term cards** in grid, each with: term, definition, related terms with links

---

## 4. Engagement & Interactive Features

### 4.1 Micro-interactions (CSS-only where possible)

- **Card hover**: translateY(-4px) + `--card-shadow-hover` + border color shift
- **Button hover**: scale(1.02) + shadow intensification
- **Link hover**: underline slide-in via `background-size: 0 1px` → `100% 1px` trick
- **Scroll reveal**: Cards fade-up with Intersection Observer (lightweight, no library)

### 4.2 Accessibility (designs.txt compliance)

- **Reading progress bar** on blog articles
- **Sticky TOC** on long guides
- **Font size toggle** on article pages (small/medium/large)
- **`:focus-visible` ring**: 2px solid `--cyan` on all interactive elements
- **Skip to content link**: First focusable element, visually hidden until focused
- **Responsive**: Full responsive down to 320px
- **Reduced motion**: `@media (prefers-reduced-motion)` to disable animations
- **Color contrast**: All text pairs pass WCAG 2.1 AA (minimum 4.5:1)

### 4.3 Content Engagement

- Related posts at article bottom (3 cards, same category)
- Tool-to-blog inline crosslinks
- Newsletter signup embed (blog sidebar + article bottom)
- Category/tag filtering on blog listing

### 4.4 What We're NOT Doing (YAGNI)

- No particle effects / canvas backgrounds
- No Three.js / 3D
- No drag-and-drop
- No live chat
- No complex animation libraries

---

## 5. Implementation Plan

### Phase 1: CSS Design Token System

- Create `design-tokens.css` (root level — all existing pages link to root CSS)
- Create `utilities.css` with shared component classes (root level)
- Create `nav.css` for header/navigation (root level)
- Create `blog-article.css` for article-specific styles (reading bar, TOC, typography)
- Refactor existing `style.css` to import from design-tokens.css tokens
- Remove duplicate inline `<style>` blocks from individual pages where practical
- Note: CSS files stay at root level to avoid breaking 200+ existing `<link>` references

### Phase 2: Navigation & Header

- Build shared sticky header component in `nav.css`
- Add breadcrumbs to interior pages
- Build footer component in `utilities.css`

### Phase 3: Key Page Restructures

1. Homepage (`index.html`) — hero, tool grid, stats bar, blog preview
2. Blog listing (`blog.html`) — category pills, featured card, article grid
3. Tool index page — create `tools.html` at root for unified tool navigation
4. Glossary listing — `public/glossary/index.html`
5. Dashboard shell polish — `dashboard.html` header/footer alignment

### Phase 4: Blog Article Enhancements

- Add reading progress bar (CSS + minimal JS)
- Add sticky TOC for long articles
- Add font size toggle
- Style `<details>` FAQ accordions

### Phase 5: Engagement Layer

- Scroll reveal JS (Intersection Observer)
- Card hover standardization
- Cursor glow effect (hero only)
- Newsletter signup components

### Phase 6: Accessibility & Polish

- Focus-visible styles
- Skip-to-content link
- Reduced motion query
- Responsive testing
- Final QA

---

## 6. Success Criteria

- All pages use consistent design tokens (single source of truth)
- Navigation is unified with breadcrumbs on every interior page
- Blog articles have reading progress bar, proper typography, and TOC on long guides
- Free tools have consistent glass card container layout
- All interactive elements have hover/focus states
- WCAG 2.1 AA contrast compliance
- No regression in existing functionality or SEO
