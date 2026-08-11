## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

---

## Superpowers — Development Methodology

Superpowers is a complete software development methodology installed in `superpowers/`. It provides composable skills that auto-trigger at the right moments during development work. **Every agent working on this project MUST follow the Superpowers workflow for any feature work, bug fixes, or multi-step implementation tasks.**

### The Workflow

1. **brainstorming** → Explores user intent, requirements, and design before any code is written. Refines rough ideas through questions, presents design in sections for validation. Saves design doc to `docs/superpowers/specs/`.
2. **using-git-worktrees** → Creates an isolated workspace on a new branch. Detects existing isolation first, then uses native tools, then falls back to git worktrees.
3. **writing-plans** → Breaks approved design into bite-sized tasks (2-5 min each). Every task has exact file paths, complete code, verification steps, and TDD cycles. Saves to `docs/superpowers/plans/`.
4. **subagent-driven-development** or **executing-plans** → Dispatches fresh subagent per task with two-stage review (spec compliance → code quality), or executes inline with human checkpoints.
5. **test-driven-development** → Enforces RED-GREEN-REFACTOR: write failing test → watch it fail → write minimal code → watch it pass → commit. Code written before tests must be deleted.
6. **requesting-code-review** / **receiving-code-review** → Reviews against plan, reports issues by severity. Technical rigor over performative agreement.
7. **verification-before-completion** → Evidence before claims. No completion claims without fresh verification output.
8. **finishing-a-development-branch** → Verifies tests, presents merge/PR/keep/discard options, cleans up worktree.

### Skills Library

| Skill | Path | When to Use |
|-------|------|-------------|
| **using-superpowers** | `superpowers/skills/using-superpowers/` | Session start — establishes skill discovery and priority rules |
| **brainstorming** | `superpowers/skills/brainstorming/` | Before ANY creative work — features, components, behavior changes. Explores intent, proposes 2-3 approaches, presents design for approval. |
| **writing-plans** | `superpowers/skills/writing-plans/` | After approved design — creates implementation plan with bite-sized TDD tasks, exact file paths, complete code. |
| **executing-plans** | `superpowers/skills/executing-plans/` | When you have a written plan and need to execute it in a separate session with review checkpoints. |
| **subagent-driven-development** | `superpowers/skills/subagent-driven-development/` | When executing plans with independent tasks in the current session — dispatches fresh subagent per task with two-stage review. |
| **test-driven-development** | `superpowers/skills/test-driven-development/` | During ANY implementation — write failing test first, watch it fail, write minimal code, watch it pass. Delete code written before tests. |
| **systematic-debugging** | `superpowers/skills/systematic-debugging/` | When encountering ANY bug, test failure, or unexpected behavior — 4-phase process: root cause → pattern analysis → hypothesis testing → implementation. |
| **dispatching-parallel-agents** | `superpowers/skills/dispatching-parallel-agents/` | When facing 2+ independent tasks that can be worked on without shared state — one agent per problem domain. |
| **requesting-code-review** | `superpowers/skills/requesting-code-review/` | After completing tasks or major features — dispatch reviewer subagent with precise context. |
| **receiving-code-review** | `superpowers/skills/receiving-code-review/` | When receiving review feedback — verify before implementing, push back with reasoning if wrong. No performative agreement. |
| **using-git-worktrees** | `superpowers/skills/using-git-worktrees/` | Before starting feature work — ensures isolated workspace via native tools or git worktree fallback. |
| **finishing-a-development-branch** | `superpowers/skills/finishing-a-development-branch/` | When all tasks complete and tests pass — verify → present options (merge/PR/keep/discard) → execute choice → cleanup. |
| **verification-before-completion** | `superpowers/skills/verification-before-completion/` | Before ANY completion claim — run verification command, read output, THEN claim result. Evidence before assertions. |
| **writing-skills** | `superpowers/skills/writing-skills/` | When creating or editing skills — TDD applied to process documentation: baseline test → write skill → verify compliance. |

### Philosophy

- **Test-Driven Development** — Write tests first, always. No production code without a failing test.
- **Systematic over ad-hoc** — Process over guessing. Root cause before fixes.
- **Complexity reduction** — YAGNI ruthlessly. Simplicity as primary goal.
- **Evidence over claims** — Verify before declaring success. Fresh output, not memory.
- **Subagent isolation** — Fresh context per task. Never inherit session history.
- **Two-stage review** — Spec compliance first, then code quality. Wrong order = wrong results.

### Rule Priority

Superpowers skills override default system prompt behavior, but **user instructions always take precedence**:
1. **User's explicit instructions** (CLAUDE.md, GEMINI.md, AGENTS.md, direct requests) — highest priority
2. **Superpowers skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

### Skill Loading

**In Claude Code:** Use the `Skill` tool to load skill content on demand.
**In other environments:** Skills auto-trigger based on context. If there is even a 1% chance a skill might apply, invoke it.

Red flag thoughts (rationalization traps):
- "This is just a simple question" → Questions are tasks. Check for skills.
- "I need more context first" → Skill check comes BEFORE clarifying questions.
- "This doesn't need a formal skill" → If a skill exists, use it.

---

## Skills Reference

### Skill Directories

Skills live in four directories, each with a different purpose:

| Directory | Purpose |
|-----------|---------|
| **`.agents/skills/`** | HyperFrames ecosystem skills — video composition, animations, rendering, media processing. Install via `hyperframes add`. |
| **`.agent/skills/`** | Core project skills — SEO fundamentals, code quality, brainstorming, planning. Project-specific, not from a public registry. |
| **`skills/`** | Public skill registry — hundreds of community skills for SEO, content, social, analytics, debugging, and more. Install via skill marketplace. |
| **`skills2/ecc/`** | ECC (Extended Content & Code) skills — article writing, brand voice, content engine, video editing workflows, Manim, Remotion. Curated for content production. |
| **`superpowers/skills/`** | Superpowers methodology — development workflow skills (brainstorming, TDD, code review, debugging). Auto-trigger based on context. |

**Rule:** When a skill exists in multiple directories, prefer the more specific one for the current task. Superpowers methodology always takes precedence for development workflows.

Every agent working on this project MUST load the relevant skills before performing any task. Skills auto-trigger based on context, but agents should proactively read the ones listed below.

### Video Production Skills (Tier 1 — Essential)

| Skill | Source Path | When to Activate |
|-------|-------------|------------------|
| **`hyperframes`** | `.agents/skills/hyperframes/SKILL.md` | Building any video composition, title card, overlay, or animation. Master skill — always load first for video work. |
| **`gsap`** | `.agents/skills/gsap/SKILL.md` | Writing GSAP timelines, easing, stagger, playback. Load when writing `<script>` blocks with `gsap.to()`, `gsap.from()`, `gsap.timeline()`. |
| **`hyperframes-media`** | `.agents/skills/hyperframes-media/SKILL.md` | TTS narration (`npx hyperframes tts`), transcription (`npx hyperframes transcribe`), background removal. Load before any audio/asset preprocessing. |
| **`hyperframes-cli`** | `.agents/skills/hyperframes-cli/SKILL.md` | CLI dev loop: `npx hyperframes lint`, `validate`, `inspect`, `preview`, `render`. Load when running any HyperFrames CLI command. |

> **Note:** `seo-fundamentals` and `geo-fundamentals` have been moved to the SEO Skills section below.

### Video Production Skills (Tier 2 — Important)

| Skill | Source Path | When to Activate |
|-------|-------------|------------------|
| **`css-animations`** | `.agents/skills/css-animations/SKILL.md` | CSS keyframe patterns for HyperFrames. Complements GSAP — use for pure CSS motion where JS isn't needed. |
| **`hyperframes-registry`** | `.agents/skills/hyperframes-registry/SKILL.md` | Installing reusable blocks (`hyperframes add grain-overlay`, `data-chart`, `shimmer-sweep`). Load when adding pre-built components. |
| **`three`** | `.agents/skills/three/SKILL.md` | Three.js/WebGL for 3D data visualizations, animated stat reveals, interactive scenes. Load when episode plans call for "3D/WebGL" visuals. |
| **`lottie`** | `.agents/skills/lottie/SKILL.md` | After Effects export integration. Load when embedding `.json` or `.lottie` animation files. |
| **`tailwind`** | `.agents/skills/tailwind/SKILL.md` | Tailwind CSS v4 for dashboard pages, landing pages, and UI components. Load when building web-facing content. |
| **`animejs`** | `.agents/skills/animejs/SKILL.md` | Anime.js adapter for alternative animation timelines. Load when using Anime.js instead of GSAP. |
| **`waapi`** | `.agents/skills/waapi/SKILL.md` | Web Animations API for lightweight, native browser animations. Load when using `element.animate()` instead of GSAP. |

### Content & Writing Skills

| Skill | Source Path | When to Activate |
|-------|-------------|------------------|
| **`article-writing`** | `skills2/ecc/article-writing/` | Writing blog posts, Medium articles, narration scripts, newsletter issues. Load when creating long-form written content. |
| **`brand-voice`** | `skills2/ecc/brand-voice/` | Maintaining consistent voice across all content — videos, blogs, descriptions, social posts. Load when voice consistency matters. |
| **`content-engine`** | `skills2/ecc/content-engine/` | Scaling content production workflows. Load when batching multiple videos or cross-posting. |
| **`content-creator`** | `skills/content-creator/` | Brand voice analysis, SEO optimization, and platform-specific content frameworks. Load when creating content across platforms. |
| **`copywriting`** | `skills/copywriting/` | Conversion-focused marketing copy for landing pages and emails. Load when writing sales copy or email sequences. |
| **`blog-writing-guide`** | `skills/blog-writing-guide/` | Blog writing standards. Load when creating blog posts or articles. |
| **`social-content`** | `skills/social-content/` | Social media strategist for Instagram, LinkedIn, Facebook. Load when creating social media content. |
| **`social-post-writer-seo`** | `skills/social-post-writer-seo/` | Social posts with SEO optimization. Load when writing social media posts that need search visibility. |
| **`data-storytelling`** | `skills/data-storytelling/` | Transform raw data into compelling narratives. Load when presenting analytics, metrics, or data-driven content. |

### SEO Skills

| Skill | Source Path | When to Activate |
|-------|-------------|------------------|
| **`seo`** | `skills/seo/` | Umbrella SEO audit — technical, on-page, schema, sitemaps, content quality, AI readiness. Load when user asks for full SEO analysis. |
| **`seo-content-writer`** | `skills/seo-content-writer/` | Writes SEO-optimized content from keywords/topic briefs. Load when creating SEO content. |
| **`seo-keyword-strategist`** | `skills/seo-keyword-strategist/` | Keyword analysis, density, semantic variations, LSI keywords. Load when optimizing keyword usage. |
| **`seo-audit`** | `skills/seo-audit/` | Diagnose SEO issues affecting crawlability, indexation, rankings. Load when troubleshooting SEO problems. |
| **`seo-content-planner`** | `skills/seo-content-planner/` | Content outlines, topic clusters for SEO. Load when planning content strategy. |
| **`seo-technical`** | `skills/seo-technical/` | Technical SEO audit — crawlability, Core Web Vitals, structured data. Load for technical SEO checks. |
| **`seo-meta-optimizer`** | `skills/seo-meta-optimizer/` | Meta titles, descriptions, URL suggestions. Load when optimizing page metadata. |
| **`seo-structure-architect`** | `skills/seo-structure-architect/` | Header hierarchy, schema markup, internal linking. Load when restructuring content for SEO. |
| **`seo-content-auditor`** | `skills/seo-content-auditor/` | Content quality scoring, E-E-A-T signals. Load when auditing existing content. |
| **`seo-aeo-blog-writer`** | `skills/seo-aeo-blog-writer/` | Blog posts with TL;DR, definition, comparison table, FAQ for SEO + AEO. Load when writing blog posts. |
| **`seo-aeo-keyword-research`** | `skills/seo-aeo-keyword-research/` | Keyword research with AEO question queries. Load when researching keywords. |
| **`seo-aeo-content-cluster`** | `skills/seo-aeo-content-cluster/` | Topical authority maps, pillar pages, cluster articles. Load when building content clusters. |
| **`seo-aeo-meta-description-generator`** | `skills/seo-aeo-meta-description-generator/` | Title tags, meta descriptions, OG/Twitter tags. Load when generating meta tags. |
| **`seo-schema`** | `skills/seo-schema/` | JSON-LD structured data for 10 schema types. Load when adding schema markup. |
| **`seo-snippet-hunter`** | `skills/seo-snippet-hunter/` | Featured snippet optimization. Load when optimizing for SERP features. |
| **`seo-programmatic`** | `skills/seo-programmatic/` | Programmatic SEO pages at scale. Load when building template-based SEO pages. |
| **`seo-cannibalization-detector`** | `skills/seo-cannibalization-detector/` | Keyword overlap and cannibalization analysis. Load when reviewing similar content. |
| **`seo-authority-builder`** | `skills/seo-authority-builder/` | E-E-A-T signal improvements. Load when strengthening content authority. |
| **`seo-image-gen`** | `skills/seo-image-gen/` | SEO-focused images — OG cards, hero images, infographics. Load when generating images for SEO. |
| **`seo-forensic-incident-response`** | `skills/seo-forensic-incident-response/` | Traffic/ranking drop investigation. Load when diagnosing sudden SEO performance changes. |
| **`seo-geo`** | `skills/seo-geo/` | GEO — AI Overviews, ChatGPT, Perplexity optimization. Load when optimizing for AI search. |
| **`seo-aeo-content-quality-auditor`** | `skills/seo-aeo-content-quality-auditor/` | Content scoring with severity-ranked fixes. Load when auditing content for SEO/AEO compliance. |
| **`seo-aeo-landing-page-writer`** | `skills/seo-aeo-landing-page-writer/` | Landing pages for SEO + AEO + conversion. Load when writing landing pages. |
| **`seo-aeo-schema-generator`** | `skills/seo-aeo-schema-generator/` | JSON-LD structured data generation. Load when generating schema markup. |
| **`seo-aeo-internal-linking`** | `skills/seo-aeo-internal-linking/` | Internal link mapping and orphan detection. Load when building internal linking strategy. |
| **`seo-fundamentals`** | `.agent/skills/seo-fundamentals/` | YouTube SEO strategy, keyword research, metadata optimization, ranking signals. Load when writing video titles, descriptions, tags, or blog posts. |
| **`geo-fundamentals`** | `.agent/skills/geo-fundamentals/` | Generative Engine Optimization — getting cited in AI responses (ChatGPT, Perplexity, SGE). Load when optimizing content for AI search visibility. |

### Analytics Skills

| Skill | Source Path | When to Activate |
|-------|-------------|------------------|
| **`analytics-tracking`** | `skills/analytics-tracking/` | Design, audit, improve analytics tracking systems. Load when setting up or reviewing analytics. |

### Video Editing & Production Skills (No API Key Required)

| Skill | Source Path | When to Activate |
|-------|-------------|------------------|
| **`youtube-summarizer`** | `skills/youtube-summarizer/` | Extract transcripts from YouTube videos and generate comprehensive summaries. Load when the user shares a YouTube link or asks to summarize a video. |
| **`remotion`** | `skills/remotion/` | Generate walkthrough videos from projects using Remotion with smooth transitions, zooming, and text overlays. Load when building React-based video compositions. |
| **`remotion-best-practices`** | `skills/remotion-best-practices/` | Best practices for Remotion — Video creation in React. 29 domain-specific rules covering 3D, animations, audio, captions, charts, transitions. Load when writing any Remotion code. |
| **`remotion-video-creation`** | `skills2/ecc/remotion-video-creation/` | Best practices for Remotion — Video creation in React. Load when building React-based video compositions. |
| **`manim-video`** | `skills2/ecc/manim-video/` | Build reusable Manim explainers for technical concepts, graphs, system diagrams, and product walkthroughs. Load when creating animated mathematical/technical visualizations. |

### Development Process Skills

| Skill | Source Path | When to Activate |
|-------|-------------|------------------|
| **`continuous-agent-loop`** | `skills2/ecc/continuous-agent-loop/` | Running agents autonomously for batch video production. Load when automating multi-episode pipelines. |
| **`lint-and-validate`** | `.agent/skills/lint-and-validate/` | Code quality enforcement. Load before any commit or deployment to catch errors early. |

Note: `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `dispatching-parallel-agents`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch`, and `verification-before-completion` are all managed by the Superpowers methodology above. Load via the `Skill` tool when triggered.

### Skill Loading Protocol

1. **Read `SKILL.md` first** — this is the index. Do NOT read all files in a skill folder.
2. **Read only the sections matching the current task** — selective reading saves context.
3. **Rule priority:** `AGENTS.md` (P0) > Agent `.md` (P1) > `SKILL.md` (P2). All rules are binding.
4. **Never skip loading skills** — "Read → Understand → Apply" is mandatory.

---

## HyperFrames Composition Standards (ALL Videos)

> **STOP. READ THIS BEFORE WRITING ANY HYPERFRAMES HTML.**
>
> Every coding agent creating HyperFrames compositions MUST follow ALL rules below. No exceptions. These are non-negotiable quality gates.
>
> ### MANDATORY: Read These Files BEFORE Any Composition Work
>
> Before writing a SINGLE line of HTML or starting ANY video composition, you MUST:
>
> 1. **Read `vidtemplate.txt`** — defines the 5-frame retention structure, pacing, animation philosophy. Non-negotiable. Every scene follows it.
> 2. **Read `design.md`** (or `DESIGN.md`) — defines brand colors, fonts, spacing. Use exact values. Never invent.
> 3. **Read `references/transitions.md`** — every scene change needs a transition. No jump cuts.
> 4. **Read `references/captions.md`** — word-synced captions if narration exists.
> 5. **Read `references/motion-principles.md`** — load-bearing GSAP rules.
> 6. **Read `AGENTS.md` section "Manim + HyperFrames Hybrid Pipeline"** — EVERY video must be a 50/50 blend of Manim and HyperFrames. Manim provides the animated data visuals; HyperFrames provides the retention structure, captions, and branding. The video should feel like one production, split equally between both. Skip this = rejected video.
>
> **If you skip any of these files, your composition will be rejected.** This is not optional. The user has complained about agents building videos without reading the spec first.

## Video Type Guidelines Quick Reference

### YouTube Shorts (9:16, 60s max)
- **Format:** 5-7 scenes total, 38-52s runtime (varies by platform)
- **Scene count:** 5-7 scenes (Hook, Bridge, Feature 1, Feature 2, Feature 3, CTA)
- **Scene duration:** 5-12s each (most 8-15s)
- **Visual pacing:** New element every 2-3 seconds (faster retention)
- **Caption size:** 68px minimum
- **Font sizes:** 100-200px for key elements
- **Manim integration:** 1-2 quick clips (5-12s each)

### YouTube Longform (16:9, 10+ mins)
- **Format:** 5-frame structure, 5-7 major scenes
- **Scene count:** 5-7 scenes (Hook, Bridge, Value Spine, Climax Payoff, Loop Close)
- **Scene duration:** 30-120s each (longform pacing)
- **Visual pacing:** New element every 5-7 seconds minimum
- **Caption size:** 52px minimum
- **Font sizes:** 80-160px for key elements
- **Manim integration:** 3+ scenes (2-3 scenes, 15-45s each)

**Common Requirements (Both Shorts & Longform):**
- 50/50 Manim + HyperFrames blend (Manim provides animated data visuals, HyperFrames provides retention/branding)
- 5-frame retention structure: Hook → Bridge → Value Spine → Climax Payoff → Loop Close
- Keyword-driven data icons as primary visuals
- Flash transitions (0.15s in + out) between scenes
- Word-synced captions from transcript.json
- Audio at 1.2x pacing, background music at 20% volume
- Register all timelines: `window.__timelines["<composition-id>"] = tl`
- GSAP animations offset by 0.1-0.3s (not t=0)
- New visual element every 2-7 seconds (faster for shorts, slower for longform)
- Hook in first 5 seconds, no cold opens
- Must run `npx hyperframes lint && npx hyperframes validate` before rendering

### MANDATORY: Verify Before Rendering

Before running `npx hyperframes render`, confirm EVERY item below. If any step is missing, DO NOT RENDER — go back and fix it.

- [ ] `vidtemplate.txt` was read — 5-frame structure followed (Cold Hook → Context Bridge → Value Spine → Climax Payoff → Loop Close)
- [ ] `design.md` was read — exact brand colors and fonts used, no invented values
- [ ] `references/transitions.md` was read — transitions between every scene, no jump cuts
- [ ] `references/captions.md` was read — word-synced captions implemented if narration exists
- [ ] `references/motion-principles.md` was read — GSAP rules followed
- [ ] **Manim scenes cover ~50% of total runtime** — Manim and HyperFrames share the video equally. The total duration of all Manim clips should be roughly half the video length. Manim provides the primary data visuals; HyperFrames provides hooks, bridges, CTAs, and the retention framework.
- [ ] Manim clips are paced with new visuals every 4-6s internally (no single 15s static shot)
- [ ] Manim output was re-encoded with proper keyframes (`-g 30 -keyint_min 30 -movflags +faststart`)
- [ ] Manim MP4 is referenced as direct child of `.root` with `data-start`/`data-duration`
- [ ] Keyword-driven data icons are the PRIMARY visuals — every major statement has a matching icon/graph, not just text
- [ ] Every major statement has a direct visual representation
- [ ] New visual element appears every 5-7 seconds minimum (longform) or 2-3 seconds (shorts)
- [ ] Hook hits in first 5 seconds — no cold open, no intro bumper
- [ ] `npx hyperframes lint` passes with 0 errors
- [ ] `npx hyperframes validate` passes with 0 errors
- [ ] Audio pacing is 1.2x — narration transcribed with Whisper and word-level timestamps used for sync
- [ ] Background music at 20% volume (data-volume: 0.2)

**Checklist not complete? Do not render. The user will reject the output.**

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
2. **Design and render the Manim scene(s)** — identify the key stat/concept to visualize as a Manim animation. See "Manim + HyperFrames Hybrid Pipeline" section.
3. Build HTML composition using template sizes above — embed Manim MP4 as direct `<video>` child of `.root`
4. Add word-synced captions from transcript.json
5. Add background music at 20% volume
6. Validate with `npx hyperframes lint` and `npx hyperframes validate`
7. Render with `npx hyperframes render --output promo.mp4`

---

## YouTube Longform Video Composition Template

> **STOP. READ THIS BEFORE WRITING ANY HTML.**
>
> If a user asks you to create a YouTube longform video, episode, tutorial, or any HyperFrames composition in 16:9 format — you MUST do the following BEFORE writing a single line of code:
>
> 1. **Read `vidtemplate.txt`** — This defines the 5-frame retention structure, pacing rules, and animation philosophy. **Longform uses the EXACT SAME 5-frame structure as Shorts.** Every scene must follow it.
> 2. **Read `design.md`** (or `DESIGN.md`) — if it exists, it defines the brand (colors, fonts, spacing). Use its exact values. This applies to ALL videos, not just shorts.
> 3. **Read this entire Longform section** — This defines the minimum visual element sizes, color palette, typography, animation patterns, caption system, and file structure for 16:9.
> 4. **Read `references/transitions.md`** — every scene change needs a transition. No jump cuts.
> 5. **Read `references/captions.md`** — if narration exists, word-synced captions are mandatory.
> 6. **If no `design.md` exists** — read `house-style.md` for default palette and motion, or ask the user for mood, light/dark, brand colors.
>
> **DO NOT GUESS at font sizes. DO NOT use smaller text than the minimums below.**
>
> After writing the composition, run `npx hyperframes lint` and `npx hyperframes validate` before rendering.

### Reference Compositions
Study these existing compositions for patterns:
- `best-seo-tools-shorts/index.html` — **PRIMARY TEMPLATE** for size standards (adapt sizes for 16:9)
- `shorts-video/index.html` — Reference for caption word highlighting
- `channel-intro/index.html` — Reference for scene transitions and flash effects

### Primary Visual System: Keyword-Driven Data Icons

**The most important visual element in every composition is the keyword-driven data icon.** Not text. Not cards. Icons that match narration keywords to visual representations.

| Keyword | Visual |
|---------|--------|
| "Stop!" | Physical Danger/Stop Sign graphic |
| "Cliff Drop" | Falling retention curve visualization |
| "Satisfaction" | Brain/Gear icon for algorithm Satisfaction Signal |
| "45 Seconds" | Countdown/Timer visual for re-hook window |
| "Micro-Hook" | Magnet graphic showing engagement pull |
| "Angle Change" | Camera/Aperture visual for pattern interrupts |
| "12 Channels" | Data verification/Proof chart |
| "42% Lift" | Explosive growth/Success chart |
| "Auditor" | UI diagnostic visual for the fix |
| "Link in Bio" | Final CTA with branding |

**Rules:**
- Every major statement must have a keyword-driven icon or visual directly representing what is being said
- Icons animate in via GSAP (scale pop, fade, slide) — never appear static
- If holding a frame longer than 5 seconds, add a new keyword icon, graph, or counter
- Pair icons with animated counters, progress bars, or glow effects for emphasis

### Visual Element Size Standards (1920×1080, 16:9)

ALL text and visual elements MUST use these minimum sizes. Do NOT go smaller.

| Element | Min Size | Notes |
|---------|----------|-------|
| **Hero heading** | 80px+ | Main title per scene, font-weight: 900 |
| **Scene heading** | 52px+ | Feature/tool name, font-weight: 900 |
| **Big number/counter** | 160px+ | Stats, scores |
| **Medium body text** | 28-36px | Supporting text, subtitles |
| **Badge/label text** | 22px | Category labels |
| **Table row text** | 28px | Data rows |
| **CTA button text** | 36px | Action buttons |
| **Karaoke caption** | 52px | Word-synced at bottom |
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

### Scene Structure (5-Frame Retention Model — SAME AS SHORTS)
Follow the EXACT SAME 5-frame structure from vidtemplate.txt:

1. **Frame 1: Cold Hook** (0-5s): Pattern interrupt, big number/text. Flash white overlay.
2. **Frame 2: Context Bridge** (5-30s): Justify the hook, set expectations. "By the end of this video..." preview.
3. **Frame 3: Value Spine** (30s-80%): Main content body. Subdivided into micro-frames (60-120s each). Every micro-frame: mini-hook → core point → proof/example → transition tease. **New visual element every 5-7 seconds minimum. Scene changes every 5-7 seconds.**
4. **Frame 4: Climax Payoff** (Final 10-20%): Deliver the "one big idea" or framework. Most visually impactful moment.
5. **Frame 5: Loop Close** (Final 15-30s): End screen elements, "next episode" tease, CTA.

### Pacing Rules
- **Audio pacing:** 1.2x (same as shorts)
- **Scene changes:** Every 5-7 seconds (longform pacing)
- **Visual elements:** New element every 5-7 seconds minimum
- **If holding a frame longer than 5 seconds:** add graphs, counters, or new elements
- **Every major statement must have a direct visual representation**
- **Hook in first 5 seconds** — no cold open, no intro bumper

### Caption System
- Word-synced highlighting using data-widx attributes
- Per-word timing from transcript.json (Whisper output)
- Highlight color: var(--cyan), dim color: rgba(255,255,255,0.45)
- Caption bar: bottom:120px, centered, z-index:30
- Group entrance: y:40, opacity:0 → visible
- Group exit: y:-15, opacity:0

### Audio
- **Narration:** am_michael voice, data-volume: 1
- **Background music:** data-volume: 0.2
- **Track indices:** Narration=130, BGM=131
- **Transcribe narration with Whisper after TTS** — use word-level timestamps to sync visuals
- **Never assume timing** — verify with transcript.json

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
1. Write narration script following 5-frame structure from vidtemplate.txt
2. Generate TTS → transcribe for timestamps
3. **Design and render the Manim scene(s)** — identify 1-3 stats/concepts to visualize as Manim animations. See "Manim + HyperFrames Hybrid Pipeline" section for scene types.
4. Build HTML composition using template sizes above — embed Manim MP4(s) as direct `<video>` children of `.root`
5. Add word-synced captions from transcript.json
6. Add background music at 20% volume
7. Validate with `npx hyperframes lint` and `npx hyperframes validate`
8. Render with `npx hyperframes render --output video.mp4`

---

## Manim + HyperFrames Hybrid Pipeline

> **MANDATORY: 50/50 SPLIT for EVERY video.** Manim and HyperFrames share the video equally — roughly half the runtime is Manim-generated animation, half is HyperFrames retention wrapping. Manim provides the animated data visuals (stats, bars, charts, diagrams, counters). HyperFrames provides the 5-frame retention structure (hooks, bridges, captions, branding, CTAs, transitions).
>
> A video that's 90% HyperFrames with a single 5-second Manim clip tacked on is REJECTED. The two engines should alternate throughout — Manim clip → HF segment → Manim clip → HF segment — feeling like one cohesive production.

### When to Use Manim

Manim generates **animated motion graphics** for every video. For YouTube SEO tutorials, use Manim for:

- **Animated stat reveals** — numbers scale up, bars grow, percentages count up from 0
- **Data visualization** — bar charts, line graphs, pie charts building in real time with labels
- **Diagram reveals** — flowcharts, funnel diagrams, comparison splits, step-by-step process builds
- **Counter animations** — large numbers ticking up (e.g., "10x traffic", "5,000 backlinks")
- **Keyword/SERP visualizations** — animated search result pages, ranking position changes, SERP features lighting up
- **Before/after comparisons** — side-by-side reveals, split-screen wipe animations
- **Animated metrics** — bounce rates dropping, rankings climbing, traffic curves growing
- **Custom motion text** — Manim's Tex/MathTex for clean animated formula-like statements, bullet points building in sequence
- **LaTeX-powered titles** — clean mathematical/statistical notation for data-heavy scenes

**Do NOT use Manim for:** text overlays, branding, decorative icons, transitions between scenes, captions, CTAs, audio — that's HyperFrames territory. HyperFrames handles the wrapping; Manim provides the animated visual punch.

### Scene Types for YouTube Tutorials

Create a Manim scene for each major stat/concept. Typical video uses 1-3 short scenes:

1. **Stat Reveal** (5-8s): A number grows from 0 to its final value with a progress ring or bar behind it. Use for: "5,000 monthly searches", "68% higher CTR", "10x more traffic".
2. **Data Bar Graph** (8-12s): A bar chart comparing metrics (e.g., click-through rates by position, traffic sources). Bars animate in one by one.
3. **SERP Diagram** (8-10s): An animated search results page showing how featured snippets, People Also Ask, and knowledge panels occupy screen real estate.
4. **Ranking Motion** (6-8s): A position marker (#1, #2, #3) moving up the rankings with each iteration.
5. **Funnel Build** (8-10s): A conversion funnel building in stages with percentages appearing at each level.

### The 4 Integration Patterns

**Pattern 1 — Embedded Hero Clip (Default for tutorials):** Manim renders a standalone visualization. HyperFrames plays it fullscreen as `<video>` with branded overlays (title badge, caption bar, annotation). Best for: stat reveals, data graphs, ranking animations.

**Pattern 2 — b-Roll Corner Inset:** Manim runs in a smaller inset while the main frame shows HyperFrames text/icons. Best for: showing a supporting metric while explaining a concept in text.

**Pattern 3 — Sequential Montage:** Multiple short Manim clips play back-to-back within a single HyperFrames scene, each with different overlay annotations. Best for: "3 reasons why" or multi-metric comparisons.

**Pattern 4 — Full Hybrid Scene:** Manim generates the primary visual (chart/diagram). HyperFrames overlays labels, highlight rings, badges, and counters that react in sync with the clip. Best for: deep dives into a single data point.

### File Structure for Hybrid Projects

```
project-name/
├── index.html                    # HyperFrames composition (embedding .mp4)
├── manim/                        # Manim source (optional — keep if iterating)
│   └── scene.py
├── *.mp4                         # Pre-rendered Manim clips (copied here)
└── meta.json
```

### Rendering Pipeline

```bash
# 1. Render Manim scene (CPU-only, draft quality for iteration)
source ~/.venv/manim/bin/activate
manim -ql manim/scene.py SceneName    # 480p15 draft
manim -qh manim/scene.py SceneName    # 1080p60 production

# 2. Copy output to HyperFrames project
cp ~/manim/media/videos/scene/1080p60/SceneName.mp4 project-name/

# 3. Re-encode with proper keyframes for HyperFrames compatibility
ffmpeg -i project-name/SceneName.mp4 -c:v libx264 -r 30 -g 30 -keyint_min 30 -movflags +faststart -pix_fmt yuv420p project-name/SceneName_rendered.mp4 -y

# 4. Reference in index.html as direct child of .root with data-start/data-duration
#    <video muted playsinline src="SceneName_rendered.mp4" data-start="T" data-duration="D"
#           style="position:absolute;inset:0;width:1920px;height:1080px;object-fit:cover;z-index:1;pointer-events:none"></video>

# 5. Lint, validate, render (see HyperFrames workflow above)
npx hyperframes lint && npx hyperframes validate && npx hyperframes render --output video.mp4
```

### WSL Rendering Limitation

> **Headless Chrome on WSL (3.8GB RAM) crashes when capturing frames from compositions with embedded `<video>` elements.** The error is "Attempted to use detached Frame". The HTML preview works in a real browser — only the `npx hyperframes render` command fails.
>
> **Workarounds:**
> - **Option A (local proof):** Render the HyperFrames composition without the video element (text/overlays only), then composite with the Manim MP4 via FFmpeg overlay filter.
> - **Option B (production):** Run the render on a machine with >=8GB RAM, a real GPU, or use a cloud CI runner.
> - **Option C (preview only):** Open `index.html` in Chrome on the Windows host (not WSL) — the composition previews and plays correctly including the video.

### Key Constraints

- Manim venv: `~/.venv/manim/bin/activate` — Python 3.13, Manim v0.20.1
- LaTeX via `~/texmf/` (standalone.cls extracted manually — `sudo apt` unavailable)
- Always use `-ql` for iteration, `-qh` for final
- Manim output color scheme: dark background (#0a0b10), cyan accents (#00f2ff) — matches Cyber-Luxe Dark
- Manim produces NO audio — all audio comes from HyperFrames
- HyperFrames `<video>` rule: never nest in a timed div, never animate video dimensions, never call play/pause/seek from JS

## Motion Conventions (site-wide)

Shared layer: `public/motion-utilities.css` (linked in ALL static pages via `scripts/batch-add-motion-css.py`, plus `api/blog-renderer.js`, `scripts/generate-blog-tools.mjs`, `scripts/generate-all-metric-tools.mjs`, `public/glossary/_template.html`).

- Content images (article/blog/tool/entry contexts) get automatic hover-zoom — no class needed.
- Opt-in extras: `.motion-float` / `.motion-float-slow` (idle float), `.motion-lift` (hover lift), `[data-motion="zoom"]`, chart containers `.chart-wrap`/`.chart-container`/`[data-chart]` get hover emphasis.
- ALL motion must be transform/opacity only (60fps, GPU-composited); `prefers-reduced-motion` is handled globally.
- When adding NEW pages/templates: always include `<link rel="stylesheet" href="/motion-utilities.css">`.
- Re-run `python3 scripts/batch-add-motion-css.py` after adding new static HTML files (idempotent).
- Framework reference: `web-animation` skill (motion taxonomy, sector vocabulary, Golden Rules).

### Blog image standard (3+ animated visuals)

Every blog post requires >= 3 visuals inside `<article>` — images (`<img>`), `<object>` embeds, or inline `<svg>` charts — and the `motion-utilities.css` link in `<head>` so they animate (hover-zoom / chart entrance / hover emphasis; reduced-motion safe).

- Enforced before DB publish by `scripts/publish-seo-tips-post-db.js` (fails if < 3 or missing motion link).
- Manual check: `node scripts/check-post-visuals.js public/blog/<slug>.html`.
- Inline SVG charts: wrap in `<div class="chart-wrap chart-entrance" data-chart role="img" aria-label="...">` — auto hover emphasis + one-time fade-up entrance; the CI generator enforces the same 3-visual floor via `BLOG_MIN_VISUALS=3`.
