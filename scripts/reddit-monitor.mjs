#!/usr/bin/env node
/**
 * scripts/reddit-monitor.mjs
 *
 * Monitors Reddit for YouTube SEO questions and auto-generates helpful
 * replies linking to relevant YT SEO Architect tools.
 *
 * Two modes:
 *   1. Auto-post mode — requires REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET env vars
 *   2. Draft mode — saves reply drafts to marketing/reddit-drafts/ for manual review
 *
 * Usage:
 *   node scripts/reddit-monitor.mjs                      # Find + draft replies
 *   node scripts/reddit-monitor.mjs --post              # Auto-post (requires Reddit API creds)
 *   node scripts/reddit-monitor.mjs --dry-run           # Show what would be found/replied
 *   node scripts/reddit-monitor.mjs --subreddits "NewTubers,SEO"  # Override subreddits
 *
 * Env (optional for reading, required for posting):
 *   REDDIT_CLIENT_ID     — Reddit App client ID (for OAuth posting)
 *   REDDIT_CLIENT_SECRET — Reddit App client secret
 *   REDDIT_USERNAME      — Reddit account username
 *   REDDIT_PASSWORD      — Reddit account password
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
const DRAFTS_DIR = resolve(PROJECT, 'marketing/reddit-drafts');
const SEEN_FILE = resolve(DRAFTS_DIR, '.seen-ids.json');

const SITE_URL = 'https://yt-seo-architect.vercel.app';

// ── Subreddits and search queries ─────────────────────────────────
const DEFAULT_SUBREDDITS = [
  'NewTubers',
  'PartneredYoutube',
  'SmallYTChannel',
  'youtubers',
  'YouTubeCreators',
  'SEO',
];

const SEARCH_QUERIES = [
  'youtube seo',
  'youtube tags',
  'youtube keyword research',
  'youtube description',
  'youtube thumbnail',
  'youtube title',
  'youtube views',
  'youtube growth',
  'youtube algorithm',
  'not getting views youtube',
  'youtube tips',
  'small channel growth',
];

// ── Tool mapping — match keywords to relevant tools ──────────────
const TOOL_MAP = [
  { keywords: ['tag', 'tags'], url: `${SITE_URL}/tools/tag-generator`, label: 'free AI tag generator' },
  { keywords: ['title', 'titles', 'ctr'], url: `${SITE_URL}/tools/title-optimizer`, label: 'free title optimizer' },
  { keywords: ['description', 'descriptions'], url: `${SITE_URL}/tools/description-writer`, label: 'free description writer' },
  { keywords: ['keyword', 'research', 'keywords'], url: `${SITE_URL}/dashboard`, label: 'keyword research tool (free)' },
  { keywords: ['thumbnail', 'thumbnails', 'ctr'], url: `${SITE_URL}/tools/thumbnail-analyzer`, label: 'thumbnail analyzer (free)' },
  { keywords: ['views', 'not getting', 'growth', 'small channel', 'no views', 'low views'],
    url: `${SITE_URL}/tools/youtube-video-not-getting-views-diagnostic-fix-2026`, label: 'low views diagnostic (free)' },
  { keywords: ['audit', 'metadata', 'optimize', 'optimization'], url: `${SITE_URL}/tools/youtube-seo-audit-diagnostic-fix-2026`, label: 'free SEO audit tool' },
  { keywords: ['monetization', 'monetize', 'adsense', 'money'], url: `${SITE_URL}/tools/youtube-monetization-tips-2026`, label: 'monetization guide (free)' },
  { keywords: ['hook', 'intro', 'retention', 'first 3', 'audience retention'],
    url: `${SITE_URL}/tools/youtube-intro-hook-first-3-seconds`, label: 'hook optimizer (free)' },
  { keywords: ['shorts', 'short'], url: `${SITE_URL}/tools/youtube-shorts-seo-ranking-guide-2026`, label: 'Shorts SEO guide (free)' },
  { keywords: ['analytics', 'metric', 'data'], url: `${SITE_URL}/tools/youtube-analytics-explained-2026`, label: 'analytics guide (free)' },
  { keywords: ['playlist', 'playlists'], url: `${SITE_URL}/tools/youtube-playlist-optimization-strategy`, label: 'playlist optimizer (free)' },
  { keywords: ['competitor', 'competition', 'niche'], url: `${SITE_URL}/tools/youtube-competitor-analysis-reverse-engineer`, label: 'competitor analysis tool (free)' },
  { keywords: ['shadow ban', 'shadowban'], url: `${SITE_URL}/tools/fix-youtube-shadow-ban-2026`, label: 'shadow ban checker (free)' },
  { keywords: ['chapter', 'timestamps'], url: `${SITE_URL}/tools/youtube-chapter-timestamps-seo-guide`, label: 'chapter timestamps guide (free)' },
  { keywords: ['end screen', 'cards', 'end screen'], url: `${SITE_URL}/tools/youtube-end-screens-cards-guide-2026`, label: 'end screens guide (free)' },
  { keywords: ['seo tools', 'best tools', 'tool'], url: `${SITE_URL}/tools/best-youtube-seo-tools-2026`, label: 'best SEO tools comparison (free)' },
  { keywords: ['beginner', 'start', 'new channel', 'starting'], url: `${SITE_URL}/tools/youtube-for-small-channels-2026`, label: 'small channel guide (free)' },
];

// ── CLI args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const AUTO_POST = args.includes('--post');
const SUBREDDITS = args.find(a => a.startsWith('--subreddits='))
  ? args.find(a => a.startsWith('--subreddits=')).split('=')[1].split(',')
  : DEFAULT_SUBREDDITS;

// ── AI reply generator ──────────────────────────────────────────
async function generateReply(title, text, tool) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const truncatedText = text.replace(/<[^>]+>/g, '').slice(0, 1500);

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You write helpful, genuine Reddit replies about YouTube growth. You're a YouTube creator sharing what works.

RULES:
- Be genuinely helpful first. The link is a bonus, not the point.
- Sound human. Use contractions, be casual. No marketing voice.
- NEVER sound like an ad or bot. No "I recommend checking out", no "you should try".
- Share a real, specific piece of advice based on their question.
- Mention the tool only if it's directly relevant: "I use this free tool at ${tool.url} — it helps with [specific problem they mentioned]"
- Keep it 2-4 sentences. Short. Punchy.
- No emoji spam. One emoji max.
- No "hope this helps!" or "let me know if you have questions!" — those are bot signals.
- If you can't add value, don't reply.`

          },
          {
            role: 'user',
            content: `Write a helpful Reddit reply to this post:
Title: ${title}
Post: ${truncatedText}

Relevant tool: ${tool.label} at ${tool.url}

Write 2-4 sentences. Be genuinely helpful. Link the tool naturally only if it's directly relevant.`
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch {
    return null;
  }
}

// ── Reddit API helpers ──────────────────────────────────────────
async function getRedditPosts(subreddit, query, after) {
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&sort=new&limit=15${after ? `&after=${after}` : ''}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'YTSEOArchitect/1.0 (YouTube SEO tool; https://yt-seo-architect.vercel.app)',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) {
      if (res.status === 429) {
        console.log(`  ⚠ Rate limited on r/${subreddit}, waiting...`);
        await new Promise(r => setTimeout(r, 5000));
        return [];
      }
      throw new Error(`HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.data?.children?.map(c => c.data) || [];
  } catch (e) {
    console.log(`  ⚠ Error fetching r/${subreddit}: ${e.message}`);
    return [];
  }
}

async function postReply(thingId, text) {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    return { success: false, reason: 'Missing Reddit API credentials' };
  }

  try {
    // Get OAuth token
    const tokenRes = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'YTSEOArchitect/1.0',
      },
      body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
    });

    if (!tokenRes.ok) throw new Error(`Token HTTP ${tokenRes.status}`);
    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // Post reply
    const replyRes = await fetch('https://oauth.reddit.com/api/comment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'YTSEOArchitect/1.0',
      },
      body: `thing_id=${thingId}&text=${encodeURIComponent(text)}`,
    });

    if (!replyRes.ok) {
      const errText = await replyRes.text();
      throw new Error(`Reply HTTP ${replyRes.status}: ${errText.slice(0, 200)}`);
    }

    const replyData = await replyRes.json();
    return { success: true, id: replyData.json?.data?.things?.[0]?.data?.id };
  } catch (e) {
    return { success: false, reason: e.message };
  }
}

// ── Seen-tracker (avoid duplicate replies) ─────────────────────
function getSeenIds() {
  if (!existsSync(SEEN_FILE)) return {};
  try {
    return JSON.parse(readFileSync(SEEN_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function markSeen(id, slug) {
  const seen = getSeenIds();
  seen[id] = { replied: true, slug, date: new Date().toISOString().split('T')[0] };
  mkdirSync(DRAFTS_DIR, { recursive: true });
  writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

// ── Relevance scoring ──────────────────────────────────────────
function findBestTool(title, text) {
  const combined = `${title} ${text}`.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const tool of TOOL_MAP) {
    let score = 0;
    for (const kw of tool.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        score += 2; // keyword match
        // Bonus if in title
        if (title.toLowerCase().includes(kw.toLowerCase())) score += 3;
      }
    }
    // Bonus for multiple keyword matches
    if (score > bestScore) {
      bestScore = score;
      bestMatch = tool;
    }
  }

  return bestMatch;
}

function scoreRelevance(title, text) {
  const combined = `${title} ${text}`.toLowerCase();
  let score = 0;

  // Must be about YouTube or SEO
  const ytSignals = ['youtube', 'video', 'channel', 'subscriber', 'view', 'upload', 'content creator'];
  const seoSignals = ['seo', 'rank', 'search', 'tag', 'keyword', 'title', 'description', 'thumbnail', 'algorithm', 'discover'];

  for (const s of ytSignals) {
    if (combined.includes(s)) score += 3;
  }
  for (const s of seoSignals) {
    if (combined.includes(s)) score += 5;
  }

  // Penalize if it's a promotion or off-topic
  const offTopic = ['gaming montage', 'minecraft', 'fortnite', 'roblox', 'vlog', 'prank', 'challenge'];
  for (const s of offTopic) {
    if (combined.includes(s)) score -= 5;
  }

  return score;
}

// ── Save draft ─────────────────────────────────────────────────
function saveDraft(post, reply, tool) {
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${post.id}.md`;
  const filepath = resolve(DRAFTS_DIR, filename);

  const draft = `# Reddit Reply Draft
**Subreddit:** r/${post.subreddit}
**Post:** [${post.title}](${post.url})
**Author:** u/${post.author}
**Score:** ${post.score}
**Created:** ${new Date(post.created_utc * 1000).toISOString()}
**Relevant Tool:** ${tool?.label || 'Generic'}
**Tool URL:** ${tool?.url || ''}

---

## Draft Reply

${reply}

---

## Post Content (first 500 chars)
${post.selftext?.slice(0, 500) || post.title}
`;

  mkdirSync(DRAFTS_DIR, { recursive: true });
  writeFileSync(filepath, draft);
  return filepath;
}

// ── Main ────────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  📡 REDDIT MONITOR');
  console.log('════════════════════════════════════════════\n');
  console.log(`  Subreddits: ${SUBREDDITS.join(', ')}`);
  console.log(`  Mode: ${AUTO_POST ? 'AUTO-POST' : DRY_RUN ? 'DRY RUN' : 'DRAFT'}`);
  console.log('');

  const seen = getSeenIds();
  const now = Math.floor(Date.now() / 1000);
  const maxAge = 7 * 24 * 60 * 60; // 7 days

  let totalFound = 0;
  let totalRelevant = 0;
  let totalReplied = 0;
  let totalDrafts = 0;

  for (const subreddit of SUBREDDITS) {
    console.log(`  🔍 Scanning r/${subreddit}...`);

    for (const query of SEARCH_QUERIES) {
      const posts = await getRedditPosts(subreddit, query);

      for (const post of posts) {
        // Skip if already seen
        if (seen[post.id]) continue;

        // Skip old posts
        if (now - post.created_utc > maxAge) continue;

        const title = post.title || '';
        const text = post.selftext || '';
        const score = scoreRelevance(title, text);

        totalFound++;

        if (score < 10) continue; // Not relevant enough

        totalRelevant++;

        const tool = findBestTool(title, text);
        const reply = await generateReply(title, text, tool);

        if (!reply) {
          console.log(`  ⚠ Could not generate reply for: ${title.slice(0, 60)}...`);
          continue;
        }

        console.log(`  💬 "${title.slice(0, 60)}..." (score: ${score})`);
        console.log(`     Tool: ${tool?.label || 'generic'}`);

        if (DRY_RUN) {
          console.log(`     [DRY RUN] Would reply with: "${reply.slice(0, 80)}..."`);
          console.log('');
          continue;
        }

        if (AUTO_POST) {
          const result = await postReply(post.name, reply);
          if (result.success) {
            console.log(`     ✅ Replied: ${result.id}`);
            totalReplied++;
          } else {
            console.log(`     ❌ Failed: ${result.reason}`);
            // Fall back to draft save
            const draftPath = saveDraft(post, reply, tool);
            console.log(`     📝 Saved as draft: ${draftPath}`);
            totalDrafts++;
          }
        } else {
          // Save as draft
          const draftPath = saveDraft(post, reply, tool);
          console.log(`     📝 Saved: ${draftPath}`);
          totalDrafts++;
        }

        // Mark as seen regardless
        markSeen(post.id, tool?.url?.split('/').pop() || 'generic');
        console.log('');
      }

      // Be polite to Reddit's rate limits
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log('════════════════════════════════════════════');
  console.log('  📡 REDDIT MONITOR REPORT');
  console.log('════════════════════════════════════════════');
  console.log(`  Posts scanned:  ${totalFound}`);
  console.log(`  Relevant:       ${totalRelevant}`);
  if (AUTO_POST) {
    console.log(`  Auto-replied:   ${totalReplied}`);
    console.log(`  Draft fallback: ${totalDrafts}`);
  } else {
    console.log(`  Drafts saved:   ${totalDrafts}`);
  }
  console.log(`  Subreddits:     ${SUBREDDITS.length}`);
  console.log(`  Time:           ${new Date().toISOString()}`);
  console.log('════════════════════════════════════════════\n');

  if (totalDrafts > 0 && !AUTO_POST) {
    console.log(`📝 ${totalDrafts} draft(s) saved to ${DRAFTS_DIR}/`);
    console.log('   Review and post manually, or run with --post to auto-reply.');
  }
  if (totalRelevant === 0) {
    console.log('   No new relevant posts found. Try different subreddits.');
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
