YT SEO Architect — Chrome Extension
=====================================

A Chrome extension that shows YouTube SEO scores directly on YouTube
video pages. See title analysis, tag suggestions, and optimization
tips without leaving YouTube.

Features
--------
• Real-time SEO scoring on every YouTube video page
• Title analysis (length, power words, structure)
• Description optimization suggestions
• Tag completeness check
• Engagement score estimation
• One-click "Full Analysis" link to the web tool
• Dark theme matching YouTube's design
• Score badge on the extension icon
• 1-hour score cache for fast re-loads


Installation (Development)
--------------------------

1. Open Chrome and go to chrome://extensions

2. Enable "Developer mode" (toggle in top right)

3. Click "Load unpacked"

4. Select this folder (chrome-extension/)

5. The extension icon appears in your toolbar

6. Navigate to any YouTube video — the score panel appears


Installation (Chrome Web Store)
--------------------------------

1. Zip this folder:
   $ cd chrome-extension
   $ zip -r yt-seo-architect.zip .

2. Go to chrome.google.com/webstore/devconsole

3. Pay $5 one-time registration fee

4. Click "New Item" → Upload yt-seo-architect.zip

5. Fill in:
   - Title: YT SEO Architect — YouTube SEO Score
   - Description: See SEO scores for any YouTube video instantly.
   - Category: Productivity
   - Language: English

6. Add screenshots (required):
   - Take a screenshot of the extension on a YouTube video
   - Minimum 1280x800 or 640x400

7. Submit for review (takes 1-7 days)


How It Works
------------

The extension injects a floating score panel on YouTube video pages.
It analyzes:

  • Title Score (0-100)
    - Length optimization (40-70 chars ideal)
    - Power words (how, best, top, 2026, etc.)
    - Structure (colon, dash, numbers)
    - Keyword placement

  • Description Score (0-100)
    - Length (200+ words recommended)
    - Links to social media
    - Timestamps
    - Hashtags
    - Paragraph structure

  • Tag Score (0-100)
    - Has tags at all
    - Reasonable count (5-15)
    - Mix of short and long-tail tags
    - Channel name included

  • Engagement Score (0-100)
    - Likes visibility
    - Comment activity

The overall score is the average of all four metrics.


Files
-----

  manifest.json     — Extension configuration (Manifest V3)
  content.js        — Injects score panel into YouTube pages
  styles.css        — Dark theme styling
  popup.html        — Extension icon popup UI
  popup.js          — Popup logic (stats, toggle)
  background.js     — Service worker (caching, badge)
  icons/            — Extension icons (16, 32, 48, 128px)


API Integration
---------------

Currently, the extension calculates scores client-side using the
same algorithm as the web tool. In a future version, it can call
the API for more detailed analysis:

  GET https://yt-seo-architect.vercel.app/api/youtube-ops
    ?operation=seo-score
    &videoId=VIDEO_ID

To enable API mode, uncomment the fetch call in background.js
and add the API endpoint to host_permissions in manifest.json.


Distribution Strategy
---------------------

1. Chrome Web Store listing (high-authority backlink)

2. Reddit posts:
   - r/chrome "I built a Chrome extension for YouTube SEO"
   - r/YouTube "This extension scores your videos in real-time"
   - r/NewTubers "Free tool that shows SEO scores on YouTube"

3. Blog posts: Add "Install our Chrome extension" to every blog

4. YouTube Shorts: Screen record the extension in action

5. Product Hunt: List as a free productivity tool

6. Twitter: "Just shipped a Chrome extension that shows YouTube
   SEO scores directly on video pages. Free forever."


Troubleshooting
---------------

Panel not showing?
  → Make sure you're on a youtube.com/watch?v= page
  → Reload the page
  → Check chrome://extensions for errors

Score showing as 0?
  → The extension needs the page to fully load
  → Wait 2 seconds after the video starts
  → Try refreshing the page

Extension icon not appearing?
  → Pin it: click the puzzle icon in Chrome toolbar
  → Find "YT SEO Architect" and click the pin icon
