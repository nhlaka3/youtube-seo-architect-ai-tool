## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

---

## HyperFrames Composition Standards (ALL Videos)

> **STOP. READ THIS BEFORE WRITING ANY HYPERFRAMES HTML.**
>
> Every coding agent creating HyperFrames compositions MUST follow ALL rules below. No exceptions. These are non-negotiable quality gates.

### Mandatory Pre-Flight Checklist

Before writing ANY composition HTML, complete every item:

- [ ] **Read `design.md`** (or `DESIGN.md`) — if it exists, it defines the brand (colors, fonts, spacing). Use its exact values. Never invent colors or substitute fonts.
- [ ] **Read `references/beat-direction.md`** — plan scene rhythm, choreography verbs, and energy mapping before coding.
- [ ] **Read `references/transitions.md`** — every multi-scene composition MUST have transitions between scenes. No jump cuts.
- [ ] **Read `references/motion-principles.md`** — load-bearing GSAP rules, image motion treatment.
- [ ] **Read `references/typography.md`** — font pairing, minimum sizes, dark-background adjustments.
- [ ] **Read `references/video-composition.md`** — video-medium rules that override web instincts.
- [ ] **Read `references/captions.md`** — if the composition includes narration or voiceover.
- [ ] **If no `design.md` exists** — read `house-style.md` for default palette and motion, or ask the user for mood, light/dark, brand colors.

### Layout Before Animation (Non-Negotiable)

Every composition MUST follow this process:

1. **Build the hero frame first** — position every element at its most visible moment using static CSS.
2. **Use flexbox + padding** — `.scene-content` MUST use `width: 100%; height: 100%; padding: Npx; display: flex; flex-direction: column; gap: Npx; box-sizing: border-box`.
3. **NEVER use `position: absolute` for content containers** — only for decorative overlays. Absolute-positioned content overflows when content is taller than remaining space.
4. **Animate FROM offscreen TO CSS position** — `gsap.from()` for entrances, `gsap.to()` for exits.
5. **CSS position is ground truth** — the tween describes the journey, not the destination.

### Scene Transitions (Non-Negotiable)

Every multi-scene composition MUST follow ALL of these rules. Violating any one = broken composition.

1. **ALWAYS use transitions between scenes.** No jump cuts. No exceptions.
2. **ALWAYS use entrance animations on every scene.** Every element animates IN via `gsap.from()`. No element may appear fully-formed.
3. **NEVER use exit animations** except on the final scene. The transition IS the exit. The outgoing scene's content MUST be fully visible at the moment the transition starts.
4. **Final scene only:** The last scene may fade elements out (e.g., fade to black). This is the ONLY scene where `gsap.to(..., { opacity: 0 })` is allowed.
5. **Use `references/transitions.md`** to pick the right transition type (crossfade, wipe, reveal, shader) based on energy/mood.

### GSAP Animation Rules (Non-Negotiable)

- **All timelines start `{ paused: true }`** — the player controls playback.
- **Register every timeline:** `window.__timelines["<composition-id>"] = tl`
- **Duration comes from `data-duration`**, not from GSAP timeline length.
- **Never create empty tweens** to set duration.
- **Never use `repeat: -1`** — calculate exact repeat count: `repeat: Math.ceil(duration / cycleDuration) - 1`
- **No `Math.random()`, `Date.now()`, or time-based logic** — use seeded PRNG (mulberry32) if needed.
- **Only animate visual properties:** opacity, x, y, scale, rotation, color, backgroundColor, borderRadius, transforms. NEVER animate visibility, display, or call video.play()/audio.play().
- **Never animate the same property** on the same element from multiple timelines simultaneously.
- **Never use `gsap.set()` on clip elements from later scenes** — they don't exist in DOM at page load. Use `tl.set(selector, vars, timePosition)` inside the timeline.
- **Offset first animation 0.1-0.3s** (not t=0).
- **Vary eases across entrance tweens** — use at least 3 different eases per scene.
- **Never repeat an entrance pattern** within a scene.
- **Synchronous timeline construction** — never build timelines inside async/await, setTimeout, or Promises.

### Typography Minimums

| Element | Min Size | Notes |
|---------|----------|-------|
| Hero heading | 100px+ | Main title per scene, font-weight: 900 |
| Scene heading | 68px+ | Feature/tool name, font-weight: 900 |
| Big number/counter | 200px+ | Stats, scores |
| Body text | 32-42px | Supporting text, subtitles |
| Badge/label | 28px | Category labels |
| Caption (karaoke) | 68px | Word-synced at bottom |
| CTA button | 40px | Action buttons |

**Use `window.__hyperframes.fitTextFontSize(text, { maxWidth, fontFamily, fontWeight })` for dynamic text that might overflow.**

### Caption System (When Narration Exists)

- Word-synced highlighting using `data-widx` attributes
- Per-word timing from `transcript.json` (Whisper output via `npx hyperframes transcribe`)
- Highlight color: `var(--cyan)` or accent color, dim color: `rgba(255,255,255,0.45)`
- Caption bar: `bottom: 120px`, centered, `z-index: 30`
- Group entrance: `y: 40, opacity: 0` → visible
- Group exit: `y: -15, opacity: 0`
- Read `references/captions.md` for full implementation details.
- For advanced caption animation (karaoke, clip-path slams, scatter, elastic, 3D), read `references/dynamic-techniques.md`.

### Audio Setup

- **Narration:** Separate `<audio>` element, `data-volume: 1`
- **Background music:** Separate `<audio>` element, `data-volume: 0.2`
- **Video audio:** Use `muted playsinline` on `<video>`, separate `<audio>` for sound
- **Track indices:** Assign unique track indices; same-track clips cannot overlap
- **NEVER use video for audio** — always muted video + separate `<audio>`
- **NEVER nest video inside a timed div** — use a non-timed wrapper

### TTS → Transcribe → Captions Pipeline

When no pre-recorded voiceover exists:

```bash
npx hyperframes tts script.txt --voice af_nova --output narration.wav
npx hyperframes transcribe narration.wav  # → transcript.json
```

Use `references/captions.md` for word-synced caption implementation.

### Audio-Reactive Visuals (When Music Drives the Video)

Read `references/audio-reactive.md` to map frequency bands and amplitude to GSAP properties. Use for:
- Beat-synced glow/pulse effects
- Bass-driven scale animations
- Treble-driven particle effects
- Volume-reactive color shifts

### Quality Gates (Run Before Every Render)

**Fast (block on results):**
```bash
npx hyperframes lint          # structural errors, missing data attributes, overlapping tracks
npx hyperframes validate      # WCAG contrast, layout
```

**Thorough (run in parallel):**
```bash
npx hyperframes inspect       # visual overflow detection in headless Chrome
npx hyperframes inspect --samples 15   # dense timeline sweep
```

**After animation authoring:**
```bash
node skills/hyperframes/scripts/animation-map.mjs <dir> --out <dir>/.hyperframes/anim-map
```

Fix ALL errors before rendering. Warnings should be reviewed and either fixed or justified.

### Common Mistakes to Avoid

1. ❌ Forgetting `window.__timelines` registration
2. ❌ Using video for audio — always muted video + separate `<audio>`
3. ❌ Nesting video inside a timed div
4. ❌ Using `data-layer` (use `data-track-index`) or `data-end` (use `data-duration`)
5. ❌ Animating video element dimensions — animate a wrapper div
6. ❌ Calling play/pause/seek on media — framework owns playback
7. ❌ Creating a top-level container without `data-composition-id`
8. ❌ Using `repeat: -1` — always finite repeats
9. ❌ Building timelines asynchronously
10. ❌ Using `<br>` in content text — let text wrap via `max-width` instead
11. ❌ Full-screen linear gradients on dark backgrounds (H.264 banding) — use radial or solid + glow
12. ❌ Exit animations before transitions — transition IS the exit
13. ❌ Jump cuts between scenes — always use transitions
14. ❌ Inventing colors not in design.md

### File Structure

```
project-name/
├── index.html              # Root composition
├── compositions/           # Sub-compositions (loaded via data-composition-src)
│   ├── scene-1.html
│   └── components/
│       └── grain-overlay.html
├── narration.txt           # Script text
├── narration.wav           # TTS voiceover
├── transcript.json         # Whisper word-level timestamps
├── bg-music.wav            # Background music
├── meta.json               # Composition metadata
└── youtube-metadata.md     # Upload metadata
```

### Variables (Reusable Compositions)

For compositions that render with different content, declare variables:

```html
<html data-composition-variables='[
  {"id":"title","type":"string","label":"Title","default":"Hello"},
  {"id":"theme","type":"enum","label":"Theme","default":"dark","options":[
    {"value":"dark","label":"Dark"},{"value":"light","label":"Light"}
  ]}
]'>
```

Read via `window.__hyperframes.getVariables()` at top of script. Override at render:
```bash
npx hyperframes render --variables '{"title":"Episode 1","theme":"dark"}'
```

### Registry (Pre-Built Blocks & Components)

Use `hyperframes add` to install reusable blocks and components:
```bash
hyperframes add data-chart           # animated data visualization
hyperframes add grain-overlay        # film grain texture
hyperframes add shimmer-sweep        # light sweep transition
```

Browse available items:
```bash
curl -s https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry/registry.json
```

### Rendering

**Quality guidance:** `draft` while iterating, `standard` for review, `high` for final delivery.

```bash
npx hyperframes render                    # standard MP4
npx hyperframes render --quality draft    # fast iteration
npx hyperframes render --quality high     # final delivery
npx hyperframes render --fps 60           # smooth playback
npx hyperframes render --docker           # byte-identical
```

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
