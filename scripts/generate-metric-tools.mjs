#!/usr/bin/env node
/**
 * scripts/generate-metric-tools.mjs
 *
 * Generates standalone interactive metric calculator tools (not tied to blog posts).
 * Each tool is a complete HTML page with embedded JS — no AI API calls.
 *
 * Tools created:
 *   1. CTR ↔ Impressions Calculator
 *   2. Watch Time Estimator
 *   3. Revenue Estimator (CPM × Views)
 *   4. Subscriber Growth Rate Calculator
 *   5. Keyword Difficulty Score Tool
 *
 * Usage:
 *   node scripts/generate-metric-tools.mjs
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = resolve(__dirname, '../public/tools');
const SITE = 'https://yt-seo-architect.vercel.app';

const TOOLS = [

  // ── 1. CTR ↔ Impressions Calculator ──────────────────────
  {
    slug: 'ctr-impressions-calculator',
    title: 'CTR to Impressions Calculator — Free YouTube Tool',
    h1: '🎯 CTR ↔ Impressions Calculator',
    desc: 'Calculate your YouTube click-through rate from views and impressions, or estimate impressions needed for a target CTR. Free interactive tool.',
    meta: 'Calculate YouTube CTR from views and impressions, or estimate impressions needed. Free interactive tool for content creators.',
    js: `
const ToolLogic = {
  calcCTR() {
    const v = parseFloat(document.getElementById('ctr-views').value);
    const i = parseFloat(document.getElementById('ctr-impressions').value);
    if (!v || !i) return;
    const ctr = (v / i) * 100;
    document.getElementById('ctr-result').textContent = ctr.toFixed(2) + '%';
    document.getElementById('ctr-detail').textContent = v + ' views from ' + i + ' impressions';

    let grade, color;
    if (ctr >= 10) { grade = 'Excellent'; color = '#22c55e'; }
    else if (ctr >= 5) { grade = 'Good'; color = '#86efac'; }
    else if (ctr >= 3) { grade = 'Average'; color = '#fbbf24'; }
    else if (ctr >= 1) { grade = 'Below Average'; color = '#fb923c'; }
    else { grade = 'Poor — needs improvement'; color = '#ef4444'; }
    document.getElementById('ctr-grade').textContent = grade;
    document.getElementById('ctr-grade').style.color = color;
  },
  calcImpressions() {
    const v = parseFloat(document.getElementById('imp-target-views').value);
    const c = parseFloat(document.getElementById('imp-target-ctr').value);
    if (!v || !c || c === 0) return;
    const needed = (v / c) * 100;
    document.getElementById('imp-result').textContent = Math.round(needed).toLocaleString();
    document.getElementById('imp-detail').textContent = 'needed to get ' + v + ' views at ' + c + '% CTR';
  }
};`
  },

  // ── 2. Watch Time Estimator ──────────────────────────────
  {
    slug: 'watch-time-estimator',
    title: 'YouTube Watch Time Calculator — Free Tool',
    h1: '⏱️ Watch Time Estimator',
    desc: 'Estimate total watch time from views and average view duration. Calculate how many hours of watch time your videos generate.',
    meta: 'Estimate YouTube watch time in minutes and hours. Free calculator for content creators to track total watch time.',
    js: `
const ToolLogic = {
  calcWatchTime() {
    const v = parseFloat(document.getElementById('wt-views').value);
    const d = parseFloat(document.getElementById('wt-duration').value);
    if (!v || !d) return;
    const totalSec = v * d;
    const totalMin = totalSec / 60;
    const totalHours = totalMin / 60;
    document.getElementById('wt-minutes').textContent = Math.round(totalMin).toLocaleString();
    document.getElementById('wt-hours').textContent = totalHours.toFixed(1);
    document.getElementById('wt-per-video').textContent = d + 's avg × ' + v + ' views';

    // YouTube Partner Program eligibility check
    const threshold = 4000; // hours
    if (totalHours >= threshold) {
      document.getElementById('wt-eligibility').innerHTML = '✅ You qualify for the <strong>YouTube Partner Program</strong> (4,000+ hours)';
      document.getElementById('wt-eligibility').style.color = '#22c55e';
    } else {
      const pct = ((totalHours / threshold) * 100).toFixed(1);
      document.getElementById('wt-eligibility').innerHTML = '⏳ ' + pct + '% toward YPP eligibility (need 4,000 hours)';
      document.getElementById('wt-eligibility').style.color = '#fbbf24';
    }
  }
};`
  },

  // ── 3. Revenue Estimator ─────────────────────────────────
  {
    slug: 'youtube-revenue-estimator',
    title: 'YouTube Revenue Calculator — Estimate Ad Earnings Free',
    h1: '💰 Revenue Estimator',
    desc: 'Estimate your YouTube ad revenue based on views, CPM, and RPM. See how much you could earn from your videos.',
    meta: 'Estimate YouTube ad revenue from views, CPM, and RPM. Free calculator for content creators to project earnings.',
    js: `
const ToolLogic = {
  calcRevenue() {
    const v = parseFloat(document.getElementById('rev-views').value);
    const c = parseFloat(document.getElementById('rev-cpm').value);
    const r = parseFloat(document.getElementById('rev-rpm').value);
    if (!v || !c) return;

    const cpmRevenue = (v / 1000) * c;
    const rpmRevenue = r ? (v / 1000) * r : '?';
    const monthly = cpmRevenue * 30;
    const yearly = cpmRevenue * 365;

    document.getElementById('rev-cpm-result').textContent = '$' + cpmRevenue.toFixed(2);
    document.getElementById('rev-rpm-result').textContent = r ? '$' + (v / 1000 * r).toFixed(2) : '—';
    document.getElementById('rev-monthly').textContent = '$' + monthly.toFixed(2);
    document.getElementById('rev-yearly').textContent = '$' + yearly.toFixed(2);
    document.getElementById('rev-detail').textContent = v.toLocaleString() + ' views × $' + c.toFixed(2) + ' CPM';

    // CPM benchmark
    let bench;
    if (c >= 10) bench = 'Excellent — your content is in a high-CPM niche (finance, business, tech)';
    else if (c >= 5) bench = 'Good CPM — above average for YouTube creators';
    else if (c >= 2) bench = 'Average CPM — typical for general content';
    else bench = 'Low CPM — consider targeting higher-value topics or improving audience demographics';
    document.getElementById('rev-benchmark').innerHTML = '📊 <strong>CPM Benchmark:</strong> ' + bench;
  }
};`
  },

  // ── 4. Subscriber Growth Rate Calculator ─────────────────
  {
    slug: 'subscriber-growth-calculator',
    title: 'Subscriber Growth Rate Calculator — Free YouTube Tool',
    h1: '📈 Subscriber Growth Rate',
    desc: 'Calculate your YouTube channel subscriber growth rate. Track monthly, weekly, or yearly growth and project future subscribers.',
    meta: 'Calculate YouTube subscriber growth rate. Free tool to track channel growth and project future subscribers.',
    js: `
const ToolLogic = {
  calcGrowth() {
    const s = parseFloat(document.getElementById('gr-start').value);
    const e = parseFloat(document.getElementById('gr-end').value);
    const d = parseFloat(document.getElementById('gr-days').value);
    if (!s || !e || !d) return;

    const gained = e - s;
    const pct = ((gained / s) * 100);
    const dailyRate = pct / d;
    const weeklyRate = dailyRate * 7;
    const monthlyRate = dailyRate * 30;
    const yearlyRate = dailyRate * 365;

    document.getElementById('gr-gained').textContent = gained.toLocaleString();
    document.getElementById('gr-pct').textContent = pct.toFixed(2) + '%';
    document.getElementById('gr-daily').textContent = dailyRate.toFixed(2) + '%';
    document.getElementById('gr-weekly').textContent = weeklyRate.toFixed(2) + '%';
    document.getElementById('gr-monthly').textContent = monthlyRate.toFixed(2) + '%';

    // Projection at current rate
    const project90 = s * Math.pow(1 + dailyRate / 100, 90);
    const project365 = s * Math.pow(1 + dailyRate / 100, 365);
    document.getElementById('gr-proj-90').textContent = Math.round(project90).toLocaleString();
    document.getElementById('gr-proj-365').textContent = Math.round(project365).toLocaleString();

    // Grade
    let grade, color;
    if (monthlyRate >= 10) { grade = 'Viral Growth'; color = '#22c55e'; }
    else if (monthlyRate >= 5) { grade = 'Strong Growth'; color = '#86efac'; }
    else if (monthlyRate >= 2) { grade = 'Steady Growth'; color = '#fbbf24'; }
    else if (monthlyRate >= 0) { grade = 'Slow Growth'; color = '#fb923c'; }
    else { grade = 'Declining'; color = '#ef4444'; }
    document.getElementById('gr-grade').textContent = grade;
    document.getElementById('gr-grade').style.color = color;
  }
};`
  },

  // ── 5. Keyword Difficulty Score ──────────────────────────
  {
    slug: 'keyword-difficulty-scorer',
    title: 'Keyword Difficulty Checker — Free YouTube SEO Tool',
    h1: '🔍 Keyword Difficulty Score',
    desc: 'Score any YouTube keyword for competition and opportunity. Find low-competition keywords that are easier to rank for.',
    meta: 'Score YouTube keyword difficulty and find low-competition opportunities. Free SEO tool for content creators.',
    js: `
const ToolLogic = {
  scoreKeyword() {
    const kw = document.getElementById('kd-keyword').value.trim();
    if (!kw) return;
    const sv = parseFloat(document.getElementById('kd-volume').value) || 0;
    const comp = parseInt(document.getElementById('kd-competition').value) || 3;

    // Difficulty scoring algorithm
    const wordCount = kw.split(' ').length;
    const isLongTail = wordCount >= 3;

    const volumeScore = Math.min(sv / 100, 30);
    const compScore = comp * 10;
    const tailBonus = isLongTail ? 15 : 0;
    const specificityBonus = wordCount >= 4 ? 10 : (wordCount >= 3 ? 5 : 0);

    const total = Math.min(100, volumeScore + compScore - tailBonus - specificityBonus);
    const opportunity = Math.max(0, 100 - total);

    document.getElementById('kd-score').textContent = Math.round(total);
    document.getElementById('kd-opportunity').textContent = Math.round(opportunity);

    let grade, color, advice;
    if (total <= 25) { grade = 'Very Easy'; color = '#22c55e'; advice = 'Go for it — low competition, great opportunity to rank quickly. Create comprehensive content targeting this keyword.'; }
    else if (total <= 45) { grade = 'Easy'; color = '#86efac'; advice = 'Good opportunity. Target this with well-optimized content and you should see rankings within weeks.'; }
    else if (total <= 65) { grade = 'Moderate'; color = '#fbbf24'; advice = 'Competitive but achievable. You\\'ll need strong content, good metadata, and some existing channel authority.'; }
    else if (total <= 85) { grade = 'Hard'; color = '#fb923c'; advice = 'Very competitive. Consider targeting a more specific long-tail variation of this keyword instead.'; }
    else { grade = 'Very Hard'; color = '#ef4444'; advice = 'Extremely competitive. Unless your channel already has strong authority in this niche, target a different keyword.'; }

    document.getElementById('kd-grade').textContent = grade;
    document.getElementById('kd-grade').style.color = color;
    document.getElementById('kd-advice').innerHTML = '💡 ' + advice;

    // Factors breakdown
    document.getElementById('kd-factors').innerHTML =
      '<div class=\"factor\"><span>Keyword length:</span><span>' + wordCount + ' words ' + (isLongTail ? '(long-tail ✅)' : '(short)') + '</span></div>' +
      '<div class=\"factor\"><span>Search volume:</span><span>' + sv.toLocaleString() + '/mo</span></div>' +
      '<div class=\"factor\"><span>Competition level:</span><span>' + ['Very Low','Low','Medium','High','Very High'][comp-1] + '</span></div>' +
      '<div class=\"factor\"><span>Long-tail bonus:</span><span>+' + tailBonus + '</span></div>';
  }
};`
  },
];

function generatePage(tool) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${tool.title}</title>
  <meta name="description" content="${tool.meta}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE}/tools/${tool.slug}" />
  <meta property="og:title" content="${tool.title}" />
  <meta property="og:description" content="${tool.meta}" />
  <meta property="og:image" content="${SITE}/og-image.png" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${SITE}/tools/${tool.slug}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${tool.title}" />
  <meta name="twitter:description" content="${tool.meta}" />
  <meta name="twitter:image" content="${SITE}/og-image.png" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "${tool.h1.replace(/[🎯⏱️💰📈🔍]/g, '').trim()}",
    "description": "${tool.desc}",
    "url": "${SITE}/tools/${tool.slug}/",
    "applicationCategory": "UtilitiesApplication",
    "operatingSystem": "Web",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
  }
  </script>
  <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3831668789026424" crossorigin="anonymous"></script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Outfit','Geist',-apple-system,BlinkMacSystemFont,sans-serif;background:#0a0a0f;color:#e2e8f0;line-height:1.6}
    .header{display:flex;justify-content:space-between;align-items:center;padding:.75rem 1.5rem;background:#0f0c29;border-bottom:1px solid rgba(255,255,255,.05)}
    .header a{color:#e2e8f0;text-decoration:none;font-weight:600}
    .header .cta{background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.4rem 1rem;border-radius:9999px;font-size:.85rem}
    main{max-width:720px;margin:0 auto;padding:2rem 1.5rem}
    h1{font-size:1.8rem;margin-bottom:.5rem;background:linear-gradient(135deg,#f97316,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
    .sub{color:#8b8b9e;font-size:.95rem;margin-bottom:2rem}
    .tool-card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem}
    .tool-card h2{font-size:1.1rem;color:#a5b4fc;margin-bottom:1rem}
    .input-group{margin-bottom:1rem}
    .input-group label{display:block;font-size:.85rem;color:#8b8b9e;margin-bottom:.3rem}
    .input-group input,.input-group select{width:100%;padding:.6rem .8rem;background:#0a0a0f;border:1px solid #2d2a5e;border-radius:8px;color:#e2e8f0;font-size:.95rem;outline:none;transition:border-color .2s}
    .input-group input:focus,.input-group select:focus{border-color:#6366f1}
    .input-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
    @media(max-width:480px){.input-row{grid-template-columns:1fr}}
    button{background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;border:none;padding:.7rem 2rem;border-radius:9999px;font-size:.95rem;font-weight:600;cursor:pointer;transition:transform .2s;width:100%}
    button:hover{transform:scale(1.02)}
    .result-box{background:#0a0a0f;border:1px solid #2d2a5e;border-radius:8px;padding:1rem;margin-top:1rem;display:none}
    .result-box.show{display:block}
    .result-row{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.05)}
    .result-row:last-child{border-bottom:none}
    .result-row .label{color:#8b8b9e;font-size:.85rem}
    .result-row .value{color:#e2e8f0;font-weight:600;font-size:1.1rem}
    .result-big{font-size:2rem;font-weight:800;text-align:center;padding:1rem 0;color:#fb923c}
    .result-detail{text-align:center;color:#8b8b9e;font-size:.85rem;margin-bottom:.5rem}
    .factor{display:flex;justify-content:space-between;padding:.4rem 0;font-size:.85rem;color:#8b8b9e;border-bottom:1px solid rgba(255,255,255,.03)}
    .advice-box{background:rgba(99,102,241,.1);border:1px solid rgba(99,102,241,.3);border-radius:8px;padding:1rem;margin-top:.75rem;font-size:.85rem;color:#a5b4fc;line-height:1.5}
    .cta-box{border:1px solid #4f46e5;border-radius:12px;padding:1.5rem;text-align:center;margin:2rem 0}
    .cta-box h3{color:#e2e8f0;margin-bottom:.5rem}
    .cta-box p{color:#8b8b9e;font-size:.85rem;margin-bottom:1rem}
    .cta-box a{display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.6rem 1.5rem;border-radius:9999px;text-decoration:none;font-weight:600}
    footer{text-align:center;padding:2rem;color:#6b7280;font-size:.8rem}
    footer a{color:#8b8b9e;text-decoration:none}
  </style>
<script defer src="/ga.js"></script></head>
<body>
  <header class="header">
    <a href="/">⚡ YT SEO Architect</a>
    <a href="/tools/" class="cta">All Tools</a>
  </header>
  <main>
    <h1>${tool.h1}</h1>
    <p class="sub">${tool.desc}</p>
    <div id="tool-root">${tool.html}</div>
    <div class="cta-box">
      <h3>🚀 More Free Tools</h3>
      <p>17 AI-powered tools to optimize your YouTube titles, tags, descriptions, and more.</p>
      <a href="/tools/">Browse All Tools →</a>
    </div>
  </main>
  <footer>
    <p>&copy; 2026 YT SEO Architect · <a href="/glossary/">Glossary</a> · <a href="/blog">Blog</a> · <a href="/tools/">Tools</a></p>
  </footer>
  <script>
  ${tool.js}
  document.getElementById('tool-root').innerHTML = \`${tool.html}\`;
  </script>
</body>
</html>`;
}

// ── Generate all tool pages ────────────────────────────────

function main() {
  console.log('\n🛠️  Generating standalone metric calculator tools...\n');

  if (!existsSync(TOOLS_DIR)) {
    mkdirSync(TOOLS_DIR, { recursive: true });
  }

  for (const tool of TOOLS) {
    const html = generatePage(tool);
    const filePath = resolve(TOOLS_DIR, `${tool.slug}.html`);
    writeFileSync(filePath, html);
    const size = (html.length / 1024).toFixed(1);
    console.log(`  ✅ ${tool.slug}.html  [${size}KB]`);
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Generated: ${TOOLS.length} new metric calculator tools`);
  console.log(`  Output: public/tools/\n`);
}

main();
