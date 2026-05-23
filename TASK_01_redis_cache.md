TASK 01 — Redis/Memory Caching Layer

## Goal
Add a caching wrapper so expensive AI calls (keyword research, SEO bundles,
trend data) are cached and not re-computed on every request. This cuts AI API
costs by 60-80% and makes responses 10x faster for repeated queries.

## Package to install
```bash
npm install node-cache
```
(Use `node-cache` — it's in-process memory cache, no external service needed.
Works perfectly on Vercel serverless. No env vars required.)

---

## STEP 1 — Create the cache module

**Create file: `api/_lib/cache.js`**

```js
import NodeCache from 'node-cache';

// TTL values in seconds
const TTL = {
  KEYWORD_SUGGESTIONS: 86400,   // 24 hours
  SEO_BUNDLE: 43200,            // 12 hours  
  TREND_PULSE: 3600,            // 1 hour
  COMPETITOR: 21600,            // 6 hours
  AI_ANALYSIS: 7200,            // 2 hours
};

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600, useClones: false });

/**
 * Get a cached value or compute it fresh.
 * @param {string} key - Cache key
 * @param {number} ttl - TTL in seconds
 * @param {Function} fn - Async function that returns the value if cache miss
 * @returns {Promise<any>}
 */
export async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit !== undefined) {
    return hit;
  }
  const value = await fn();
  cache.set(key, value, ttl);
  return value;
}

export function invalidate(key) {
  cache.del(key);
}

export function invalidatePattern(prefix) {
  const keys = cache.keys().filter(k => k.startsWith(prefix));
  keys.forEach(k => cache.del(k));
}

export function cacheStats() {
  return cache.getStats();
}

export { TTL };
```

---

## STEP 2 — Wire cache into existing AI endpoints

**Modify file: `api/ai-engine.js`**

Find the `/proxy-keywords` route (around line 408) and wrap its fetch call:

```js
// BEFORE:
router.get('/proxy-keywords', validateQuery(proxyKeywordsSchema), async (req, res) => {
  try {
    const { q } = req.query;
    const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`);
    const data = await response.json();
    res.status(200).json(data[1] || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// AFTER:
router.get('/proxy-keywords', validateQuery(proxyKeywordsSchema), async (req, res) => {
  try {
    const { q } = req.query;
    const { cached, TTL } = await import('./_lib/cache.js');
    const cacheKey = `yt-suggest:${q.toLowerCase().trim()}`;
    const suggestions = await cached(cacheKey, TTL.KEYWORD_SUGGESTIONS, async () => {
      const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(q)}`);
      const data = await response.json();
      return data[1] || [];
    });
    res.status(200).json(suggestions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

Do the same for `/proxy-google-keywords` (same pattern, key prefix `g-suggest:`).

**Modify the `/seo-bundle` route** to cache by topic hash:

Find the route `router.post('/seo-bundle', ...)` and wrap the AI call:

```js
// Add at top of the route handler, before the AI call:
const { cached, invalidate, TTL } = await import('./_lib/cache.js');
const topicHash = Buffer.from((safeTopic + safeTone + safeNiche).toLowerCase()).toString('base64').slice(0, 32);
const cacheKey = `seo-bundle:${topicHash}`;

const content = await cached(cacheKey, TTL.SEO_BUNDLE, async () => {
  const rawContent = await askAI('You are a YouTube SEO Expert. Return ONLY valid JSON.', bundlePrompt, { temperature: 0.8 });
  return JSON.parse(rawContent.replace(/```json|```/g, '').trim());
});

// Then use `content` directly (skip the separate JSON.parse line below)
```

---

## STEP 3 — Add cache stats endpoint

**Modify file: `api/ai-engine.js`** — add at the bottom before `export default router`:

```js
router.get('/cache-stats', async (req, res) => {
  try {
    const { cacheStats } = await import('./_lib/cache.js');
    sendRes(res, 200, { stats: cacheStats(), timestamp: new Date().toISOString() });
  } catch (e) {
    sendRes(res, 200, { stats: {}, error: e.message });
  }
});
```

---

## STEP 4 — Register the new endpoint in main.js

**Search `main.js` for where `aiRouter` is registered.** It will look like:

```js
app.use('/api/ai', aiRouter);
```

No change needed — the new `/cache-stats` endpoint is already inside `aiRouter`.

---

## Acceptance Criteria

1. Run: `npm install node-cache`
2. Start server: the app boots without errors
3. Hit `GET /api/ai/proxy-keywords?q=youtube+seo` twice in quick succession
   — second response should be instant (< 10ms)
4. Hit `GET /api/ai/cache-stats` — should return `{ stats: { keys: N, hits: N, misses: N } }`
5. No existing tests broken

## Files Changed
- `api/_lib/cache.js` — NEW
- `api/ai-engine.js` — MODIFIED (proxy-keywords, proxy-google-keywords, seo-bundle routes)
- `package.json` — node-cache dependency added
