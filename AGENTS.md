## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

---

## YouTube Shorts Video Composition Template

> **STOP. READ THIS BEFORE WRITING ANY HTML.**
>
> If a user asks you to create a YouTube Shorts video, promo video, short-form video, or any HyperFrames composition in 9:16 format — you MUST do the following BEFORE writing a single line of code:
>
> 1. **Read `vidtemplate.txt`** — This defines the 5-frame retention structure, pacing rules, and animation philosophy. Every scene must follow it.
> 2. **Read this entire YouTube Shorts section** — This defines the MINIMUM visual element sizes, color palette, typography, animation patterns, caption system, and file structure.
> 3. **Read `best-seo-tools-shorts/index.html`** — This is the PRIMARY template file. Study its CSS sizes, GSAP animations, caption highlighting, flash transitions, and audio setup. Copy its patterns.
> 4. **Read `shorts-video/index.html`** — Reference for caption word highlighting and counter animations.
> 5. **Read `channel-intro/index.html`** — Reference for scene transitions and flash effects.
>
> **DO NOT GUESS at font sizes. DO NOT use smaller text than the minimums below. The user has explicitly complained about small text. Use the size table as your ground truth.**
>
> After writing the composition, run `npx hyperframes lint` and `npx hyperframes validate` before rendering.

### Reference Compositions
Study these existing compositions for patterns:
- `best-seo-tools-shorts/index.html` — **PRIMARY TEMPLATE** for size standards
- `shorts-video/index.html` — Reference for caption word highlighting
- `channel-intro/index.html` — Reference for scene transitions and flash effects

### Visual Element Size Standards (1080×1920, 9:16)

ALL text and visual elements MUST use these minimum sizes. Do NOT go smaller.

| Element | Min Size | Notes |
|---------|----------|-------|
| **Hero heading** | 100px+ | Main title per scene, font-weight: 900 |
| **Scene heading** | 68px+ | Feature/tool name, font-weight: 900 |
| **Big number/counter** | 200px+ | Stats, scores, "$0" price |
| **Medium body text** | 32-42px | Supporting text, secondary labels, scene subtitles |
| **Badge/label text** | 28px | "KEYWORD INTELLIGENCE", "SEO ANALYSIS", etc. |
| **Table header** | 24px | Column headers, font-weight: 700 |
| **Table row text** | 34px | Data rows in keyword tables, score tables |
| **Score badge** | 32px | Inline score numbers, font-weight: 800 |
| **Ring score value** | 60px | Circular progress ring numbers |
| **Ring label** | 26px | "Title", "Description", "Tags" under rings |
| **Audit/fix item text** | 34px | Fix suggestions, feature descriptions |
| **Audit badge** | 24px | "HIGH", "MED", "LOW" priority badges |
| **Card tag/label** | 22px | Section labels inside cards |
| **Card line text** | 32px | Script lines, feature text inside cards |
| **Feature chip/pill** | 30px | Tool name chips, keyword tags |
| **CTA button text** | 40px | "Launch Free Dashboard" |
| **URL text** | 38px | Website URL |
| **Subtitle text** | 34px | Supporting text, "No credit card required" |
| **Karaoke caption** | 68px | Word-synced captions at bottom |
| **Progress bar** | 6px height | Bottom bar, gradient cyan→green |

### Color Palette (Cyber-Luxe Dark)
```css
--cyan: #00f2ff;        /* Primary, CTAs, highlights */
--green: #00ff88;        /* Success, scores, positive */
--bg: #0a0b10;           /* Background */
--oled: #000000;         /* Deepest blacks */
--card: rgba(16, 20, 32, 0.7);  /* Card glass */
--text: #f0f2f5;         /* Body text */
--muted: #a8b2c1;        /* Secondary text */
--border: rgba(0, 242, 255, 0.15);  /* Borders */
--danger: #ff3366;       /* Errors, warnings */
```

### Typography
- **Font:** Outfit (Google Fonts) or system fallback
- **Headings:** font-weight: 900, letter-spacing: -2px to -5px
- **Body:** font-weight: 500-700
- **Monospace/scores:** font-variant-numeric: tabular-nums

### Animation Rules
- **Flash transitions:** White overlay, 0.15s in + 0.15s out between scenes
- **Entrance:** gsap.from() with y:30-40, opacity:0, duration:0.3-0.7, ease: "power3.out" or "expo.out"
- **Scale pop:** gsap.from() with scale:0-0.85 for big elements
- **Stagger:** chips/pills use stagger:{each:0.08, from:"center"}
- **Counter animations:** gsap.to() with onUpdate for number counting
- **CTA pulse:** scale:1.05 with repeat:3, yoyo:true
- **Particle burst:** 8 particles at 45° intervals, scale 0→2.5, opacity 1→0

### Caption System
- Word-synced highlighting using data-widx attributes
- Per-word timing from transcript.json (Whisper output)
- Highlight color: var(--cyan), dim color: rgba(255,255,255,0.45)
- Caption bar: bottom:120px, centered, z-index:30
- Group entrance: y:40, opacity:0 → visible
- Group exit: y:-15, opacity:0

### Scene Structure (5-7 scenes)
1. **Hook** (0-5s): Pattern interrupt, big number/text
2. **Bridge** (5-12s): Tool intro, "100% FREE" badge
3. **Feature 1** (12-20s): Primary feature showcase
4. **Feature 2** (20-30s): Secondary feature showcase
5. **Feature 3** (30-38s): Tertiary feature showcase
6. **CTA** (38-52s): Price, free badge, launch button, URL

### Audio
- **Narration:** am_michael voice, data-volume: 1
- **Background music:** Copy `bg-music.wav` from `shorts-video/` or generate new music. data-volume: 0.2
- **Track indices:** Narration=130, BGM=131

### File Structure
```
project-name/
├── index.html          # HyperFrames composition
├── narration.txt       # Script text
├── narration.wav       # TTS voiceover
├── narration.json      # Whisper transcript (word-level)
├── bg-music.wav        # Background music
├── meta.json           # Composition metadata
└── youtube-metadata.md # Upload metadata
```

### Workflow
1. Write narration script → generate TTS → transcribe for timestamps
2. Build HTML composition using template sizes above
3. Add word-synced captions from transcript.json
4. Add background music at 20% volume
5. Validate with `npx hyperframes lint` and `npx hyperframes validate`
6. Render with `npx hyperframes render --output promo.mp4`
