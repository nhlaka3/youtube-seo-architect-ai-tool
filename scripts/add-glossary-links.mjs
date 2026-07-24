#!/usr/bin/env node
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BLOG_DIR = '/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/public/blog/';

const GLOSSARY_MAP = {
  'YouTube Algorithm': '/glossary/youtube-algorithm',
  'YouTube Tags': '/glossary/youtube-tags',
  'Youtube Tags': '/glossary/youtube-tags',
  'CTR': '/glossary/click-through-rate',
  'Click-Through Rate': '/glossary/click-through-rate',
  'Audience Retention': '/glossary/audience-retention',
  'Watch Time': '/glossary/watch-time',
  'Impressions': '/glossary/impressions',
  'YouTube Keyword Research': '/glossary/youtube-keyword-research',
  'Search Volume': '/glossary/search-volume',
  'Keyword Difficulty': '/glossary/keyword-difficulty',
  'Title Optimization': '/glossary/title-optimization',
  'Thumbnail Optimization': '/glossary/thumbnail-optimization',
  'Description Optimization': '/glossary/description-optimization',
  'Video Chapters': '/glossary/video-chapters',
  'Transcript SEO': '/glossary/transcript-seo',
  'Keyword Cannibalization': '/glossary/keyword-cannibalization',
  'Evergreen Content': '/glossary/evergreen-content',
  'Competitor Analysis': '/glossary/competitor-analysis',
  'Dwell Time': '/glossary/dwell-time',
  'Session Time': '/glossary/session-time',
  'Content Pillar': '/glossary/content-pillar',
  'Video Hook': '/glossary/video-hook',
  'Channel Audit': '/glossary/channel-audit',
  'YouTube Shorts': '/glossary/youtube-shorts',
  'A/B Testing': '/glossary/ab-testing',
  'Topic Authority': '/glossary/topic-authority',
  'Shorts Algorithm': '/glossary/shorts-algorithm',
  'YouTube Analytics': '/glossary/youtube-analytics',
  'Playlist Optimization': '/glossary/playlist-optimization',
  'Call to Action': '/glossary/call-to-action',
  'Content Gap Analysis': '/glossary/content-gap-analysis',
  'Ad Revenue': '/glossary/ad-revenue',
  'Demonetization': '/glossary/demonetization',
  'Closed Captions': '/glossary/closed-captions',
  'External Traffic': '/glossary/external-traffic',
  'Long-Tail Keywords': '/glossary/long-tail-keywords',
  'Channel Branding': '/glossary/channel-branding',
  'Collaboration': '/glossary/collaboration',
  'Community Tab': '/glossary/community-tab',
  'Cross-Promotion': '/glossary/cross-promotion',
  'Content Calendar': '/glossary/content-calendar',
  'Video Backlinks': '/glossary/video-backlinks',
  'YouTube Studio': '/glossary/youtube-studio',
  'YouTube Premium': '/glossary/youtube-premium',
  'YouTube Creator Academy': '/glossary/youtube-creator-academy',
  'YouTube Partner Program': '/glossary/youtube-partner-program',
  'Community Guidelines': '/glossary/community-guidelines',
  'YouTube Hashtags': '/glossary/youtube-hashtags',
  'Mid-Roll Ads': '/glossary/mid-roll-ads',
  'Session Time': '/glossary/session-time',
  'Video Intro Structure': '/glossary/video-intro-structure',
  'Channel Audit': '/glossary/channel-audit',
  'Content Repurposing': '/glossary/content-repurposing',
};

function addGlossaryLinks(html) {
  // STRIP all existing glossary links from the entire HTML first (clean slate)
  html = html.replace(/<a\s[^>]*class="glossary-link"[^>]*>([\s\S]*?)<\/a>/gi, '$1');

  // Strip any HTML from <title> tag (should be plain text)
  html = html.replace(/(<title>)([\s\S]*?)(<\/title>)/gi, (match, open, content, close) => {
    const clean = content.replace(/<[^>]*>/g, '');
    return open + clean + close;
  });

  // Strip any HTML from <meta name="description"> content attribute
  // The meta tag may have broken HTML injected from earlier runs.
  // Simple approach: remove ALL <...> sequences from the line, then reconstruct.
  html = html.split('\n').map(line => {
    if (/<meta\s+name=["']description["']/i.test(line)) {
      // Remove ALL <...> sequences (the meta tag itself is one, inner broken HTML are others)
      // Then the text between content=" and "/> is the clean description
      let cleanLine = line.replace(/<[^>]*>/g, '');
      // Now the line looks like: '  meta name="description" content="YouTube tags still matter..." /'
      // Extract the content value
      let contentMatch = cleanLine.match(/content="([^"]+)"/);
      if (contentMatch) {
        return '  <meta name="description" content="' + contentMatch[1].trim() + '" />';
      }
    }
    return line;
  }).join('\n');

  // Only process content within <article> tags
  const articleMatch = html.match(/<article>([\s\S]*?)<\/article>/i);
  if (!articleMatch) return html;

  const articleContent = articleMatch[1];
  
  // Protect existing links inside article content
  const protectedLinks = [];
  let idx = 0;
  const prot = articleContent.replace(/<a\s[^>]*>.*?<\/a>/gi, (m) => {
    const t = `__GL${idx}__`;
    protectedLinks.push(m);
    idx++;
    return t;
  });

  // Sort terms by length descending for longest-match-first
  const terms = Object.keys(GLOSSARY_MAP).sort((a, b) => b.length - a.length);
  let result = prot;

  for (const term of terms) {
    const slug = GLOSSARY_MAP[term];
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Whole word matching, case-insensitive
    const re = new RegExp(`(?<![\\w\\-])(${escaped})(?![\\w\\-])`, 'gi');
    result = result.replace(re, (match) => {
      return `<a href="${slug}" class="glossary-link">${match}</a>`;
    });
  }

  // Restore protected links
  for (let i = 0; i < protectedLinks.length; i++) {
    result = result.replace(`__GL${i}__`, protectedLinks[i]);
  }

  // Put the linked content back into the full HTML
  return html.replace(/<article>([\s\S]*?)<\/article>/i, `<article>${result}</article>`);
}

// Process all HTML files
const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html') && f !== '_TEMPLATE.html');
let totalLinks = 0;

for (const file of files) {
  const path = join(BLOG_DIR, file);
  const original = readFileSync(path, 'utf-8');
  const modified = addGlossaryLinks(original);
  const linksAdded = (modified.match(/glossary-link/g) || []).length;
  if (linksAdded > 0) {
    writeFileSync(path, modified);
    totalLinks += linksAdded;
    console.log(`  ✓ ${file}: ${linksAdded} glossary links`);
  }
}

console.log(`\nTotal: ${files.length} files processed, ${totalLinks} glossary links added`);
