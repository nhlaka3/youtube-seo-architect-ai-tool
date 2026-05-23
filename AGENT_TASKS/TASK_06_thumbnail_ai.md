# TASK 06 — AI Thumbnail Image Generation

## Goal
Generate actual AI thumbnail images (not just text descriptions) using the
fal.ai API. Users get a real 1280x720 image they can download and upload
to YouTube as a custom thumbnail.

## Prerequisites
- fal.ai API key (free tier: 10 images/day)
- Sign up at: https://fal.ai → get API key → add to .env as FAL_API_KEY

---

## STEP 1 — Install fal.ai client

```bash
npm install @fal-ai/client
```

---

## STEP 2 — Create thumbnail generation API

**Create file: `api/thumbnail-gen.js`**

```js
import express from 'express';
import { z } from 'zod';
import { validateBody } from './middleware/validate.js';
import { deductCredits, CREDIT_COSTS } from './credits.js';

export const router = express.Router();

const sendRes = (res, status, data) => {
  if (!res.headersSent) res.status(status).json(data);
};

const requireChannelId = (req, res, next) => {
  const channelId = req.headers['x-channel-id'] || req.body?.channelId;
  if (!channelId) return sendRes(res, 400, { error: 'Channel connection required' });
  req.channelId = channelId;
  next();
};

const generateSchema = z.object({
  videoTitle: z.string().min(3).max(200),
  niche: z.string().optional(),
  style: z.enum(['cinematic', 'bold', 'minimal', 'dramatic']).optional(),
  concept: z.string().optional(), // Optional user-provided visual concept
});

const THUMBNAIL_CREDIT_COST = 15;

/**
 * Build a high-quality image generation prompt from video metadata.
 */
function buildImagePrompt(videoTitle, niche, style, concept) {
  const styleGuides = {
    cinematic: 'cinematic photography, dramatic lighting, high contrast, 8K resolution, photorealistic',
    bold: 'bold graphic design, bright colors, high saturation, clean composition, YouTube thumbnail style',
    minimal: 'clean minimal design, white space, single focal point, professional photography',
    dramatic: 'dramatic lighting, dark moody atmosphere, powerful composition, intense colors',
  };

  const styleGuide = styleGuides[style || 'bold'];

  // Extract key visual keywords from title
  const title = videoTitle.toLowerCase();
  let visualSuggestion = '';
  
  if (/space|universe|galaxy|cosmos|quantum/i.test(title)) {
    visualSuggestion = 'nebula, stars, cosmic background';
  } else if (/money|income|wealth|business|finance/i.test(title)) {
    visualSuggestion = 'professional business setting, success imagery';
  } else if (/food|recipe|cooking|eat/i.test(title)) {
    visualSuggestion = 'delicious food photography, natural lighting';
  } else if (/fitness|workout|gym|muscle/i.test(title)) {
    visualSuggestion = 'athletic person, gym setting, energetic';
  } else if (/tech|ai|software|code|computer/i.test(title)) {
    visualSuggestion = 'futuristic technology, glowing screens, digital aesthetic';
  } else if (/travel|world|country|explore/i.test(title)) {
    visualSuggestion = 'stunning landscape, travel photography';
  } else {
    visualSuggestion = 'compelling visual subject related to the topic';
  }

  const conceptLine = concept ? `Visual concept: ${concept}. ` : '';

  return `YouTube thumbnail, 16:9 ratio, ${conceptLine}${visualSuggestion}, text overlay area for "${videoTitle.substring(0, 40)}", ${styleGuide}, no text in image, space for title overlay at bottom or top, professional YouTube thumbnail composition`;
}

// ── Route: Generate thumbnail concept (text only, no API cost) ──
router.post('/concept', requireChannelId, validateBody(generateSchema), async (req, res) => {
  try {
    const { videoTitle, niche, style } = req.body;
    const { askAI } = await import('./_lib/ai-provider.js');

    const raw = await askAI(
      'You are a YouTube thumbnail design expert. Return ONLY valid JSON.',
      `Create 3 thumbnail design concepts for this YouTube video.
Title: "${videoTitle}"
Niche: "${niche || 'General'}"
Style: "${style || 'bold'}"

Return JSON:
{
  "concepts": [
    {
      "name": "Concept name",
      "description": "Visual description (what to show)",
      "textOverlay": "Short text to overlay on thumbnail (max 4 words)",
      "colors": ["#hexcolor1", "#hexcolor2"],
      "emotion": "What emotion this thumbnail triggers",
      "imagePrompt": "Detailed prompt for AI image generation"
    }
  ],
  "recommendedConcept": 0
}`,
      { temperature: 0.8, maxTokens: 800 }
    );

    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    sendRes(res, 200, {
      concepts: parsed.concepts || [],
      recommendedConcept: parsed.recommendedConcept || 0,
      videoTitle,
    });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Generate actual thumbnail image ──
router.post('/generate', requireChannelId, validateBody(generateSchema), async (req, res) => {
  try {
    const { videoTitle, niche, style, concept } = req.body;

    // Check credits (15 credits per image)
    const cr = await deductCredits(req.channelId, THUMBNAIL_CREDIT_COST);
    if (!cr.success) {
      return sendRes(res, 403, { error: 'Insufficient credits (15 required)', balance: cr.balance });
    }

    const falApiKey = process.env.FAL_API_KEY;
    if (!falApiKey) {
      // Fallback: return concept only if no fal key
      const conceptRes = await fetch(`${req.protocol}://${req.get('host')}/api/thumbnail/concept`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-channel-id': req.channelId,
          'X-CSRF-Token': req.headers['x-csrf-token'] || '',
        },
        body: JSON.stringify({ videoTitle, niche, style }),
      });
      const conceptData = await conceptRes.json();
      return sendRes(res, 200, {
        mode: 'concept_only',
        message: 'FAL_API_KEY not configured. Add it to .env to enable image generation.',
        ...conceptData,
        newBalance: cr.balance,
      });
    }

    // Build image prompt
    const imagePrompt = buildImagePrompt(videoTitle, niche, style, concept);
    
    // Call fal.ai FLUX model
    const falRes = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: imagePrompt,
        image_size: { width: 1280, height: 720 },
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    });

    if (!falRes.ok) {
      const errData = await falRes.text();
      console.error('[Thumbnail Gen] fal.ai error:', errData.substring(0, 200));
      return sendRes(res, 502, { 
        error: 'Image generation service error',
        mode: 'concept_only',
        newBalance: cr.balance,
      });
    }

    const falData = await falRes.json();
    const imageUrl = falData.images?.[0]?.url;
    
    if (!imageUrl) {
      return sendRes(res, 502, { error: 'No image returned from generation service' });
    }

    sendRes(res, 200, {
      success: true,
      imageUrl,
      prompt: imagePrompt,
      videoTitle,
      newBalance: cr.balance,
      mode: 'generated',
    });
  } catch (e) {
    console.error('[Thumbnail Gen] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── Route: Generate multiple style variants ──
router.post('/generate-variants', requireChannelId, async (req, res) => {
  try {
    const { videoTitle, niche } = req.body;
    if (!videoTitle) return sendRes(res, 400, { error: 'videoTitle required' });

    const styles = ['cinematic', 'bold', 'minimal', 'dramatic'];
    const prompts = styles.map(s => ({
      style: s,
      prompt: buildImagePrompt(videoTitle, niche, s, null),
    }));

    sendRes(res, 200, {
      variants: prompts,
      note: 'Use POST /api/thumbnail/generate with style parameter to generate any variant',
      creditCostEach: THUMBNAIL_CREDIT_COST,
    });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

export default router;
```

---

## STEP 3 — Register in main.js

```js
// Import:
import { router as thumbnailRouter } from './api/thumbnail-gen.js';

// Register:
app.use('/api/thumbnail', thumbnailRouter);
```

---

## STEP 4 — Add environment variable

**Modify file: `.env`** — add:
```
FAL_API_KEY=your_fal_api_key_here
```

**Modify file: `.env.example`** — add:
```
FAL_API_KEY=get_from_fal.ai
```

---

## STEP 5 — Add Thumbnail Generator UI to dashboard.html

Find an appropriate place in the dashboard (near the "Video Factory" or 
"Pre-Upload Lab" panel). Add a thumbnail generator widget:

```html
<!-- Inside an existing panel or as new panel: -->
<div class="thumbnail-gen-widget" style="
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  padding: 24px;
  margin-top: 24px;
">
  <h3 style="margin:0 0 16px;">🎨 AI Thumbnail Generator</h3>
  
  <div style="display:grid;gap:12px;margin-bottom:16px;">
    <input type="text" id="thumb-title-input" placeholder="Video title" class="input-field" />
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <select id="thumb-style-select" class="input-field" style="flex:1;">
        <option value="bold">Bold & Bright</option>
        <option value="cinematic">Cinematic</option>
        <option value="minimal">Minimal</option>
        <option value="dramatic">Dramatic</option>
      </select>
      <input type="text" id="thumb-niche-input" placeholder="Niche" class="input-field" style="flex:1;" />
    </div>
  </div>
  
  <div style="display:flex;gap:8px;margin-bottom:16px;">
    <button class="btn-secondary" onclick="generateThumbnailConcept()" style="flex:1;">
      💡 Get Concept (Free)
    </button>
    <button class="btn-primary" onclick="generateThumbnailImage()" style="flex:1;">
      🎨 Generate Image (15 credits)
    </button>
  </div>
  
  <div id="thumb-loading" style="display:none;text-align:center;padding:20px;">
    <div class="loading-spinner"></div>
    <p style="color:var(--text-muted);margin-top:8px;">Generating thumbnail...</p>
  </div>
  
  <div id="thumb-result" style="display:none;">
    <img id="thumb-preview-img" src="" alt="Generated thumbnail" 
      style="width:100%;border-radius:8px;margin-bottom:12px;" />
    <div style="display:flex;gap:8px;">
      <a id="thumb-download-link" href="" download="thumbnail.jpg" class="btn-secondary" style="flex:1;text-align:center;text-decoration:none;">
        ⬇️ Download
      </a>
    </div>
  </div>
  
  <div id="thumb-concept-result" style="display:none;"></div>
</div>
```

Add to main.js:

```js
// ══ THUMBNAIL GENERATOR ══

async function generateThumbnailConcept() {
  const title = document.getElementById('thumb-title-input')?.value?.trim();
  if (!title) return alert('Enter a video title first');
  
  document.getElementById('thumb-loading').style.display = 'block';
  document.getElementById('thumb-concept-result').style.display = 'none';
  
  try {
    const channelId = window.currentChannelId || '';
    const res = await fetch('/api/thumbnail/concept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': channelId, 'X-CSRF-Token': window.csrfToken || '' },
      body: JSON.stringify({
        videoTitle: title,
        niche: document.getElementById('thumb-niche-input')?.value || 'General',
        style: document.getElementById('thumb-style-select')?.value || 'bold',
      }),
    });
    const data = await res.json();
    const concept = data.concepts?.[data.recommendedConcept || 0];
    if (concept) {
      const conceptEl = document.getElementById('thumb-concept-result');
      conceptEl.innerHTML = `
        <div style="background:rgba(0,212,255,0.05);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:16px;">
          <strong>${concept.name}</strong>
          <p style="color:var(--text-muted);margin:8px 0;">${concept.description}</p>
          <div>Text overlay: <code>${concept.textOverlay}</code></div>
          <div style="margin-top:8px;">Emotion trigger: ${concept.emotion}</div>
        </div>
      `;
      conceptEl.style.display = 'block';
    }
  } catch (err) {
    alert('Concept generation failed: ' + err.message);
  } finally {
    document.getElementById('thumb-loading').style.display = 'none';
  }
}

async function generateThumbnailImage() {
  const title = document.getElementById('thumb-title-input')?.value?.trim();
  if (!title) return alert('Enter a video title first');
  
  document.getElementById('thumb-loading').style.display = 'block';
  document.getElementById('thumb-result').style.display = 'none';
  
  try {
    const channelId = window.currentChannelId || '';
    const res = await fetch('/api/thumbnail/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-channel-id': channelId, 'X-CSRF-Token': window.csrfToken || '' },
      body: JSON.stringify({
        videoTitle: title,
        niche: document.getElementById('thumb-niche-input')?.value || 'General',
        style: document.getElementById('thumb-style-select')?.value || 'bold',
      }),
    });
    const data = await res.json();
    if (data.imageUrl) {
      document.getElementById('thumb-preview-img').src = data.imageUrl;
      document.getElementById('thumb-download-link').href = data.imageUrl;
      document.getElementById('thumb-result').style.display = 'block';
    } else if (data.mode === 'concept_only') {
      alert('Image generation requires FAL_API_KEY. Showing concept instead.');
    } else {
      throw new Error(data.error || 'Generation failed');
    }
  } catch (err) {
    alert('Thumbnail generation failed: ' + err.message);
  } finally {
    document.getElementById('thumb-loading').style.display = 'none';
  }
}

window.generateThumbnailConcept = generateThumbnailConcept;
window.generateThumbnailImage = generateThumbnailImage;
```

---

## Acceptance Criteria

1. `POST /api/thumbnail/concept` returns `{ concepts: [...], recommendedConcept: 0 }`
2. Each concept has: `name, description, textOverlay, colors, emotion, imagePrompt`
3. `POST /api/thumbnail/generate` without FAL_API_KEY returns `{ mode: 'concept_only' }`
4. With FAL_API_KEY set: returns `{ imageUrl: "https://..." }` (actual hosted image URL)
5. Credit cost of 15 deducted on generate
6. Dashboard widget renders and "Get Concept" button works without API key

## Files Changed
- `api/thumbnail-gen.js` — NEW
- `main.js` — MODIFIED (router registration + JS functions)
- `dashboard.html` — MODIFIED (thumbnail widget HTML)
- `.env` — MODIFIED (add FAL_API_KEY)
- `.env.example` — MODIFIED
- `package.json` — add @fal-ai/client
