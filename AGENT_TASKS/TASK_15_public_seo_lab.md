# TASK 15 — The Public SEO Lab (The Lead Magnet)

## Goal
Create a public-facing "Sandbox" where non-authenticated users can audit their videos. This serves as the primary marketing tool to demonstrate the platform's power and drive sales via a "Blur-and-Unlock" conversion strategy.

---

## STEP 1 — Public Audit API
**Modify file: `api/index.js`**
Add a high-performance, rate-limited public endpoint for lite audits.

```js
const marketingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Only 3 free audits per IP
  message: { error: 'Daily free audit limit reached. Unlock unlimited audits for $10.' }
});

app.post('/api/marketing/lite-audit', marketingLimiter, async (req, res) => {
  const { videoUrl } = req.body;
  // 1. Fetch basic metadata (no channel auth needed)
  // 2. Run Audit Logic (Title Score, Tag Count, Niche Check)
  // 3. Return SCORES and ISSUE SUMMARY, but BLUR the SUGGESTIONS
  res.json({
    score: 42,
    issues: ["Title is too long", "Missing Niche-Relevant Tags"],
    suggestionTeaser: "Nova has 12 fixes ready for this video...",
    blurData: true
  });
});
```

---

## STEP 2 — The "Lab" UI
**Create file: `lab.html`**
Build a premium, high-converting audit page.

- **Feature:** A central input for the YouTube URL.
- **Visual:** A "Scanning..." animation using the UI Engine's glassmorphism styles.
- **The Paywall:** A "Locked Fixes" panel with a CSS `backdrop-filter: blur(10px)` and a bright PayPal/WarriorPlus button.

---

## Acceptance Criteria
1. The Lab is accessible without any login or OAuth.
2. Rate limiting prevents API abuse by bot traffic.
3. The Audit Result generates high FOMO (Fear of Missing Out) by showing the "Score" but hiding the "Solution."
4. Mobile-friendly "Share My Score" buttons are functional.

---

## Files Changed
- `api/index.js` — MODIFIED (New public route)
- `lab.html` — NEW (Marketing Landing Page)
- `style.css` — MODIFIED (Blur-and-Unlock utility classes)
