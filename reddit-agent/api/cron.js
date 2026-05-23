// Vercel cron handler — calls the scheduler
import { findRelevantPosts, replyToPost, markReplied, canReply, checkDailyReset } from '../crawler.js';
import { generateReply } from '../ai-responder.js';
import { RATE_LIMITS, INCLUDE_LINKS } from '../config.js';

export default async function handler(req, res) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers['x-cron-secret'] !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  console.log(`[Cron] Reddit agent running at ${new Date().toISOString()}`);
  console.log(`[Config] Include links: ${INCLUDE_LINKS ? 'YES' : 'NO (help-only)'}`);
  
  checkDailyReset();
  
  if (!canReply()) {
    return res.status(200).json({ status: 'rate_limited', reason: 'daily max reached' });
  }
  
  try {
    const posts = await findRelevantPosts();
    let replied = 0;
    
    for (const post of posts) {
      if (!canReply()) break;
      
      const replyText = await generateReply(post, !INCLUDE_LINKS);
      const success = await replyToPost(post.id, replyText);
      
      if (success) {
        markReplied(post.id, post.subreddit);
        replied++;
        // Shorter wait on Vercel (cold starts are naturally spaced)
        await new Promise(r => setTimeout(r, 30000));
      }
    }
    
    res.status(200).json({ status: 'ok', posts: posts.length, replied });
  } catch (e) {
    console.error('[Cron] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
