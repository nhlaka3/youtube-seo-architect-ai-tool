// Scans Reddit using the public JSON API (no auth required)
import { TARGET_SUBREDDITS, KEYWORD_TRIGGERS, SKIP_TRIGGERS, RATE_LIMITS, MEMORY_FILE } from './config.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

let memory = { replied: [], lastRun: null };

if (existsSync(MEMORY_FILE)) {
  try { memory = JSON.parse(readFileSync(MEMORY_FILE, 'utf8')); } catch(e) {}
}

function saveMemory() {
  writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

function alreadyReplied(postId) {
  return memory.replied.some(r => r.id === postId);
}

export function markReplied(postId, subreddit) {
  memory.replied.push({ id: postId, subreddit, time: new Date().toISOString() });
  if (memory.replied.length > 500) memory.replied = memory.replied.slice(-500);
  saveMemory();
}

function matchesKeyword(text) {
  const lower = (text || '').toLowerCase();
  if (SKIP_TRIGGERS.some(t => lower.includes(t))) return false;
  return KEYWORD_TRIGGERS.some(t => lower.includes(t));
}

export async function findRelevantPosts() {
  const matches = [];

  for (const sub of TARGET_SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${sub}/new.json?limit=${RATE_LIMITS.maxPostsPerSubreddit}&raw_json=1`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'YT_SEO_Monitor/1.0 (personal use)' }
      });
      if (!res.ok) { console.warn(`[Crawler] r/${sub}: HTTP ${res.status}`); continue; }
      
      const data = await res.json();
      const posts = data?.data?.children || [];
      
      for (const child of posts) {
        const p = child.data;
        if (alreadyReplied(p.id)) continue;
        if (p.stickied || p.pinned) continue;
        
        const hoursAgo = (Date.now() - p.created_utc * 1000) / 3600000;
        if (hoursAgo > 24) continue;
        if (p.num_comments > 5) continue;

        const combinedText = `${p.title} ${p.selftext || ''}`;
        if (matchesKeyword(combinedText)) {
          matches.push({
            id: p.id,
            subreddit: sub,
            title: p.title,
            text: p.selftext || '',
            url: `https://reddit.com${p.permalink}`,
            author: p.author || 'unknown',
            created: new Date(p.created_utc * 1000),
            score: p.score,
            numComments: p.num_comments,
          });
        }
      }
      console.log(`[Crawler] r/${sub}: ${posts.length} posts, ${matches.filter(m => m.subreddit === sub).length} matches`);
    } catch (e) {
      console.warn(`[Crawler] r/${sub} error:`, e.message);
    }
  }

  matches.sort((a, b) => b.created - a.created);
  return matches;
}

export async function replyToPost(postId, replyText) {
  // Manual posting — user copies text and posts themselves
  // This function exists for API compatibility but doesn't auto-post
  markReplied(postId, 'manual');
  return true;
}

export function canReply() { return true; }
export function checkDailyReset() {}
