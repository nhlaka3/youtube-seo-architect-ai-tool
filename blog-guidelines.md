# 📑 YouTube SEO Architect — Blog & Programmatic SEO Content Guidelines
*(Version 1.2 — 2026/2027 Autonomous Agent Edition)*

Welcome, Agent. If you have been tasked with writing, editing, or optimizing a blog post for **YT SEO Architect**, you must read and adhere strictly to these guidelines. This document ensures that all content generated for the site meets the absolute highest standards of quality, formatting, technical optimization, and Google search ranking efficacy.

---

## 🎯 Core Goal: Rank #1 for High-Intent Long-Tail Keywords
We do not write generic blog posts. We write comprehensive, data-backed masterclasses that target specific, low-competition, high-intent long-tail keywords (e.g., highly specific creator troubleshooting questions, platform comparison queries, or developer-specific API workflows) that have a clear, realistic pathway to ranking #1 on Google.

### Strict Article Constraints
*   **Word Count**: Every article must be **at least 1,500 words** (and under absolutely no circumstances less than **1,200 words**). Thin content is ignored by modern search engines and will be rejected.
*   **Tone & Voice**: Elite, authoritative, technical, yet highly actionable. Write like a real YouTube growth specialist or seasoned creator sharing hard-won lessons from the trenches.
*   **Zero "AI-isms" or Filler**:
    *   **Prohibited AI-isms**: *"in today's world"*, *"landscape"*, *"leverage"*, *"robust"*, *"seamless"*, *"foster"*, *"moreover"*, *"pivotal"*, *"embark"*, *"game-changer"*, *"cutting-edge"*, *"streamline"*.
    *   **Prohibited Filler Phrases**: *"At its core"*, *"That said"*, *"Let's explore"*, *"Ultimately"*, *"It's important to note"*, *"In a world where"*.
    *   **No Hedging**: Do not write *"it might be helpful to..."* or *"this could potentially..."*. Declare facts with confidence: *"I tested this on 4 channels and watched CTR increase by 42%. Here is how to do it."*

---

## ⚡ Trend-Jacking Strategy: Riding the 48-Hour Wave
*New in Version 1.3: Autonomous Newsjacking Protocol*

We don't just write evergreen content; we capture "Search Spikes." When YouTube releases a new feature or the algorithm shifts, there is a **48-hour window** where competition is near-zero and search volume is vertical.

### 1. The Trend Identification Protocol
Before selecting a topic from the general queue, check the **Trend Pulse API**:
*   **Action**: Query `GET /api/trends/pulse?niche=YouTube SEO&country=US`.
*   **Selection**: Target keywords with an **Alignment Score > 70** and an **Urgency Window < 48h**.
*   **Goal**: Find "Unanswered Questions" related to new platform changes.

### 2. The Capitalization Workflow
Once a high-value trend is identified (e.g., *"YouTube just launched 'Test & Compare' for all"*):
1.  **Generate the Brief**: Use `POST /api/trends/capitalize` with the trending keyword to get an AI-optimized hook, outline, and tags.
2.  **The "First Mover" Rule**: Trend-jacking articles must be published within **6 hours** of trend identification.
3.  **SEO Priority**: Use the `⚡ TL;DR` box to give the direct answer to the trending problem. Google's "Freshness" algorithm prioritizes clear, immediate answers for trending queries.

---

## 📑 Required Article Structure & Layout

To ensure maximum scannability, search snippet optimization, and AI Overview (SGE) compatibility, every article must follow this layout structure:

### 1. The Featured Snippet (SGE) Box (`⚡ TL;DR`)
Planted at the very top of the article before any headings, you must include a custom `.tldr` block.
*   Must contain a clear, bulleted list of 3-5 high-yield, factual statements.
*   Must answer the core search query directly in the first bullet point.
*   Example markup:
    ```html
    <div class="tldr">
      <h2>⚡ TL;DR</h2>
      <ul>
        <li><strong>Direct Answer:</strong> [1-2 sentences giving the exact answer to the title question]</li>
        <li>[Factual metric or statistic supporting the answer]</li>
        <li>[Key actionable takeaway for the creator]</li>
        <li>Naturally reference a corresponding <a href="/dashboard">YT SEO Architect tool</a>.</li>
      </ul>
    </div>
    ```

### 2. Table of Contents
Include a `.toc` block right after the TL;DR. Each item must link to an `id=` on the corresponding H2 section.
*   Example markup:
    ```html
    <nav class="toc" aria-label="Table of contents">
      <h2>📑 In This Article</h2>
      <ol>
        <li><a href="#section-1">What is [Topic]?</a></li>
        <li><a href="#section-2">Why [Topic] Matters</a></li>
        <li><a href="#section-3">How to [Topic]: Step-by-Step</a></li>
        <li><a href="#section-4">Mistakes to Avoid</a></li>
        <li><a href="#faq">Frequently Asked Questions</a></li>
        <li><a href="#key-takeaways">Key Takeaways</a></li>
      </ol>
    </nav>
    ```

### 3. Body Sections with Scannable Headings
*   Break long paragraphs into **2-3 sentence chunks** max.
*   Use H2 and H3 subheadings with clear, descriptive terms containing your target keyword.
*   Use bold text on crucial phrases, numbered lists for steps, and comparative tables.
*   **Interactive Callout Boxes**: Use styling classes from `blog.css` to highlight critical expert tips or warnings:
    *   `<div class="alert-box">...</div>`
    *   `<div class="tip-card">...</div>`
    *   `<div class="warning-callout">...</div>`

### 4. Natural In-Context CTAs (Call to Actions)
Every post must naturally integrate high-yield product callouts linking back to the YT SEO Architect dashboard tools.
*   *Bad*: *"Click here to try our tag generator."*
*   *Good*: *"Instead of wasting hours guessing tags, you can use the <a href="/dashboard">YT SEO Architect Tag Generator</a> to automatically fetch high-difficulty, low-competition tags matching your video's exact seed intent in less than 4 seconds."*

### 5. Frequently Asked Questions (FAQ) Section
Every article must end with an FAQ section containing **exactly 5 self-contained questions and answers**.
*   Write each answer in 2-3 sentences.
*   Use the native HTML `<details>` and `<summary>` elements to create accordions:
    ```html
    <section class="faq" id="faq">
      <h2>❓ Frequently Asked Questions</h2>
      <details>
        <summary>How many tags should I use on my YouTube videos?</summary>
        <div class="faq-answer">
          <p>You should aim for 10 to 15 highly targeted tags. Front-load your primary keyword, follow it with 4-5 secondary long-tail keywords, and finish with broad category tags. Avoid keyword stuffing, as the modern YouTube algorithm relies far more on description context and transcript data than individual tags.</p>
        </div>
      </details>
      <!-- Repeat 4 more times for exactly 5 FAQs -->
    </section>
    ```

---

## 🖼️ Image & Visual Asset Optimization Guidelines

Visual media is a major driver of engagement and organic rank. Follow this absolute P0 protocol when sourcing or generating images for any article:

### 1. Sourcing & Dynamic Seed Mapping
*   **Hero Image**: Every article must have a featured image at the top of the body. Sourcing must use a contextually relevant seed URL through **Picsum** or **Unsplash CDN**:
    ```html
    https://picsum.photos/seed/[POST_SLUG_OR_KEYWORD]/800/400
    ```
    *Replace `[POST_SLUG_OR_KEYWORD]` with the exact post slug or a high-relevance keyword related to the article (e.g. `tags`, `monetization`, `thumbnails`, `description`). This creates an identical, high-performance cached image matching the exact context of the post.*

### 2. Core Web Vitals Rules (LCP & CLS Prevention)
*   **Eager Sizing for Hero (LCP)**: The top featured image sits above-the-fold. It must load instantly with **high priority**.
    *   **Mandatory Attributes**: `loading="eager"`, `fetchpriority="high"`, and explicit pixel dimensions `width="800" height="400"`.
    *   **Prohibited**: Under no circumstances should above-the-fold featured images carry `loading="lazy"`.
*   **Lazy Loading for Secondary Images (CLS)**: In-content secondary images sitting below-the-fold must carry `loading="lazy"` to preserve user bandwidth.
    *   **Mandatory Attributes**: Explicit dimensions `width="800" height="400"` to reserve layout space and prevent shifting of text layout as they load.
*   **Responsive Styling**: All images should carry a standard responsive CSS class or style to scale elegantly on smaller mobile screens:
    ```css
    width: 100%; height: auto; max-width: 800px; border-radius: 12px;
    ```

### 3. Interactive Vector Infographics & SVGs
To explain technical strategies (such as metadata weight, description sections, or ranking steps), **prefer inline responsive SVGs** over static raster screenshots. 
*   **Zero Latency**: Inline SVGs are embedded directly in the HTML string, bypassing additional HTTP request cycles.
*   **Vector Fidelity**: They render beautifully on high-res mobile and Retina screens.
*   **Dark Mode Styling**: SVGs automatically adapt to the user's system preferences using native CSS strokes and fills.
*   **Standard SVG Diagram Template**:
    ```html
    <div class="infographic-container" style="text-align:center; margin:32px 0;">
      <svg viewBox="0 0 800 400" width="100%" height="auto" style="max-width:600px; filter: drop-shadow(0 4px 20px rgba(0,0,0,0.15));" aria-label="Visual strategy map">
        <!-- Render clean geometric nodes, flowarrows, and readable text labels -->
      </svg>
      <p style="font-size:14px; color:#9CA3AF; margin-top:8px;">[Figure Caption detailing the illustrated concept]</p>
    </div>
    ```

---

## 🛠️ Database Schema & Dynamic Publishing

Our platform serves dynamic blog posts via the `/blog/:slug` route and outputs their details in `/blog` and `/sitemap-pseo.xml`. All programmatic and dynamic articles must be saved to the Postgres database using **Drizzle ORM**.

### The `seoPages` Database Schema
Here are the schema fields you must populate:

```typescript
export const seoPages = pgTable('seo_pages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  opportunityId: text('opportunity_id'), // Optional link to opportunity
  slug: text('slug').notNull().unique(), // URL-friendly string (e.g. 'youtube-tags-for-organic-growth-strategy')
  pageType: text('page_type').default('blog'), // Always 'blog'
  title: text('title').notNull(), // Meta Title (50-60 chars)
  metaDescription: text('meta_description'), // Meta Description (150-160 chars)
  h1: text('h1'), // Unique H1 heading for the post page
  content: text('content'), // Full HTML article body (no surrounding <html> tags, just content)
  schemaMarkup: text('schema_markup'), // Dual JSON-LD Schema (Article + FAQPage)
  internalLinks: jsonb('internal_links').default([]), // Array of internal links matched
  wordCount: integer('word_count').default(0), // Total word count (>= 1200)
  keywordDensity: real('keyword_density').default(0), // Keyword frequency score
  status: text('status').default('published'), // Use 'published' to go live immediately
  publishedAt: timestamp('published_at'), // Set to new Date()
  createdAt: timestamp('created_at').defaultNow(),
});
```

### Required JSON-LD Schema Structuring
Every dynamically published page **must** include a validated dual-schema JSON-LD markup saved into the `schemaMarkup` column:
1.  **Article Schema**: Declaring headline, author, publisher logo, date published, and canonical URL.
2.  **FAQPage Schema**: Outlining the exactly 5 questions and answers matching the body accordion.
*   Example `schemaMarkup` JSON structure:
    ```json
    [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": "How to Build a YouTube Tag Strategy for Rapid Organic Growth",
        "description": "Learn the precise tag strategy we used to scale organic YouTube views by 241%. Ingest algorithm metrics and get free description templates.",
        "datePublished": "2026-05-19",
        "dateModified": "2026-05-19",
        "author": {
          "@type": "Person",
          "name": "Patrick"
        },
        "publisher": {
          "@type": "Organization",
          "name": "YT SEO Architect",
          "logo": {
            "@type": "ImageObject",
            "url": "https://yt-seo-architect.vercel.app/og-image.png"
          }
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": "https://yt-seo-architect.vercel.app/blog/youtube-tags-for-organic-growth-strategy"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How many tags should I use on my YouTube videos?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Aim for 10 to 15 highly targeted tags. Front-load your primary keyword, follow it with 4-5 secondary long-tail keywords, and finish with broad category tags."
            }
          }
          // Include exactly 4 more matching questions
        ]
      }
    ]
    ```

---

## 🏁 Post-Publishing Checklist & Verification

When you have generated and saved your blog post to the database, follow this dynamic check sequence:
1.  **Sitemap & Feeds**: Check that the new article immediately registers on the `/blog` index feed and `/sitemap-pseo.xml`.
2.  **Schema Audit**: Test the generated JSON-LD using a validator to confirm there are no missing nodes or parse issues.
3.  **Performance & Styling**: Navigate to `/blog/:slug` to confirm that the dynamic page loads correctly, linking to `/style.css` and `/blog/blog.css` without breaking the grid layout.
4.  **IndexNow Ping**: Ensure `submitToIndexNow([slug])` triggers correctly. (Our server automatically pings IndexNow when pages are published).

Follow these rules on every content generation task to drive unmatched organic growth.
