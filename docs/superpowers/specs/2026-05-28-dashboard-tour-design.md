# Dashboard Product Tour — Design Spec

**Date:** 2026-05-28  
**Outputs:**
- `marketing/dashboard-tour.html` — Animated 16:9 dashboard walkthrough
- `marketing/dashboard-tour-script.txt` — Full voiceover script with timestamps

## Goal
A long-form (6-8 min) YouTube video that simulates a user's first experience with the YT SEO Architect dashboard. Chapter-based walkthrough covering all 4 hubs + Phronesis Agent + results. Designed for Hermes/HyperFrames rendering with TTS voiceover.

## Format
- 16:9 landscape (960×540 container, scales to 1920×1080)
- Auto-advancing chapters (~45-60s each)
- Simulated dashboard UI with sidebar, top bar, workspace
- On-screen caption text for each feature explanation
- Progress bar at bottom showing chapter position

## Brand
Cyber-Luxe Dark from `DESIGN.md`:
- Background: `#0a0b10`
- Primary/Cyan: `#00f2ff` — highlights, CTAs, active states
- Accent/Green: `#00ff88` — success states, scores
- Card Glass: `rgba(16, 20, 32, 0.6)`
- Text: `#f0f2f5` (body), `#ffffff` (headings), `#a8b2c1` (muted)
- Danger: `#ff3366` — low scores, before states
- NO purple/violet/indigo. NO orange. NO serif fonts.

## Provenance
This is a re-skin of the approval: no purple, no orange, use dashboard Cyber-Luxe Dark colors.

## UI Layout (3 persistent zones)

```
┌─────────────────────────────────────────────────────┐
│ TOP BAR: Title | AI Status | Credits | Plan | Profile│
├────────┬────────────────────────────────────────────┤
│ SIDEBAR│         WORKSPACE AREA                     │
│ 240px  │    720px — Content changes per chapter     │
│        │    Tools, cards, demos reveal here          │
│4 hubs  │                                            │
│+nav    │                                            │
├────────┴────────────────────────────────────────────┤
│ PROGRESS BAR: ●──●──●──●──●──●──●──●  Chapter 3/8  │
└─────────────────────────────────────────────────────┘
```

## Scene Flow (8 chapters)

### Ch 0: Intro (30s)
- Dark screen → logo cyan glow reveal → "YT SEO Architect" → "Complete Dashboard Tour" subtitle
- Voiceover: "Hey, I just connected my YouTube channel. Let me show you what this dashboard can do."

### Ch 1: Connect & Overview (45s)
- Empty state shown → Connect button pulses → OAuth badge → channel name in top bar
- Dashboard reveals: SEO Score ring animates 0→72, bento cards (Algorithmic Stability, Credits, Last Audit), Critical Fixes panel
- Caption: "Right away, it analyzes my whole channel and gives me a score."

### Ch 2: Intelligence Research (60s)
- Sidebar "Intelligence Research" hub highlights + expands
- Workspace shows: Keyword Discovery with autocomplete dropdown, Golden Keywords with green badges, Niche Guard relevance %, Competitor Sniper crosshair, Trend Pulse graph
- Caption: "This is where I find what people are actually searching for..."

### Ch 3: Creative Studio (60s)
- Sidebar "Creative Studio" hub highlights + expands
- Workspace shows: Video Factory generating title/desc/tags in sequence, Thumbnail Lab with 3 mockups, Script-to-Shorts clip cards, Chapters Generator timestamp list
- Caption: "Once I know my keywords, this hub builds the actual content..."

### Ch 4: Optics Lab (50s)
- Sidebar "Optics Lab" hub highlights + expands
- Workspace shows: Metadata Auditor with red scores → Pre-Upload Lab fix button → scores flip green → Bulk Injector table → Evergreen Audit flags
- Caption: "This is where broken metadata gets fixed — before or after upload..."

### Ch 5: Autopilot (45s)
- Sidebar "Autopilot" hub highlights + expands
- Workspace shows: Retention Re-Order playlist animation, Auto-Responder chat bubbles, Automation Pipeline flow diagram, Playlist Growth Suite cards
- Caption: "For channels that want to set it and forget it..."

### Ch 6: Phronesis Agent (45s)
- AI coach drawer slides in from right → Goal card with progress bar, chat bubbles: scan request → results, Command Inbox with 3 proposals, Apply button → green checks
- Autonomous mode badges cycle: OFF → MONITORING → SUGGESTING → AUTO
- Caption: "And then there's Phronesis — the AI that thinks about your channel 24/7..."

### Ch 7: Results & CTA (30s)
- Optimization History table, Growth Engine stats, Analytics graph
- CTA: "Start free — 100 credits. yt-seo-architect.vercel.app"
- Logo + URL outro

## Animation System
- All animations CSS-only (no GSAP, no JS animation libraries)
- Chapter transitions: workspace content fades out, next slides in from right
- Feature reveals: staggered `fadeSlideUp` with 100ms delays
- Glow pulses on primary elements via `box-shadow` keyframes
- Sidebar hub expansion: max-height transition + chevron rotation
- Progress bar: width transition between chapters
- Auto-advance with `setInterval`, keyboard arrow override

## Script
Separate file `marketing/dashboard-tour-script.txt` with:
- Chapter markers with timestamps
- Full narration text (for TTS)
- Notes on tone: conversational, excited but not salesy, "I just discovered this" energy

## Implementation
- Single HTML file, all CSS/JS inline
- No external dependencies (no Lucide, no fonts loaded at runtime — use system font stack)
- Icons: inline SVG paths or Unicode
- JS: ~60 lines — chapter timer, keyboard nav, sidebar toggle coordination

## What We're NOT Doing
- No orange colors — use dashboard Cyber-Luxe Dark exclusively
- No real Google OAuth flow — simulated with CSS
- No audio — Hermes handles TTS + music
- No purple/violet/indigo
- No external dependencies

## Spec Self-Review
- ✅ No placeholders or TBDs
- ✅ Colors match dashboard Cyber-Luxe Dark (not index.html orange)
- ✅ 8 chapters covering all 4 hubs + intro + outro
- ✅ 16:9 landscape format
- ✅ Two output files (HTML + script)
- ✅ No external dependencies
- ✅ Scene content defined for every chapter
