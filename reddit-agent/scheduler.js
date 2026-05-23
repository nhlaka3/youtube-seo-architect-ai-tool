import 'dotenv/config';
import cron from 'node-cron';
import { findRelevantPosts, replyToPost, markReplied, canReply, checkDailyReset } from './crawler.js';
import { generateReply } from './ai-responder.js';
import { RATE_LIMITS, INCLUDE_LINKS, BLOG_POSTS_TO_LINK, TOOL_URL } from './config.js';

async function run() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`[${new Date().toISOString()}] Reddit Growth Agent — Starting scan`);
  console.log(`[Config] Include links: ${INCLUDE_LINKS ? 'YES' : 'NO (help-only mode)'}`);
  
  checkDailyReset();
  
  if (!canReply()) {
    console.log(`[Rate Limit] Daily max reached (${RATE_LIMITS.maxRepliesPerDay}). Skipping.`);
    return;
  }
  
  // Validate credentials (optional — public API works without auth for reading)
  if (!process.env.REDDIT_CLIENT_ID || process.env.REDDIT_CLIENT_ID === 'your_client_id') {
    console.warn('[Setup] REDDIT_CLIENT_ID not configured. Running in read-only mode (no auto-posting).');
  }
  
  const posts = await findRelevantPosts();
  console.log(`[Scan] Found ${posts.length} relevant posts`);
  
  let replied = 0;
  for (const post of posts) {
    if (!canReply()) {
      console.log(`[Rate Limit] Stopping at ${replied} replies (daily limit reached)`);
      break;
    }
    
    console.log(`[Reply] Generating response for: "${post.title.substring(0, 80)}..."`);
    
    // Pass helpOnly=true when INCLUDE_LINKS is false
    const replyText = await generateReply(post, !INCLUDE_LINKS);
    
    // Always log the generated reply so you can copy/paste it manually
    console.log(`--- REPLY TEXT ---`);
    console.log(replyText);
    console.log(`--- END REPLY ---`);
    
    // Match blog post to link (if enabled)
    if (INCLUDE_LINKS && BLOG_POSTS_TO_LINK.length > 0) {
      const postText = (post.title + ' ' + (post.text || '')).toLowerCase();
      const matched = BLOG_POSTS_TO_LINK.find(b => postText.includes(b.keyword));
      if (matched) {
        console.log(`[Blog Match] Post mentions "${matched.keyword}" → you could link: ${matched.url}`);
      }
    }
    
    const success = await replyToPost(post.id, replyText);
    
    if (success) {
      markReplied(post.id, post.subreddit);
      replied++;
      console.log(`[Reply] ✅ Logged (${replied}/${RATE_LIMITS.maxRepliesPerDay} today) — copy the text above and post manually`);
      
      // Wait between replies to avoid rate limiting
      const waitMinutes = RATE_LIMITS.minMinutesBetweenReplies + Math.random() * 3;
      console.log(`[Wait] Sleeping ${waitMinutes.toFixed(1)} minutes...`);
      await new Promise(r => setTimeout(r, waitMinutes * 60000));
    }
  }
  
  console.log(`[Done] Found ${replied} opportunities. Next scan in 15 minutes.`);
}

// Run every 15 minutes
console.log('Reddit Growth Agent started');
console.log('  Mode: READ-ONLY (generates replies for manual posting)');
console.log('  Target subreddits: ' + (process.env.TARGET_SUBREDDITS || 'default'));
console.log('  Max replies/day: ' + RATE_LIMITS.maxRepliesPerDay);
console.log('  Include links: ' + INCLUDE_LINKS);
console.log('  Scan interval: every 15 minutes\n');

// On Vercel cron, just run once
if (process.env.VERCEL) {
  run().then(() => process.exit(0));
} else {
  // Local: run on schedule
  cron.schedule('*/15 * * * *', run);
  // Also run immediately on start
  run();
}
