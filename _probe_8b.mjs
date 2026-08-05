import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve('.env.local'), override: true });
const KEY = process.env.GROQ_API_KEY;
const html = `<p>According to a study by TubeFilter, the average YouTube creator loses 20% of their views due to poor thumbnail design. This statistic highlights the importance of creating thumbnails that accurately represent the content of the video and appeal to the target audience.</p>`;
for (const model of ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile']) {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${KEY}` },
      body: JSON.stringify({
        model, temperature: 0.2, max_tokens: 400,
        messages: [
          { role: 'system', content: 'Rewrite this paragraph to remove any unverifiable statistic. Soften to qualitative language. Never invent sources. Preserve HTML tags. Return only the rewritten paragraph.' },
          { role: 'user', content: `Rewrite ONLY this paragraph:\n\n${html}` },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) { console.log(`${model}: ERROR ${j.error?.message?.slice(0,120)}`); continue; }
    console.log(`\n=== ${model} ===\n${j.choices?.[0]?.message?.content}`);
  } catch (e) { console.log(`${model}: ${e.message}`); }
}
