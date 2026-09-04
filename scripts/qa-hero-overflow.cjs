// QA: load every generated hero scene HTML and check for overflowing text.
const { chromium } = require('playwright-core');
const { readdirSync } = require('fs');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/nhlaka/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell',
    args: ['--no-sandbox', '--disable-gpu'],
  });
  const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
  const files = readdirSync('/tmp/hero-scenes').filter((f) => f.endsWith('-hero.html')).sort();
  let issues = 0;
  for (const f of files) {
    await page.goto('file:///tmp/hero-scenes/' + f, { waitUntil: 'load' });
    const over = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      const r = svg.getBoundingClientRect();
      return [...svg.querySelectorAll('text')]
        .map((t) => {
          const tr = t.getBoundingClientRect();
          return { s: (t.textContent || '').slice(0, 30), x: tr.x, w: tr.width, o: tr.x < r.x - 1 || tr.x + tr.width > r.x + r.width + 1 };
        })
        .filter((t) => t.o);
    });
    if (over.length) {
      issues++;
      console.log(f, '→', over.map((t) => `${t.s} (x=${Math.round(t.x)} w=${Math.round(t.w)})`).join(' | '));
    }
  }
  console.log(issues === 0 ? `ALL ${files.length} scenes clean — no overflowing text` : `${issues} scenes with overflow`);
  await browser.close();
})();
