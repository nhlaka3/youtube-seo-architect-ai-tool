#!/usr/bin/env node
/**
 * scripts/generate-lead-drafts.mjs
 *
 * Generates personalized Reddit reply drafts for the leads collected in
 * /tmp/final_dataset.json using the same Groq engine + tool matching as
 * reddit-monitor.mjs. Saves drafts to marketing/reddit-drafts/.
 *
 * Usage: node scripts/generate-lead-drafts.mjs [--limit 12]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = resolve(__dirname, '..');
config({ path: resolve(PROJECT, '.env.local') });

const DRAFTS_DIR = resolve(PROJECT, 'marketing/reddit-drafts');
const SITE_URL = 'https://yt-seo-architect.vercel.app';

const LIMIT_ARG = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 12;

// ── Tool mapping (same as reddit-monitor.mjs) ─────────────────────
const TOOL_MAP = [
  { keywords: ['tag', 'tags'], url: `${SITE_URL}/tools/tag-generator`, label: 'free AI tag generator' },
  { keywords: ['title', 'titles', 'ctr'], url: `${SITE_URL}/tools/title-optimizer`, label: 'free title optimizer' },
  { keywords: ['description', 'descriptions'], url: `${SITE_URL}/tools/description-writer`, label: 'free description writer' },
  { keywords: ['keyword', 'research', 'keywords'], url: `${SITE_URL}/dashboard`, label: 'keyword research tool (free)' },
  { keywords: ['thumbnail', 'thumbnails', 'ctr'], url: `${SITE_URL}/tools/thumbnail-analyzer`, label: 'thumbnail analyzer (free)' },
  { keywords: ['views', 'not getting', 'growth', 'small channel', 'no views', 'low views', 'impressions', 'impression'],
    url: `${SITE_URL}/tools/youtube-video-not-getting-views-diagnostic-fix-2026`, label: 'low views diagnostic (free)' },
  { keywords: ['audit', 'metadata', 'optimize', 'optimization'], url: `${SITE_URL}/tools/youtube-seo-audit-diagnostic-fix-2026`, label: 'free SEO audit tool' },
  { keywords: ['monetization', 'monetize', 'adsense', 'money'], url: `${SITE_URL}/tools/youtube-monetization-tips-2026`, label: 'monetization guide (free)' },
  { keywords: ['hook', 'intro', 'retention', 'first 3', 'audience retention'], url: `${SITE_URL}/tools/youtube-intro-hook-first-3-seconds`, label: 'hook optimizer (free)' },
  { keywords: ['shorts', 'short'], url: `${SITE_URL}/tools/youtube-shorts-seo-ranking-guide-2026`, label: 'Shorts SEO guide (free)' },
  { keywords: ['analytics', 'metric', 'data'], url: `${SITE_URL}/tools/youtube-analytics-explained-2026`, label: 'analytics guide (free)' },
  { keywords: ['playlist', 'playlists'], url: `${SITE_URL}/tools/youtube-playlist-optimization-strategy`, label: 'playlist optimizer (free)' },
  { keywords: ['competitor', 'competition', 'niche'], url: `${SITE_URL}/tools/youtube-competitor-analysis-reverse-engineer`, label: 'competitor analysis tool (free)' },
  { keywords: ['shadow ban', 'shadowban'], url: `${SITE_URL}/tools/fix-youtube-shadow-ban-2026`, label: 'shadow ban checker (free)' },
  { keywords: ['chapter', 'timestamps'], url: `${SITE_URL}/tools/youtube-chapter-timestamps-seo-guide`, label: 'chapter timestamps guide (free)' },
  { keywords: ['seo tools', 'best tools', 'tool'], url: `${SITE_URL}/tools/best-youtube-seo-tools-2026`, label: 'best SEO tools comparison (free)' },
  { keywords: ['beginner', 'start', 'new channel', 'starting'], url: `${SITE_URL}/tools/youtube-for-small-channels-2026`, label: 'small channel guide (free)' },
];

function findBestTool(title, text) {
  const combined = `${title} ${text}`.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  for (const tool of TOOL_MAP) {
    let score = 0;
    for (const kw of tool.keywords) {
      if (combined.includes(kw.toLowerCase())) {
        score += 2;
        if (title.toLowerCase().includes(kw.toLowerCase())) score += 3;
      }
    }
    if (score > bestScore) { bestScore = score; bestMatch = tool; }
  }
  return bestMatch;
}

// ── Groq reply generator (same prompt style as reddit-monitor.mjs) ─
async function generateReplyViaGemini(title, text, tool, author) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const truncatedText = (text || '').replace(/<[^>]+>/g, '').slice(0, 1500);

  const systemPrompt = `You write helpful, genuine Reddit replies about YouTube growth. You're a YouTube creator sharing what works.

RULES:
- Be genuinely helpful first. The link is a bonus, not the point.
- Sound human. Use contractions, be casual. No marketing voice.
- NEVER sound like an ad or bot. No "I recommend checking out", no "you should try".
- Share a real, specific piece of advice based on their question.
- Mention the tool only if it's directly relevant, naturally: "I use this free tool at ${tool ? tool.url : ''} — it helps with [specific problem they mentioned]".
- Keep it 2-4 sentences. Short. Punchy.
- No emoji spam. One emoji max.
- No "hope this helps!" or "let me know if you have questions!" — those are bot signals.
- If you can't add value, don't reply.`;

  const userPrompt = `Write a helpful Reddit reply to this post by u/${author}:
Title: ${title}
Post: ${truncatedText}

Relevant tool: ${tool ? `${tool.label} at ${tool.url}` : 'none — answer from experience only'}

Write 2-4 sentences. Be genuinely helpful. Link the tool naturally only if it's directly relevant.`;

  try {
    let res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
          generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 600 },
        }),
      }
    );
    // Retry on rate limit (free tier ~15 RPM)
    for (let attempt = 0; res.status === 429 && attempt < 3; attempt++) {
      console.log(`  ⚠ Gemini 429, backing off 12s...`);
      await new Promise(r => setTimeout(r, 12000));
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.7, topP: 0.9, maxOutputTokens: 600 },
          }),
        }
      );
    }
    if (!res.ok) {
      const err = await res.text();
      console.log(`  ⚠ Gemini HTTP ${res.status}: ${err.slice(0, 120)}`);
      return null;
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (e) {
    console.log(`  ⚠ Gemini error: ${e.message}`);
    return null;
  }
}

async function generateReply(title, text, tool, author) {
  // Try Groq first (like auto-blog-generator), fall back to Gemini
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    const r = await generateReplyViaGroq(groqKey, title, text, tool, author);
    if (r) return r;
  }
  return generateReplyViaGemini(title, text, tool, author);
}

async function generateReplyViaGroq(apiKey, title, text, tool, author) {

  const truncatedText = (text || '').replace(/<[^>]+>/g, '').slice(0, 1500);

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
- Mention the tool only if it's directly relevant, naturally: "I use this free tool at ${tool ? tool.url : ''} — it helps with [specific problem they mentioned]".
- Keep it 2-4 sentences. Short. Punchy.
- No emoji spam. One emoji max.
- No "hope this helps!" or "let me know if you have questions!" — those are bot signals.
- If you can't add value, don't reply.`
          },
          {
            role: 'user',
            content: `Write a helpful Reddit reply to this post by u/${author}:
Title: ${title}
Post: ${truncatedText}

Relevant tool: ${tool ? `${tool.label} at ${tool.url}` : 'none — answer from experience only'}

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

// ── Save draft ─────────────────────────────────────────────────────
function saveDraft(post, reply, tool) {
  const date = new Date().toISOString().split('T')[0];
  const safeAuthor = (post.author || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '');
  const filename = `${date}-${safeAuthor}-${post.permalink.split('/').filter(Boolean).pop() || 'lead'}.md`;
  const filepath = resolve(DRAFTS_DIR, filename);

  const draft = `# Reddit Reply Draft
**Subreddit:** r/${post.subreddit}
**Post:** [${post.title}](${post.permalink})
**Author:** u/${post.author}
**Score:** ${post.score}
**Comments:** ${post.num_comments}
**Relevant Tool:** ${tool?.label || 'Generic (no link)'}
**Tool URL:** ${tool?.url || ''}

---

## Draft Reply

${reply}

---

## Post Content (first 500 chars)
${(post.selftext || post.title || '').slice(0, 500)}
`;

  mkdirSync(DRAFTS_DIR, { recursive: true });
  writeFileSync(filepath, draft);
  return filepath;
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  console.log('════════════════════════════════════════════');
  console.log('  📝 LEAD REPLY DRAFT GENERATOR');
  console.log('════════════════════════════════════════════\n');

  const leads = JSON.parse(readFileSync('/tmp/final_dataset.json', 'utf-8')).leads;
  console.log(`  Leads available: ${leads.length}, generating ${Math.min(LIMIT, leads.length)}\n`);

  let ok = 0, fail = 0;
  for (const lead of leads.slice(0, LIMIT)) {
    const title = lead.title || '';
    const text = lead.selftext || '';
    const tool = findBestTool(title, text);
    const reply = await generateReply(title, text, tool, lead.author);

    if (!reply) {
      console.log(`  ⚠ No reply generated for: ${title.slice(0, 60)}...`);
      fail++;
      continue;
    }

    const filepath = saveDraft(lead, reply, tool);
    console.log(`  💬 u/${lead.author} | "${title.slice(0, 55)}..."`);
    console.log(`     Tool: ${tool?.label || 'none'} → ${filepath.split('/').pop()}`);
    ok++;

    // Be polite to Gemini rate limits (free tier ~15 RPM)
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log('\n════════════════════════════════════════════');
  console.log(`  Drafts written: ${ok} | Failed: ${fail}`);
  console.log(`  Location: ${DRAFTS_DIR}/`);
  console.log('  Review each draft, tweak the voice, then post manually.');
  console.log('════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('❌ Fatal:', e.message);
  process.exit(1);
});
