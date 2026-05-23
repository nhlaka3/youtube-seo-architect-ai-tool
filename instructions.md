Instruction File: Project YouTube SEO Architect To: Antigravity (Development Engine) Subject: Technical Blueprint & Instruction File for YouTube SEO Optimization Tool (2025/2026 Guidelines)
1. System Overview & Core Objectives
Your objective is to build a comprehensive YouTube SEO optimization and analytics tool. This tool must process real-time YouTube algorithm data, shifting away from outdated keyword-stuffing models to focus on intent, session watch time, and click-through rates (CTR)
. The tool should automate keyword discovery, audit metadata, provide actionable engagement checklists, and **automatically apply changes to a user's channel via the YouTube Data API with OAuth 2.0 write permissions** based on 2025/2026 YouTube algorithm parameters
.

1.5. Authentication & Automatic Updates (The "Auto-Fix" Engine)
OAuth 2.0 Integration: Users must authenticate securely via Google OAuth 2.0, granting the platform "Manage your YouTube account" permissions (Write Access).
Groq AI Integration: Use the Groq API (Llama 3 / Mixtral) to generate context-aware, hyper-optimized SEO metadata. The AI must ingest the current video metadata and the latest 2025 algorithm rules (from this file) to output superior content.
One-Click Auto-Fix & Injection: For metadata issues (e.g., short descriptions, bad titles lacking keywords, missing tags/timestamps), generate an optimized replacement using Groq. Present the user with an "AI Suggestion" preview and an "Inject to YouTube" button.
Direct API Patching: When the user confirms the fix, use the YouTube Data API (`Videos: update` endpoint) to permanently patch the metadata onto the live video without the user leaving the platform.
.
2. Module Instructions: Keyword Research & Discovery Engine
Build a keyword scraping and filtering module that interfaces with YouTube's autocomplete API
.
The Asterisk (*) Wildcard & Alphabet Search: Program the search logic to support the asterisk wildcard (e.g., how * [seed keyword]) and alphabet looping (e.g., [seed] a, [seed] b) to extract hidden, long-tail phrases
.
The "Golden Keyword" Filter: Create a strict filtering algorithm that surfaces keywords meeting these exact thresholds:
Word Count ≥ 4
Difficulty Score ≤ 6
Relevancy Score ≥ 90%
Autocomplete Position ≤ 3
The "Snowball" Loop: Implement a feature that takes high-performing keywords from the initial search and automatically runs them back through the engine as new seed keywords to generate 6-12 months of content ideas
.
Zero-View Mining: Build a scanner that flags high-relevancy, long-tail keywords (Difficulty 1-3) that have zero competing videos published in the last 6 months
.
Intent Over Exact Match: Train the keyword recommendation engine to prioritize semantic relevance, as only 6% of top-ranking videos use exact keyword matches in their titles, while 75% use related phrasing
.
3. Module Instructions: Metadata & Content Auditor
This module must crawl a user's uploaded video or proposed metadata and grade it against top-ranking baselines
.
Title Optimization: Limit the optimal title length to 60 characters for maximum visibility, though up to 100 characters is allowed
. Instruct users to front-load the primary keyword
.
Description Formatting: Require descriptions to be at least 200 words long
. The tool must check that the first 125 characters contain the primary keyword, as this section appears in search snippets
. Enforce the inclusion of timestamps (used by 63% of top videos) and at least one external link (used by 78% of top videos)
.
Tagging Logic: Limit tag recommendations to 10-15 highly relevant terms (primary, secondary, long-tail)
. Add a tooltip noting that tags play a minimal role in modern discovery and are mostly for misspellings
.
Video Specifications: Flag videos that are not in HD or 4K resolution, as 90% of top-ranking videos utilize high definition
. Recommend an optimal video length of 8-9 minutes for long-form content
.
Mandatory Captions: Build an alert that requires closed captions or full transcripts. Remind the user that 94% of top-ranking videos use transcripts
, and captions increase video views by 40% while boosting completion rates by 80%
. Include the target keyword in the video's file name before upload
.
4. Module Instructions: Engagement & Analytics Dashboard
Create an analytics dashboard tracking the "70/30 Rule" (70% of views come from recommendations)
.
Long-Form Metrics (CTR vs. Watch Time): Emphasize Click-Through Rate (CTR) and Average View Duration (AVD). Academic studies show that CTR is a massive driver for views on new videos
. Build alerts to notify users if CTR drops below 5-10% (suggesting a thumbnail/title change) or if AVD drops below 50% (suggesting pacing edits)
.
Engagement Velocity: Track likes and comments in the first 24-48 hours
. Instruct the user to ask a question in the first 30 seconds, pin a comment, and reply to the first 20-30 comments to spike early engagement
.
Shorts Algorithm Logic: For YouTube Shorts, disable CTR tracking (as it does not matter for swipe-based discovery) and heavily weight View Duration (closer to 100% is better) and looping replay rates
.
5. Module Instructions: Channel Architecture & Growth Features
Implement tools to build "Session Watch Time," which is heavily rewarded by the algorithm
.
Topic Clusters & Playlists: Direct users to create "Topic Clusters" (1 pillar video supported by 8-12 shorter videos) and group them into playlists with "Autoplay" enabled
. Place the video with the highest retention first in the playlist
.
Channel Authority Check: Audit the channel for age, subscriber count, and verification, noting that the median top-ranking channel is over 9 years old with 520,000 subscribers
. Ensure the channel has 5-10 core niche keywords applied in its settings
.
Evergreen Refresh Alert: Create a calendar feature that flags top-performing videos every 12-18 months. Instruct the user to update the title with the current year (e.g., "2026") and refresh the thumbnail to trigger a potential 3-10x view surge.

6. Module Instructions: Blog Content & SEO Engine
When tasked with writing, editing, or optimizing blog posts for the platform:
- Always use `public/blog/_TEMPLATE.html` as the strict boilerplate skeleton.
- Target high-intent, low-competition long-tail keywords (e.g., highly specific search queries, developer/creator troubleshooting questions, or comparison intents) that have a clear pathway to ranking #1 on Google.
- Enforce a strict word count of at least 1,500 words (never less than 1,200 words) per blog post to ensure comprehensive, high-quality semantic coverage.
- Adhere to the dual-schema JSON-LD structure (Article + FAQPage) and the bulleted SGE overview box (`⚡ TL;DR`) modeled inside `public/blog/youtube-shorts-seo-ranking-guide.html`.
- Extracted styles reside solely in `public/blog/blog.css`—do not introduce inline `<style>` blocks.
- Register all newly written posts in `public/sitemap.xml` and include them in the `blog.html` main feed.

Content Quality & Formatting Guidelines:
- Tone & Voice: Authoritative, elite, technical, yet highly actionable. Avoid filler, generic introductions, or fluff. Start with high-impact, immediate value hook.
- Data & Evidence: Base recommendations on real metrics, algorithmic parameters (e.g., watch time thresholds, CTR averages), or exact mathematical ratios (e.g., title keywords vs description density).
- Structural Readability: Break long paragraphs into 2-3 sentence chunks. Proactively use bulleted lists, bold emphasis on key phrases, step-by-step numbering, and summary tables.
- Featured Snippet (SGE) Targeting: Structure question-based headings (e.g. "<h3>How many hashtags should you use on YouTube Shorts?</h3>") immediately followed by a precise 1-2 sentence direct answer in bold before expanding further.
- Interactive UX Callouts: Integrate responsive visual containers (e.g., `<div class="alert-box">`, `<div class="tip-card">`, or `<div class="warning-callout">`) styled via `blog.css` to highlight critical warnings, expert tips, or checklist items.
- Strategic Conversion Funnel: Weave natural in-context calls-to-action (CTAs) directing readers to utilize corresponding tool features on the main app (e.g., referencing "use the YT SEO Architect Bulk Injector to automatically push these optimized descriptions to all 50 videos in one click").

Execution Protocol: Antigravity, please ingest these parameters and begin scaffolding the user interface. The primary input should simply be a YouTube Channel URL or a Seed Keyword, from which all of these automated audits and suggestions will populate.
