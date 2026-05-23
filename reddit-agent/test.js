// Test script — finds posts but doesn't reply (dry run)
import 'dotenv/config';
import { findRelevantPosts } from './crawler.js';
import { generateReply } from './ai-responder.js';

async function test() {
  console.log('🔍 Testing Reddit Growth Agent (DRY RUN — no replies posted)\n');
  
  if (!process.env.REDDIT_CLIENT_ID || process.env.REDDIT_CLIENT_ID === 'your_client_id') {
    console.error('❌ REDDIT_CLIENT_ID not set. Copy .env.example to .env and fill in your credentials.\n');
    console.log('Get credentials at: https://www.reddit.com/prefs/apps');
    console.log('Create a "script" type app.\n');
    return;
  }
  
  const posts = await findRelevantPosts();
  console.log(`\n📊 Found ${posts.length} relevant posts:\n`);
  
  for (const post of posts.slice(0, 5)) {
    console.log(`--- r/${post.subreddit} ---`);
    console.log(`Title: ${post.title}`);
    console.log(`URL: ${post.url}`);
    console.log(`Comments: ${post.numComments} | Score: ${post.score}`);
    
    const reply = await generateReply(post);
    console.log(`\n💬 Generated reply:\n${reply}\n`);
  }
  
  if (posts.length === 0) {
    console.log('No matching posts found. Try adjusting keywords in config.js.');
  }
  
  console.log('✅ Dry run complete. No replies were posted.');
}

test();
