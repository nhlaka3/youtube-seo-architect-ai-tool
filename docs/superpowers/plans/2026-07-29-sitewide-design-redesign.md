# Site-Wide Design Redesign Implementation Plan

> **For Hermes:** Use subagent-driven-development to implement this plan task-by-task.

**Goal:** Overhaul all YT SEO Architect pages with a consistent CSS design token system, unified navigation, and modern engagement features.

**Architecture:** Single CSS token system (design-tokens.css) imported by all pages, shared nav/footer components, blog article enhancements via CSS + minimal JS, key page restructures for homepage/blog listing/tool index.

**Tech Stack:** Vanilla CSS (custom properties), Vanilla JS (Intersection Observer), Lucide icons, Geist font

---

## Phase 1: CSS Design Token System

### Task 1: Create design-tokens.css

**Objective:** Single source of truth for all visual design tokens — colors, typography, spacing, shadows, borders.

**Files:**
- Create: `design-tokens.css`

**Step 1: Write the complete design token file**

```css
/* ── YT SEO Architect Design Tokens ────────────────── */
/* Single source of truth for all visual properties     */
/* Import: @import './design-tokens.css';               */
/* ──────────────────────────────────────────────────── */

:root {
  /* ── Brand Colors ── */
  --cyan: #00f2ff;
  --cyan-hover: #00d7e6;
  --cyan-glow: rgba(0, 242, 255, 0.25);
  --green: #00ff88;
  --green-glow: rgba(0, 255, 136, 0.25);

  /* ── Background Surfaces (Linear-style luminance stack) ── */
  --bg-deep: #06070a;
  --bg-page: #0a0b10;
  --bg-oled: #000000;
  --bg-elevated: rgba(16, 20, 32, 0.7);
  --bg-hover: rgba(16, 20, 32, 0.9);
  --bg-glass: rgba(10, 11, 16, 0.6);
  --bg-surface: rgba(16, 20, 32, 0.6);

  /* ── Text Hierarchy ── */
  --text-primary: #f0f2f5;
  --text-secondary: #a8b2c1;
  --text-muted: #5d6676;
  --text-white: #ffffff;

  /* ── Borders ── */
  --border: rgba(255, 255, 255, 0.06);
  --border-solid: rgba(0, 242, 255, 0.12);
  --border-hover: rgba(0, 242, 255, 0.2);

  /* ── Shadows (Vercel multi-layer technique) ── */
  --card-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06),
                 0 2px 4px rgba(0, 0, 0, 0.3);
  --card-shadow-hover: 0 0 0 1px rgba(0, 242, 255, 0.15),
                       0 8px 24px rgba(0, 0, 0, 0.4),
                       0 0 40px rgba(0, 242, 255, 0.05);
  --glass-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.9),
                   0 0 20px rgba(0, 242, 255, 0.05);

  /* ── Typography ── */
  --font: 'Geist', 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'Geist Mono', 'Fira Code', monospace;
  --tracking-display: -0.03em;
  --tracking-heading: -0.02em;

  /* ── Border Radius ── */
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-pill: 9999px;

  /* ── Spacing (8px scale) ── */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;
  --space-20: 5rem;

  /* ── Transitions ── */
  --ease-precise: cubic-bezier(0.23, 1, 0.32, 1);
  --transition-fast: 0.2s var(--ease-precise);
  --transition-normal: 0.3s var(--ease-precise);
  --transition-slow: 0.5s var(--ease-precise);

  /* ── Z-Index Scale ── */
  --z-header: 100;
  --z-overlay: 200;
  --z-modal: 300;
  --z-toast: 400;
}
```

**Step 2: Verify the file exists and is valid CSS**

Run: `cat design-tokens.css | head -5`
Expected: Shows file header comment and `:root {`

**Step 3: Commit**

```bash
git add design-tokens.css
git commit -m "feat(design): add design-tokens.css with full token system"
```

---

### Task 2: Create utilities.css (shared component classes)

**Objective:** Reusable utility classes for cards, buttons, badges, layout containers.

**Files:**
- Create: `utilities.css`

**Step 1: Write utility classes**

```css
@import './design-tokens.css';

/* ── Glass Card ── */
.glass-card {
  background: var(--bg-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-solid);
  border-radius: var(--radius-lg);
  box-shadow: var(--card-shadow);
  transition: all var(--transition-normal);
}
.glass-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-4px);
  box-shadow: var(--card-shadow-hover);
}

/* ── Button Variants ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-family: var(--font);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all var(--transition-fast);
  text-decoration: none;
}
.btn:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 2px;
}
.btn-primary {
  background: var(--cyan);
  color: var(--bg-oled);
  font-weight: 700;
  box-shadow: 0 0 12px var(--cyan-glow);
}
.btn-primary:hover {
  transform: scale(1.02);
  box-shadow: 0 0 24px var(--cyan-glow);
}
.btn-secondary {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border-hover);
}
.btn-glass {
  background: var(--bg-surface);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: var(--text-primary);
  border: 1px solid var(--border-solid);
}
.btn-glass:hover {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

/* ── Badge / Pill ── */
.badge {
  display: inline-block;
  background: rgba(0, 242, 255, 0.08);
  color: var(--cyan);
  border: 1px solid rgba(0, 242, 255, 0.15);
  padding: 0.15rem 0.6rem;
  border-radius: var(--radius-pill);
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.badge-green {
  background: rgba(0, 255, 136, 0.08);
  color: var(--green);
  border-color: rgba(0, 255, 136, 0.15);
}

/* ── Section Container ── */
.section {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-16) var(--space-6);
}

/* ── Grid Layouts ── */
.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-6);
}
.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-6);
}
.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-6);
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
}
@media (max-width: 1024px) {
  .grid-4 { grid-template-columns: repeat(2, 1fr); }
}

/* ── Text Utilities ── */
.gradient-text {
  background: linear-gradient(135deg, var(--text-primary), var(--cyan));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.text-muted { color: var(--text-muted); }
.text-secondary { color: var(--text-secondary); }

/* ── Section Divider ── */
.divider {
  border: none;
  height: 1px;
  background: var(--border);
  margin: var(--space-8) 0;
}

/* ── Reading Container ── */
.reading-container {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-6);
}

/* ── Skip to Content (accessibility) ── */
.skip-link {
  position: absolute;
  top: -100%;
  left: var(--space-4);
  z-index: var(--z-toast);
  background: var(--cyan);
  color: var(--bg-oled);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  font-weight: 700;
  text-decoration: none;
  transition: top var(--transition-fast);
}
.skip-link:focus {
  top: var(--space-2);
}

/* ── Reduced Motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .glass-card:hover {
    transform: none;
  }
}

/* ── Scroll Reveal ── */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity var(--transition-slow), transform var(--transition-slow);
}
.reveal.visible {
  opacity: 1;
  transform: translateY(0);
}

/* ── Focus Ring ── */
:focus-visible {
  outline: 2px solid var(--cyan);
  outline-offset: 2px;
}
```

**Step 2: Verify**

Run: `cat utilities.css | head -3`
Expected: Shows import and comment header

**Step 3: Commit**

```bash
git add utilities.css
git commit -m "feat(design): add utilities.css with reusable component classes"
```

---

### Task 3: Create nav.css (header/navigation)

**Objective:** Fully styled navigation system — sticky header, breadcrumbs, footer.

**Files:**
- Create: `nav.css`

**Step 1: Write navigation styles**

```css
@import './design-tokens.css';

/* ── Header ── */
.site-header {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  background: rgba(10, 11, 16, 0.8);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border-bottom: 1px solid var(--border);
  padding: 0 var(--space-6);
}

.header-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-white);
  text-decoration: none;
  font-weight: 700;
  font-size: 1.1rem;
}
.header-logo span { color: var(--cyan); }
.header-logo img { height: 32px; width: auto; }

.header-nav {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

.header-nav a {
  color: var(--text-secondary);
  text-decoration: none;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  transition: color var(--transition-fast);
}
.header-nav a:hover { color: var(--text-primary); }
.header-nav a.active { color: var(--text-white); font-weight: 600; }

.header-cta {
  background: var(--cyan);
  color: var(--bg-oled) !important;
  padding: var(--space-2) var(--space-4) !important;
  font-weight: 700 !important;
  border-radius: var(--radius-md) !important;
  box-shadow: 0 0 12px var(--cyan-glow);
  transition: all var(--transition-fast);
}
.header-cta:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 24px var(--cyan-glow);
}

/* ── Mobile Menu Toggle ── */
.mobile-menu-btn {
  display: none;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  padding: var(--space-2);
}

@media (max-width: 768px) {
  .header-nav { display: none; }
  .mobile-menu-btn { display: block; }
  .header-nav.open {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 56px;
    left: 0;
    right: 0;
    background: rgba(10, 11, 16, 0.95);
    backdrop-filter: blur(24px);
    border-bottom: 1px solid var(--border);
    padding: var(--space-4);
    gap: var(--space-2);
  }
}

/* ── Breadcrumbs ── */
.breadcrumbs {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-2) var(--space-6);
  font-size: 0.8rem;
  color: var(--text-muted);
}
.breadcrumbs a {
  color: var(--text-secondary);
  text-decoration: none;
}
.breadcrumbs a:hover { color: var(--cyan); }
.breadcrumbs .sep {
  margin: 0 var(--space-1);
  color: var(--text-muted);
}
.breadcrumbs .current {
  color: var(--text-primary);
}

/* ── Footer ── */
.site-footer {
  border-top: 1px solid var(--border);
  background: var(--bg-deep);
  padding: var(--space-16) var(--space-6) var(--space-8);
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-8);
}

.footer-col h4 {
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: var(--space-4);
}
.footer-col a {
  display: block;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.85rem;
  padding: var(--space-1) 0;
  transition: color var(--transition-fast);
}
.footer-col a:hover { color: var(--cyan); }

.footer-bottom {
  max-width: 1200px;
  margin: var(--space-8) auto 0;
  padding-top: var(--space-6);
  border-top: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.footer-social {
  display: flex;
  gap: var(--space-3);
}
.footer-social a {
  color: var(--text-muted);
  transition: color var(--transition-fast);
}
.footer-social a:hover { color: var(--cyan); }

@media (max-width: 768px) {
  .footer-inner { grid-template-columns: repeat(2, 1fr); }
  .footer-bottom { flex-direction: column; gap: var(--space-4); text-align: center; }
}
@media (max-width: 480px) {
  .footer-inner { grid-template-columns: 1fr; }
}

/* ── Reading Progress Bar ── */
.reading-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--cyan), var(--green));
  z-index: calc(var(--z-header) + 1);
  width: 0%;
  transition: width 0.1s linear;
}

/* ── Sticky TOC ── */
.toc-sticky {
  position: sticky;
  top: 80px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
}
.toc-sticky a {
  display: block;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.85rem;
  padding: 0.25rem 0;
  padding-left: var(--space-3);
  border-left: 1px solid var(--border);
  transition: all var(--transition-fast);
}
.toc-sticky a:hover { color: var(--cyan); border-left-color: var(--cyan); }
.toc-sticky a.active { color: var(--cyan); border-left-color: var(--cyan); font-weight: 500; }
.toc-sticky a.h3 { padding-left: var(--space-6); font-size: 0.8rem; }
```

**Step 2: Commit**

```bash
git add nav.css
git commit -m "feat(design): add nav.css with header, breadcrumbs, footer, progress bar, TOC"
```

---

### Task 4: Create blog-article.css

**Objective:** All blog-article-specific styles — reading container, typography, code blocks, FAQ accordions.

**Files:**
- Create: `blog-article.css`

**Step 1: Write blog article styles**

```css
@import './design-tokens.css';

/* ── Blog Article Layout ── */
.article-body {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-6);
}

.article-body h2 {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: var(--tracking-heading);
  margin: var(--space-8) 0 var(--space-4);
  color: var(--text-primary);
  line-height: 1.3;
}
.article-body h3 {
  font-size: 1.35rem;
  font-weight: 600;
  letter-spacing: var(--tracking-heading);
  margin: var(--space-6) 0 var(--space-3);
  color: var(--text-primary);
}
.article-body p {
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-4);
  font-size: 1rem;
}
.article-body ul, .article-body ol {
  color: var(--text-secondary);
  line-height: 1.7;
  margin-bottom: var(--space-4);
  padding-left: var(--space-6);
}
.article-body li { margin-bottom: var(--space-2); }
.article-body strong { color: var(--text-primary); font-weight: 600; }
.article-body a {
  color: var(--cyan);
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: opacity var(--transition-fast);
}
.article-body a:hover { opacity: 0.8; }

/* ── Article Meta ── */
.article-meta {
  display: flex;
  gap: var(--space-4);
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-bottom: var(--space-6);
  flex-wrap: wrap;
}
.article-meta span {
  display: flex;
  align-items: center;
  gap: var(--space-1);
}

/* ── Code Blocks ── */
.article-body pre {
  background: var(--bg-deep);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  overflow-x: auto;
  margin: var(--space-6) 0;
  position: relative;
}
.article-body code {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  color: var(--green);
  line-height: 1.5;
}
.article-body :not(pre) > code {
  background: rgba(0, 255, 136, 0.08);
  color: var(--green);
  padding: 0.1rem 0.3rem;
  border-radius: var(--radius-sm);
  font-size: 0.85em;
}
.copy-btn {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--transition-fast);
}
pre:hover .copy-btn { opacity: 1; }
.copy-btn:hover { color: var(--cyan); border-color: var(--border-hover); }

/* ── Details / FAQ ── */
.article-body details {
  background: var(--bg-surface);
  border: 1px solid var(--border-solid);
  border-radius: var(--radius-lg);
  margin: var(--space-4) 0;
  padding: var(--space-4);
  transition: border-color var(--transition-fast);
}
.article-body details[open] {
  border-color: var(--border-hover);
}
.article-body details summary {
  cursor: pointer;
  color: var(--text-primary);
  font-weight: 600;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  list-style: none;
}
.article-body details summary::-webkit-details-marker { display: none; }
.article-body details summary::before {
  content: '▸';
  color: var(--cyan);
  transition: transform var(--transition-fast);
  font-size: 0.9rem;
}
.article-body details[open] summary::before {
  transform: rotate(90deg);
}
.article-body details p {
  margin-top: var(--space-3);
  padding-left: 1.5rem;
}

/* ── TL;DR / Summary Box ── */
.article-body .tldr {
  background: rgba(0, 242, 255, 0.04);
  border: 1px solid rgba(0, 242, 255, 0.15);
  border-left: 3px solid var(--cyan);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin: var(--space-6) 0;
}
.article-body .tldr strong {
  color: var(--cyan);
  display: block;
  margin-bottom: var(--space-2);
}
.article-body .tldr ul { margin-bottom: 0; }

/* ── Related Posts ── */
.related-posts {
  max-width: 720px;
  margin: var(--space-12) auto;
  padding: var(--space-6);
  border-top: 1px solid var(--border);
}
.related-posts h3 {
  text-align: center;
  margin-bottom: var(--space-6);
  font-size: 1.25rem;
  color: var(--text-primary);
}
.related-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-4);
}
@media (max-width: 640px) {
  .related-grid { grid-template-columns: 1fr; }
}

/* ── Font Size Toggle ── */
.font-size-controls {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}
.font-size-btn {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font);
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}
.font-size-btn:hover { border-color: var(--border-hover); color: var(--text-primary); }
.font-size-btn.active { border-color: var(--cyan); color: var(--cyan); }

/* ── Image Styles ── */
.article-body img {
  max-width: 100%;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border);
  margin: var(--space-6) auto;
  display: block;
}
.article-body img + em {
  display: block;
  text-align: center;
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-top: -0.5rem;
  margin-bottom: var(--space-4);
}

/* ── Blockquotes ── */
.article-body blockquote {
  border-left: 3px solid var(--cyan);
  padding: var(--space-3) var(--space-4);
  margin: var(--space-6) 0;
  background: rgba(0, 242, 255, 0.03);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  color: var(--text-secondary);
  font-style: italic;
}

/* ── Tables ── */
.article-body table {
  width: 100%;
  border-collapse: collapse;
  margin: var(--space-6) 0;
  font-size: 0.9rem;
}
.article-body th {
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-weight: 600;
  text-align: left;
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
}
.article-body td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--border);
  color: var(--text-secondary);
}
.article-body tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

/* ── Newsletter Signup (inline) ── */
.newsletter-inline {
  background: var(--bg-elevated);
  border: 1px solid var(--border-solid);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  text-align: center;
  margin: var(--space-8) 0;
}
.newsletter-inline h3 {
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}
.newsletter-inline p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  margin-bottom: var(--space-4);
}
.newsletter-form {
  display: flex;
  gap: var(--space-2);
  max-width: 400px;
  margin: 0 auto;
}
.newsletter-form input {
  flex: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  color: var(--text-primary);
  font-family: var(--font);
  font-size: 0.875rem;
}
.newsletter-form input:focus {
  outline: none;
  border-color: var(--cyan);
}
```

**Step 2: Commit**

```bash
git add blog-article.css
git commit -m "feat(design): add blog-article.css with reading styles, code blocks, FAQs, newsletter"
```

---

### Task 5: Refactor style.css to import tokens and remove duplicates

**Objective:** Update existing style.css to import from design-tokens.css and remove redundant property declarations.

**Files:**
- Modify: `style.css`

**Step 1: Add import at top of style.css**

```css
@import './design-tokens.css';
```

**Step 2: Remove duplicate :root block from style.css** (lines 1-200~ that redefine the same variables)

**Step 3: Verify no breakage**

Run: `grep -c "@import" style.css`
Expected: `1`

**Step 4: Commit**

```bash
git add style.css
git commit -m "refactor(design): import design-tokens.css, remove duplicate variable definitions"
```

---

## Phase 2: Navigation Implementation

### Task 6: Update homepage index.html with new header and hero

**Objective:** Restructure homepage with shared header, breadcrumbs, hero section, tool grid, stats, blog preview.

**Files:**
- Modify: `index.html`

**Step 1: Replace inline <style> block with imports**

```html
<link rel="stylesheet" href="design-tokens.css" media="print" onload="this.media='all'">
<link rel="stylesheet" href="utilities.css" media="print" onload="this.media='all'">
<link rel="stylesheet" href="nav.css" media="print" onload="this.media='all'">
<link rel="stylesheet" href="style.css" media="print" onload="this.media='all'">
<noscript>
  <link rel="stylesheet" href="design-tokens.css">
  <link rel="stylesheet" href="utilities.css">
  <link rel="stylesheet" href="nav.css">
  <link rel="stylesheet" href="style.css">
</noscript>
```

Remove the old `:root` block from the inline `<style>`.

**Step 2: Add shared header HTML at top of body**

```html
<header class="site-header">
  <div class="header-inner">
    <a href="/" class="header-logo">
      <svg><!-- logo icon --></svg>
      YT <span>SEO</span> Architect
    </a>
    <nav class="header-nav">
      <a href="/tools.html">Tools</a>
      <a href="/blog">Blog</a>
      <a href="/public/glossary">Glossary</a>
      <a href="/public/tools">Free Tools</a>
      <a href="/dashboard.html" class="header-cta">Dashboard</a>
    </nav>
    <button class="mobile-menu-btn" aria-label="Menu">☰</button>
  </div>
</header>
```

**Step 3: Add hero section, tool grid (3x2), stats bar, blog preview, footer**

**Step 4: Add mobile menu JS**

```html
<script>
document.querySelector('.mobile-menu-btn')?.addEventListener('click', () => {
  document.querySelector('.header-nav').classList.toggle('open');
});
</script>
```

**Step 5: Verify with browser**

**Step 6: Commit**

```bash
git add index.html
git commit -m "feat(home): restructure with shared header, hero, tool grid, stats"
```

---

### Task 7: Update blog.html with shared header and category navigation

**Files:**
- Modify: `blog.html`

**Step 1:** Add CSS imports + shared header (same pattern as index.html)

**Step 2:** Add breadcrumbs below header

**Step 3:** Add category pills row + featured article card + article grid

**Step 4:** Commit

---

### Task 8: Add reading progress bar + scroll reveal JS to blog articles

**Files:**
- Create: `js/blog-enhancements.js`
- Modify: `blog-article.css` (already done in Task 4)

**Step 1: Create blog-enhancements.js**

```javascript
// ── Reading Progress Bar ──
(function() {
  const bar = document.getElementById('reading-progress');
  if (!bar) return;
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = progress + '%';
  }, { passive: true });
})();

// ── Scroll Reveal ──
(function() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
})();

// ── Copy Code Button ──
(function() {
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code')?.textContent || pre.textContent;
      await navigator.clipboard.writeText(code);
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
    });
    pre.appendChild(btn);
  });
})();

// ── Font Size Toggle ──
(function() {
  const container = document.getElementById('article-body');
  const btns = document.querySelectorAll('.font-size-btn');
  if (!container || !btns.length) return;
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const size = btn.dataset.size || 'medium';
      const sizes = { small: '0.9rem', medium: '1rem', large: '1.15rem' };
      container.style.fontSize = sizes[size] || sizes.medium;
    });
  });
})();
```

**Step 2: Add to blog-article.css** (already has the progress bar styles)
**Step 3: Commit**

---

## Phase 3: Key Page Restructures

### Task 9: Restructure homepage (index.html)

**Files:**
- Modify: `index.html`

**Step 1-4:** Same as Task 6 (already covered there)

### Task 10: Restructure blog listing (blog.html)

**Files:**
- Modify: `blog.html`

### Task 11: Create tools.html (unified tool index)

**Files:**
- Create: `tools.html`

**Step 1:** Build a page at root-level `/tools.html` with:
- Shared header + breadcrumbs
- Hero: "Free YouTube SEO Tools"
- Category filter tabs
- Card grid of all tools with icon, title, description, link

### Task 12: Restructure glossary (public/glossary/index.html)

### Task 13: Polish dashboard.html header/footer

---

## Phase 4: Engagement Layer

### Task 14: Add scroll reveal to card-based pages

### Task 15: Add cursor glow effect (hero only)

### Task 16: Add newsletter signup component

---

## Phase 5: QA & Polish

### Task 17: Verify all pages load with new styles
### Task 18: Check responsive behavior at 320px, 768px, 1200px
### Task 19: Verify focus-visible and skip-link accessibility
### Task 20: Run final audit against success criteria
