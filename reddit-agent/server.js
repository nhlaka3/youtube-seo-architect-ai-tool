import 'dotenv/config';
import express from 'express';
import { findRelevantPosts, markReplied } from './crawler.js';
import { generateReply } from './ai-responder.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

let cachedPosts = [];
let dailyCount = 0;

// Daily counter (simple in-memory — resets on server restart)
const todayStr = new Date().toISOString().slice(0, 10);

// Scan Reddit for relevant posts
app.get('/api/scan', async (req, res) => {
  try {
    const posts = await findRelevantPosts();
    cachedPosts = posts;
    res.json({ posts, dailyCount, maxDaily: 25 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Generate AI reply for a specific post
app.post('/api/generate', async (req, res) => {
  const { postId, helpOnly } = req.body;
  const post = cachedPosts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found — try scanning again' });
  try {
    const reply = await generateReply(post, helpOnly);
    res.json({ reply });
  } catch (e) {
    console.error('[Generate] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Mark as replied (user copied and posted manually)
app.post('/api/done', async (req, res) => {
  const { postId } = req.body;
  if (!postId) return res.status(400).json({ error: 'Missing postId' });
  const post = cachedPosts.find(p => p.id === postId);
  markReplied(postId, post?.subreddit || 'unknown');
  dailyCount++;
  cachedPosts = cachedPosts.filter(p => p.id !== postId);
  res.json({ success: true });
});

const PORT = process.env.PORT || 3456;
app.listen(PORT, () => {
  console.log(`🤖 Reddit Monitor at http://localhost:${PORT}`);
  console.log(`   No Reddit API credentials needed — uses public JSON API\n`);
});
