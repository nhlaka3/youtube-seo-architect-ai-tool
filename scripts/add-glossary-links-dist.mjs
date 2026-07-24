#!/usr/bin/env node
// Process dist/blog/ HTML files too
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const BLOG_DIR = '/mnt/c/Users/nhlaka/Desktop/Youtube seo tool/dist/blog/';

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
  'Video Intro Structure': '/glossary/video-intro-structure',
  'Content Repurposing': '/glossary/content-repurposing',
};

function addGlossaryLinks(html) {
  const protectedLinks = [];
  let idx = 0;
  const prot = html.replace(/<a\s[^>]*>.*?<\/a>/gi, (m) => {
    const t = `__GL${idx}__`;
    protectedLinks.push(m);
    idx++;
    return t;
  });

  const terms = Object.keys(GLOSSARY_MAP).sort((a, b) => b.length - a.length);
  let result = prot;

  for (const term of terms) {
    const slug = GLOSSARY_MAP[term];
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?<![\\w\\-])(${escaped})(?![\\w\\-])`, 'gi');
    result = result.replace(re, (match) => {
      return `<a href="${slug}" class="glossary-link">${match}</a>`;
    });
  }

  for (let i = 0; i < protectedLinks.length; i++) {
    result = result.replace(`__GL${i}__`, protectedLinks[i]);
  }

  return result;
}

try {
  const files = readdirSync(BLOG_DIR).filter(f => f.endsWith('.html'));
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
  console.log(`\nDist: ${files.length} files, ${totalLinks} links`);
} catch(e) {
  console.log('Dist blog dir not found — skipping');
}
