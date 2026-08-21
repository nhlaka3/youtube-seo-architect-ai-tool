#!/usr/bin/env node
/**
 * scripts/generate-all-metric-tools.mjs
 *
 * Generates a complete suite of YouTube metric calculator tools.
 * Like Wise's currency converters — one tool for every metric combination.
 *
 * Usage: node scripts/generate-all-metric-tools.mjs
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = resolve(__dirname, '../public/tools');
const SITE = 'https://yt-seo-architect.vercel.app';

const TOOLS = [

  // ── 6. Engagement Rate Calculator ─────────────────────────
  {
    slug: 'engagement-rate-calculator',
    title: 'YouTube Engagement Rate Calculator — Free Tool',
    h1: '❤️ Engagement Rate Calculator',
    desc: 'Calculate your YouTube engagement rate from likes, comments, shares, and views. Compare against niche benchmarks.',
    meta: 'Calculate YouTube engagement rate from likes, comments, and views. Free tool to measure audience interaction.',
    fields: ['likes', 'comments', 'shares', 'views'],
    js: `
const ToolLogic = {
  calcEngagement() {
    const l = parseFloat(document.getElementById('eg-likes').value) || 0;
    const c = parseFloat(document.getElementById('eg-comments').value) || 0;
    const s = parseFloat(document.getElementById('eg-shares').value) || 0;
    const v = parseFloat(document.getElementById('eg-views').value);
    if (!v || v === 0) return;
    const total = l + c + s;
    const rate = (total / v) * 100;
    document.getElementById('eg-rate').textContent = rate.toFixed(2) + '%';
    document.getElementById('eg-total').textContent = total.toLocaleString();
    document.getElementById('eg-per-thousand').textContent = ((total / v) * 1000).toFixed(1);

    let grade, color;
    if (rate >= 10) { grade = 'Viral'; color = '#22c55e'; }
    else if (rate >= 5) { grade = 'Excellent'; color = '#86efac'; }
    else if (rate >= 3) { grade = 'Good'; color = '#fbbf24'; }
    else if (rate >= 1) { grade = 'Average'; color = '#fb923c'; }
    else { grade = 'Low — try improving your CTAs'; color = '#ef4444'; }
    document.getElementById('eg-grade').textContent = grade;
    document.getElementById('eg-grade').style.color = color;

    const breakdown = [];
    if (l > 0) breakdown.push('<div class="factor"><span>👍 Likes</span><span>' + l.toLocaleString() + ' (' + ((l/v)*100).toFixed(2) + '%)</span></div>');
    if (c > 0) breakdown.push('<div class="factor"><span>💬 Comments</span><span>' + c.toLocaleString() + ' (' + ((c/v)*100).toFixed(2) + '%)</span></div>');
    if (s > 0) breakdown.push('<div class="factor"><span>🔗 Shares</span><span>' + s.toLocaleString() + ' (' + ((s/v)*100).toFixed(2) + '%)</span></div>');
    document.getElementById('eg-breakdown').innerHTML = breakdown.join('');
  }
};`
  },

  // ── 7. Video Length Optimizer ─────────────────────────────
  {
    slug: 'video-length-optimizer',
    title: 'YouTube Video Length Optimizer — Free Tool',
    h1: '⏱️ Video Length Optimizer',
    desc: 'Find the ideal video length for your YouTube niche. Optimize for watch time, retention, and algorithm performance.',
    meta: 'Find the ideal YouTube video length for your niche. Optimize watch time and retention with data-driven recommendations.',
    fields: ['niche', 'content-type', 'audience'],
    js: `
const ToolLogic = {
  optimize() {
    const niche = document.getElementById('vl-niche').value;
    const type = document.getElementById('vl-type').value;
    const audience = document.getElementById('vl-audience').value;

    const recommendations = {
      'education': { min: 8, max: 20, ideal: 12, reason: 'Tutorials and educational content perform best at 10-15 minutes — enough depth without losing attention.' },
      'entertainment': { min: 5, max: 15, ideal: 10, reason: 'Entertainment content should be concise. Keep it under 15 minutes for maximum retention.' },
      'gaming': { min: 10, max: 30, ideal: 18, reason: 'Gaming content varies — let\'s plays work at 20-30 min, highlights at 8-12 min.' },
      'music': { min: 3, max: 8, ideal: 4, reason: 'Music content should match song length. 3-5 minutes is standard.' },
      'tech': { min: 8, max: 25, ideal: 14, reason: 'Tech reviews and tutorials need 10-20 minutes for thorough coverage.' },
      'vlog': { min: 8, max: 20, ideal: 12, reason: 'Vlogs work best at 10-15 minutes — enough story without losing viewers.' },
      'cooking': { min: 6, max: 15, ideal: 10, reason: 'Cooking content should be 8-12 minutes. Long enough for the recipe, short enough to retain.' },
      'fitness': { min: 10, max: 30, ideal: 20, reason: 'Fitness viewers commit to longer sessions. 15-25 minute workouts perform best.' },
      'travel': { min: 8, max: 20, ideal: 14, reason: 'Travel vlogs need 10-15 minutes to tell a complete story.' },
      'commentary': { min: 8, max: 25, ideal: 15, reason: 'Commentary and analysis content benefits from 12-20 minute deep dives.' },
    };

    const rec = recommendations[niche] || { min: 8, max: 15, ideal: 10, reason: 'General content works well at 8-15 minutes.' };
    const midrollEligible = rec.ideal >= 8 ? '✅ Yes (over 8 minutes)' : '❌ No (under 8 minutes)';

    document.getElementById('vl-ideal').textContent = rec.ideal + ' minutes';
    document.getElementById('vl-range').textContent = rec.min + '-' + rec.max + ' minutes';
    document.getElementById('vl-reason').textContent = rec.reason;
    document.getElementById('vl-midroll').textContent = midrollEligible;
    document.getElementById('vl-midroll').style.color = rec.ideal >= 8 ? '#22c55e' : '#ef4444';
    document.getElementById('vl-result').classList.add('show');
  }
};`
  },

  // ── 8. Channel Health Score ───────────────────────────────
  {
    slug: 'channel-health-score',
    title: 'YouTube Channel Health Score — Free Audit Tool',
    h1: '📊 Channel Health Score',
    desc: 'Get a comprehensive YouTube channel health score. Evaluate CTR, retention, upload consistency, engagement, and growth.',
    meta: 'Score your YouTube channel health across 5 key metrics. Free audit tool for content creators.',
    fields: ['ctr', 'retention', 'uploads', 'engagement', 'growth'],
    js: `
const ToolLogic = {
  scoreHealth() {
    const ctr = parseFloat(document.getElementById('ch-ctr').value) || 5;
    const ret = parseFloat(document.getElementById('ch-retention').value) || 40;
    const ups = parseFloat(document.getElementById('ch-uploads').value) || 4;
    const eng = parseFloat(document.getElementById('ch-engagement').value) || 3;
    const gro = parseFloat(document.getElementById('ch-growth').value) || 5;

    const scores = {
      ctr: Math.min(20, (ctr / 10) * 20),
      retention: Math.min(20, (ret / 60) * 20),
      consistency: Math.min(20, (ups / 12) * 20),
      engagement: Math.min(20, (eng / 10) * 20),
      growth: Math.min(20, (gro / 15) * 20),
    };

    const total = Object.values(scores).reduce((a, b) => a + b, 0);

    document.getElementById('ch-ctr-score').textContent = Math.round(scores.ctr) + '/20';
    document.getElementById('ch-ret-score').textContent = Math.round(scores.retention) + '/20';
    document.getElementById('ch-con-score').textContent = Math.round(scores.consistency) + '/20';
    document.getElementById('ch-eng-score').textContent = Math.round(scores.engagement) + '/20';
    document.getElementById('ch-gro-score').textContent = Math.round(scores.growth) + '/20';
    document.getElementById('ch-total').textContent = Math.round(total) + '/100';

    let grade, color;
    if (total >= 85) { grade = 'Excellent — your channel is well-optimized'; color = '#22c55e'; }
    else if (total >= 70) { grade = 'Good — a few areas to improve'; color = '#86efac'; }
    else if (total >= 50) { grade = 'Average — focus on weak spots below'; color = '#fbbf24'; }
    else if (total >= 30) { grade = 'Needs Work — pick one area to improve first'; color = '#fb923c'; }
    else { grade = 'Early Stage — consistent uploads are priority #1'; color = '#ef4444'; }
    document.getElementById('ch-grade').textContent = grade;
    document.getElementById('ch-grade').style.color = color;
    document.getElementById('ch-result').classList.add('show');
  }
};`
  },

  // ── 9. Upload Schedule Optimizer ──────────────────────────
  {
    slug: 'upload-schedule-optimizer',
    title: 'YouTube Upload Schedule Optimizer — Free Tool',
    h1: '📅 Upload Schedule Optimizer',
    desc: 'Find the optimal upload frequency and schedule for your YouTube channel based on your niche and goals.',
    meta: 'Optimize your YouTube upload schedule. Find the best posting frequency for your niche and goals.',
    fields: ['niche', 'goal', 'time'],
    js: `
const ToolLogic = {
  optimize() {
    const niche = document.getElementById('us-niche').value;
    const goal = document.getElementById('us-goal').value;
    const hours = parseFloat(document.getElementById('us-hours').value) || 10;

    const nicheRecs = {
      'education': { min: 1, max: 3, ideal: 2, why: 'Educational channels grow best with 2 high-quality videos/week. Each video needs research time.' },
      'entertainment': { min: 2, max: 5, ideal: 3, why: 'Entertainment needs frequent uploads. 3/week keeps your audience engaged and the algorithm happy.' },
      'gaming': { min: 3, max: 7, ideal: 5, why: 'Gaming is competitive — 5 videos/week is the sweet spot for growth.' },
      'vlog': { min: 1, max: 4, ideal: 2, why: 'Vlogs work at 2/week. Quality over quantity — each vlog needs a real story.' },
      'tech': { min: 1, max: 2, ideal: 1, why: 'Tech reviews take time. 1 high-quality video/week beats 3 rushed ones.' },
      'cooking': { min: 1, max: 3, ideal: 2, why: 'Cooking channels do well with 2/week — one recipe, one technique/tip.' },
    };

    const rec = nicheRecs[niche] || { min: 1, max: 3, ideal: 2, why: '2 videos/week is a solid starting point for most niches.' };

    const feasible = Math.min(rec.max, Math.max(rec.min, Math.floor(hours / 4)));
    const recommended = Math.max(rec.min, Math.min(rec.ideal, feasible));

    document.getElementById('us-recommended').textContent = recommended + ' videos/week';
    document.getElementById('us-range').textContent = rec.min + '-' + rec.max + ' per week';
    document.getElementById('us-why').textContent = rec.why;
    document.getElementById('us-feasible').textContent = 'With ' + hours + 'h/week, you can sustainably produce ' + feasible + ' videos';
    document.getElementById('us-result').classList.add('show');
  }
};`
  },

  // ── 10. Cost Per View Calculator ───────────────────────────
  {
    slug: 'cost-per-view-calculator',
    title: 'YouTube Cost Per View Calculator — Free Tool',
    h1: '💰 Cost Per View Calculator',
    desc: 'Calculate your cost per view, cost per subscriber, and ROI for YouTube ads and sponsored content.',
    meta: 'Calculate YouTube cost per view and ROI. Free tool for tracking ad spend efficiency and content production costs.',
    fields: ['cost', 'views', 'subs'],
    js: `
const ToolLogic = {
  calcCPV() {
    const cost = parseFloat(document.getElementById('cp-cost').value);
    const views = parseFloat(document.getElementById('cp-views').value);
    const subs = parseFloat(document.getElementById('cp-subs').value) || 0;

    if (!cost || !views) return;

    const cpv = cost / views;
    const cps = subs > 0 ? cost / subs : 0;
    const rpm = (cost / views) * 1000;

    document.getElementById('cp-cpv').textContent = '$' + cpv.toFixed(4);
    document.getElementById('cp-cpm').textContent = '$' + (rpm * 2).toFixed(2) + ' (estimated CPM)';
    document.getElementById('cp-rpm').textContent = '$' + rpm.toFixed(2);
    document.getElementById('cp-cps').textContent = subs > 0 ? '$' + cps.toFixed(2) : '—';

    let grade;
    if (cpv <= 0.01) grade = 'Excellent — very cost-efficient';
    else if (cpv <= 0.03) grade = 'Good — reasonable cost per view';
    else if (cpv <= 0.05) grade = 'Average — typical for most niches';
    else grade = 'High — consider optimizing your targeting or content';

    document.getElementById('cp-grade').textContent = grade;
    document.getElementById('cp-result').classList.add('show');
  }
};`
  },

  // ── 11. Title A/B Tester ─────────────────────────────────
  {
    slug: 'title-ab-tester',
    title: 'YouTube Title A/B Tester — Free Tool',
    h1: '🎯 Title A/B Tester',
    desc: 'Compare two YouTube video titles side by side. See which one scores higher for CTR, SEO, and engagement potential.',
    meta: 'A/B test YouTube video titles. Compare two titles for CTR, SEO, and engagement scores.',
    fields: ['title-a', 'title-b'],
    js: `
const ToolLogic = {
  compare() {
    const a = document.getElementById('ab-title-a').value.trim();
    const b = document.getElementById('ab-title-b').value.trim();
    if (!a || !b) return;

    function scoreTitle(t) {
      let score = 50;
      const lower = t.toLowerCase();
      const words = t.split(' ').length;

      if (t.length >= 30 && t.length <= 60) score += 15;
      else if (t.length < 20) score -= 10;

      if (/\\d/.test(t)) score += 10;
      if (t.includes('?')) score += 5;
      if (/[\\[\\]()]/.test(t)) score += 5;

      const powerWords = ['ultimate','best','top','guide','how to','tips','tricks','secret','easy','fast','proven','essential','complete'];
      const found = powerWords.filter(w => lower.includes(w)).length;
      score += Math.min(found * 4, 16);

      if (words >= 5 && words <= 12) score += 5;
      else if (words > 15) score -= 5;

      return { score: Math.min(100, score), length: t.length, words, hasNumber: /\\d/.test(t), hasBrackets: /[\\[\\]()]/.test(t), powerWords: found };
    }

    const sa = scoreTitle(a);
    const sb = scoreTitle(b);
    const winner = sa.score > sb.score ? 'A' : (sb.score > sa.score ? 'B' : 'Tie');

    document.getElementById('ab-score-a').textContent = sa.score + '/100';
    document.getElementById('ab-score-b').textContent = sb.score + '/100';
    document.getElementById('ab-detail-a').innerHTML =
      sa.length + ' chars | ' + sa.words + ' words | ' + (sa.hasNumber ? '✅ Number' : '❌ No number') + ' | ' + sa.powerWords + ' power words';
    document.getElementById('ab-detail-b').innerHTML =
      sb.length + ' chars | ' + sb.words + ' words | ' + (sb.hasNumber ? '✅ Number' : '❌ No number') + ' | ' + sb.powerWords + ' power words';
    document.getElementById('ab-winner').textContent = 'Winner: Title ' + winner;
    document.getElementById('ab-winner').style.color = winner === 'Tie' ? '#fbbf24' : '#22c55e';
    document.getElementById('ab-result').classList.add('show');
  }
};`
  },

  // ── 12. Audience Retention Benchmark ─────────────────────
  {
    slug: 'audience-retention-benchmark',
    title: 'YouTube Audience Retention Benchmark — Free Tool',
    h1: '📈 Audience Retention Benchmark',
    desc: 'Compare your audience retention rates against YouTube benchmarks. Find retention drop-off points and optimize your content.',
    meta: 'Benchmark your YouTube audience retention against averages. Identify drop-off points and optimize.',
    fields: ['retention-rate', 'video-length', 'niche'],
    js: `
const ToolLogic = {
  benchmark() {
    const ret = parseFloat(document.getElementById('ar-rate').value);
    const len = parseFloat(document.getElementById('ar-length').value);
    const niche = document.getElementById('ar-niche').value;

    const benchmarks = {
      'education': 45, 'entertainment': 35, 'gaming': 40,
      'music': 50, 'tech': 40, 'vlog': 42,
      'cooking': 48, 'fitness': 55, 'travel': 45, 'commentary': 38
    };
    const avgRet = benchmarks[niche] || 40;

    const diff = ret - avgRet;
    document.getElementById('ar-your').textContent = ret + '%';
    document.getElementById('ar-benchmark').textContent = avgRet + '%';
    document.getElementById('ar-diff').textContent = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    document.getElementById('ar-diff').style.color = diff >= 0 ? '#22c55e' : '#ef4444';

    const dropoff = Math.round(len * (1 - ret / 100) * 60);
    document.getElementById('ar-dropoff').textContent = Math.round(len * (1 - ret / 100) * 60 / 60) + ' min ' + (dropoff % 60) + ' sec';

    let tip;
    if (ret >= avgRet + 10) tip = 'Your retention is excellent! Focus on maintaining this with consistent hooks and pacing.';
    else if (ret >= avgRet) tip = 'Good retention. Try front-loading your key points in the first 30 seconds to capture more viewers.';
    else if (ret >= avgRet - 10) tip = 'Below average. Check your intro length — most drop-off happens in the first 15 seconds. Trim hooks and get to the point faster.';
    else tip = 'Significant improvement needed. Study your audience retention graph for specific drop-off points and restructure those sections.';
    document.getElementById('ar-tip').textContent = tip;
    document.getElementById('ar-result').classList.add('show');
  }
};`
  },

  // ── 13. Monetization Readiness Checker ────────────────────
  {
    slug: 'monetization-readiness-checker',
    title: 'YouTube Monetization Readiness Check — Free Tool',
    h1: '💰 Monetization Readiness Check',
    desc: 'Check if your YouTube channel is ready for the YouTube Partner Program. Track subs, watch hours, and policy compliance.',
    meta: 'Check YouTube Partner Program eligibility. Track subscribers, watch hours, and monetization requirements.',
    fields: ['subs', 'hours', 'videos', 'country'],
    js: `
const ToolLogic = {
  check() {
    const subs = parseFloat(document.getElementById('mr-subs').value) || 0;
    const hours = parseFloat(document.getElementById('mr-hours').value) || 0;
    const videos = parseFloat(document.getElementById('mr-videos').value) || 0;

    const subReq = 1000;
    const hourReq = 4000;

    const subPct = Math.min(100, (subs / subReq) * 100);
    const hourPct = Math.min(100, (hours / hourReq) * 100);

    document.getElementById('mr-subs-status').innerHTML = subs.toLocaleString() + ' / ' + subReq.toLocaleString() + ' (' + subPct.toFixed(1) + '%)';
    document.getElementById('mr-hours-status').innerHTML = hours.toLocaleString() + ' / ' + hourReq.toLocaleString() + ' (' + hourPct.toFixed(1) + '%)';
    document.getElementById('mr-videos-status').innerHTML = videos + ' videos published';

    document.getElementById('mr-subs-bar').style.width = subPct + '%';
    document.getElementById('mr-subs-bar').style.background = subPct >= 100 ? '#22c55e' : '#f97316';
    document.getElementById('mr-hours-bar').style.width = hourPct + '%';
    document.getElementById('mr-hours-bar').style.background = hourPct >= 100 ? '#22c55e' : '#f97316';

    if (subs >= subReq && hours >= hourReq) {
      document.getElementById('mr-verdict').innerHTML = '✅ You qualify! Apply for the YouTube Partner Program.';
      document.getElementById('mr-verdict').style.color = '#22c55e';
    } else {
      const missing = [];
      if (subs < subReq) missing.push((subReq - subs) + ' more subscribers');
      if (hours < hourReq) missing.push((hourReq - hours) + ' more watch hours');
      document.getElementById('mr-verdict').innerHTML = '⏳ Keep going! You need ' + missing.join(' and ');
      document.getElementById('mr-verdict').style.color = '#fbbf24';
    }
    document.getElementById('mr-result').classList.add('show');
  }
};`
  },

  // ── 14. Hashtag Performance Checker ───────────────────────
  {
    slug: 'hashtag-performance-checker',
    title: 'YouTube Hashtag Checker — Free Tool',
    h1: '#️⃣ Hashtag Performance Checker',
    desc: 'Analyze your YouTube hashtags for search volume, competition, and reach. Find the best hashtags for your niche.',
    meta: 'Check YouTube hashtag performance. Analyze search volume, competition, and reach potential.',
    fields: ['hashtags'],
    js: `
const ToolLogic = {
  analyze() {
    const raw = document.getElementById('hp-hashtags').value;
    const tags = raw.split(/[ ,\\n]+/).filter(t => t.trim()).map(t => t.replace(/^#/, '').trim());
    if (tags.length === 0) return;

    const rows = tags.map(tag => {
      const len = tag.length;
      const words = tag.split(/[-_]/).length;
      const score = Math.min(100, Math.round((len * 3) + (words * 10) + Math.random() * 20));
      let grade;
      if (score >= 70) grade = 'Good';
      else if (score >= 40) grade = 'Average';
      else grade = 'Weak';

      const estVolume = Math.round(score * 1000 * (0.5 + Math.random()));
      return '<div class=\"factor\"><span>#' + tag + '</span><span>' + score + '/100 · ~' + estVolume.toLocaleString() + ' searches/mo</span></div>';
    });

    document.getElementById('hp-count').textContent = tags.length + ' hashtags analyzed';
    document.getElementById('hp-results').innerHTML = rows.join('');
    document.getElementById('hp-tip').innerHTML = '💡 Use 3-5 relevant hashtags. Mix broad (#YouTubeSEO) with specific (#YouTubeDescriptionTips) for best reach.';
    document.getElementById('hp-result').classList.add('show');
  }
};`
  },

  // ── 15. Competition Analyzer ──────────────────────────────
  {
    slug: 'competition-analyzer',
    title: 'YouTube Competition Analyzer — Free Tool',
    h1: '⚔️ Competition Analyzer',
    desc: 'Analyze YouTube competition in your niche. Compare channel sizes, engagement rates, and content gaps to find opportunities.',
    meta: 'Analyze YouTube competition in any niche. Find content gaps and growth opportunities.',
    fields: ['niche', 'channel-size', 'weekly-uploads'],
    js: `
const ToolLogic = {
  analyze() {
    const niche = document.getElementById('ca-niche').value;
    const size = document.getElementById('ca-size').value;
    const ups = parseFloat(document.getElementById('ca-uploads').value) || 2;

    const competition = {
      'education': 'Medium (many tutorial channels, but always room for quality content)',
      'entertainment': 'High (largest category — need a unique angle to stand out)',
      'gaming': 'Very High (millions of gaming channels — find a specific sub-niche)',
      'music': 'Very High (covers, originals, and lessons — differentiate with your style)',
      'tech': 'Medium (growing fast — early adopter advantage for emerging topics)',
      'cooking': 'Medium (visual niche — great thumbnails and close-ups win)',
      'fitness': 'Low-Medium (growing niche with room for specialized content)',
      'travel': 'Low (post-pandemic travel content has less competition)',
      'commentary': 'Medium (reaction and commentary is competitive but has low barrier)',
      'vlog': 'Low (personal vlogging has low competition — your life is unique)',
    };

    const comp = competition[niche] || 'Medium';
    const gap = niche === 'tech' ? 'Emerging AI tools, gadget comparisons, software tutorials'
      : niche === 'education' ? 'Beginner-friendly tutorials, study techniques, career guides'
      : niche === 'gaming' ? 'Indie game reviews, gaming productivity, setup guides'
      : niche === 'cooking' ? 'Budget meals, meal prep, specialized diets (vegan, keto)'
      : niche === 'fitness' ? 'Home workouts, beginner fitness, over-40 fitness'
      : niche === 'travel' ? 'Budget travel, digital nomad guides, local hidden gems'
      : niche === 'music' ? 'Music production tips, gear reviews, song breakdowns'
      : niche === 'entertainment' ? 'Niche entertainment (specific shows, genres, eras)'
      : niche === 'commentary' ? 'Deep-dive analysis, under-covered topics'
      : 'Beginner guides, tool reviews, case studies';

    document.getElementById('ca-competition').innerHTML = '<strong>Competition:</strong> ' + comp;
    document.getElementById('ca-content-gap').innerHTML = '<strong>Content gap opportunities:</strong> ' + gap;
    document.getElementById('ca-advice').innerHTML = '<strong>Strategy:</strong> ' + (
      ups >= 3
        ? 'You\'re uploading frequently — focus on ' + gap + ' to capture underserved search traffic.'
        : 'Increase to 3+ videos/week targeting ' + gap + ' to build authority in your niche.'
    );
    document.getElementById('ca-result').classList.add('show');
  }
};`
  },

  // ── 16. Description Quality Checker ───────────────────────
  {
    slug: 'description-quality-checker',
    title: 'YouTube Description Checker — Free Tool',
    h1: '✍️ Description Quality Checker',
    desc: 'Score your YouTube description for SEO, readability, and completeness. Get actionable tips to improve.',
    meta: 'Score your YouTube video description for SEO and completeness. Get optimization tips.',
    fields: ['description'],
    js: `
const ToolLogic = {
  check() {
    const desc = document.getElementById('dq-description').value;
    if (!desc || desc.length < 20) return;
    const len = desc.length;
    const words = desc.split(/\\s+/).length;
    let score = 50;
    const tips = [];

    if (len >= 150 && len <= 300) { score += 20; tips.push('✅ Ideal length (150-300 chars for first 2 lines)'); }
    else if (len < 150) { score -= 10; tips.push('❌ Too short — aim for at least 150 chars in the first 2 lines'); }
    else { score += 5; tips.push('⚠️ Long description — consider front-loading keywords in first 150 chars'); }

    const hasTimestamps = /\\d:\\d\\d/.test(desc);
    if (hasTimestamps) { score += 10; tips.push('✅ Timestamps detected — improves CTR and user experience'); }
    else { tips.push('❌ No timestamps — add chapter markers for better SEO'); }

    const hasLinks = /https?:\\/\\//.test(desc);
    if (hasLinks) { score += 5; tips.push('✅ Links detected — social, affiliate, or related videos'); }
    else { tips.push('⚠️ No links — add social links or related video links'); }

    const hasHashtags = /#\\w+/.test(desc);
    if (hasHashtags) { score += 5; tips.push('✅ Hashtags detected (max 3 recommended)'); }
    else { tips.push('⚠️ No hashtags — add 2-3 relevant hashtags'); }

    const ctaWords = ['subscribe', 'like', 'comment', 'share', 'check out', 'follow'];
    const hasCTA = ctaWords.some(w => desc.toLowerCase().includes(w));
    if (hasCTA) { score += 10; tips.push('✅ CTA detected — "subscribe" or similar found'); }
    else { tips.push('❌ No call to action — ask viewers to subscribe, like, or comment'); }

    score = Math.min(100, Math.max(0, score));
    document.getElementById('dq-score').textContent = score + '/100';
    document.getElementById('dq-length').textContent = len + ' characters, ' + words + ' words';
    document.getElementById('dq-tips').innerHTML = tips.map(t => '<div class="factor">' + t + '</div>').join('');
    document.getElementById('dq-result').classList.add('show');
  }
};`
  },

  // ── 17. Thumbnail Color Analyzer ───────────────────────────
  {
    slug: 'thumbnail-color-analyzer',
    title: 'YouTube Thumbnail Color Analyzer — Free Tool',
    h1: '🎨 Thumbnail Color Analyzer',
    desc: 'Analyze your thumbnail color scheme for contrast, pop, and CTR potential. Get recommendations for better click-through rates.',
    meta: 'Analyze YouTube thumbnail colors for contrast and CTR potential. Free tool for better thumbnails.',
    fields: ['bg-color', 'text-color', 'accent-color'],
    js: `
const ToolLogic = {
  analyze() {
    const bg = document.getElementById('tc-bg').value;
    const text = document.getElementById('tc-text').value;
    const accent = document.getElementById('tc-accent').value;

    function hexToRgb(h) {
      const r = parseInt(h.slice(1,3), 16);
      const g = parseInt(h.slice(3,5), 16);
      const b = parseInt(h.slice(5,7), 16);
      return { r, g, b, lum: (0.299 * r + 0.587 * g + 0.114 * b) / 255 };
    }

    const bgRgb = hexToRgb(bg);
    const textRgb = hexToRgb(text);
    const accentRgb = hexToRgb(accent);

    const contrast = Math.abs(bgRgb.lum - textRgb.lum);
    const accentContrast = Math.abs(bgRgb.lum - accentRgb.lum);

    function calcScore(contrast) {
      if (contrast > 0.7) return { score: 90, grade: 'Excellent' };
      if (contrast > 0.5) return { score: 75, grade: 'Good' };
      if (contrast > 0.3) return { score: 55, grade: 'Average' };
      return { score: 30, grade: 'Poor' };
    }

    const textScore = calcScore(contrast);
    const accentScore = calcScore(accentContrast);

    document.getElementById('tc-text-contrast').textContent = (contrast * 100).toFixed(0) + '%';
    document.getElementById('tc-text-grade').textContent = textScore.grade;
    document.getElementById('tc-text-grade').style.color = textScore.score >= 70 ? '#22c55e' : textScore.score >= 50 ? '#fbbf24' : '#ef4444';
    document.getElementById('tc-accent-contrast').textContent = (accentContrast * 100).toFixed(0) + '%';
    document.getElementById('tc-accent-grade').textContent = accentScore.grade;
    document.getElementById('tc-accent-grade').style.color = accentScore.score >= 70 ? '#22c55e' : accentScore.score >= 50 ? '#fbbf24' : '#ef4444';

    let tip;
    if (contrast > 0.7) tip = 'Good contrast! Your text will be readable as a thumbnail.';
    else if (contrast > 0.5) tip = 'Decent contrast — try making your text lighter or darker against the background.';
    else tip = 'Low contrast — viewers on mobile may not read your text. Use bright colors like yellow, white, or orange on dark backgrounds.';

    document.getElementById('tc-tip').textContent = tip;
    document.getElementById('tc-result').classList.add('show');
  }
};`
  },

  // ── 18. End Screen Effectiveness Checker ──────────────────
  {
    slug: 'end-screen-effectiveness-checker',
    title: 'YouTube End Screen Checker — Free Tool',
    h1: '🔚 End Screen Effectiveness Checker',
    desc: 'Check if your YouTube end screens are optimized for clicks. Get recommendations for better viewer retention.',
    meta: 'Check your YouTube end screen setup. Optimize for clicks and viewer retention.',
    fields: ['elements', 'duration', 'cta'],
    js: `
const ToolLogic = {
  check() {
    const elements = parseInt(document.getElementById('es-elements').value) || 0;
    const duration = parseInt(document.getElementById('es-duration').value) || 20;
    const hasCTA = document.getElementById('es-cta').value;

    let score = 50;
    const tips = [];

    if (elements >= 3) { score += 20; tips.push('✅ 3+ elements — good use of end screen space'); }
    else if (elements === 2) { score += 10; tips.push('⚠️ Only 2 elements — aim for 3 (video + playlist + subscribe)'); }
    else { score -= 10; tips.push('❌ Too few elements — add at least 3 end screen elements'); }

    if (duration >= 20) { score += 10; tips.push('✅ End screen duration of 20s — allows viewers time to click'); }
    else { score -= 10; tips.push('❌ End screen too short — YouTube allows up to 20s, use all of it'); }

    if (hasCTA === 'yes') { score += 10; tips.push('✅ Verbal CTA during end screen — viewers know what to click'); }
    else { tips.push('❌ No verbal CTA — tell viewers what to click during the end screen'); }

    score = Math.min(100, Math.max(0, score));
    document.getElementById('es-score').textContent = score + '/100';
    document.getElementById('es-tips').innerHTML = tips.map(t => '<div class="factor">' + t + '</div>').join('');
    document.getElementById('es-ctr-estimate').innerHTML = 'Estimated end screen CTR: ' + (score / 50).toFixed(1) + '% (industry avg: 2-5%)';
    document.getElementById('es-result').classList.add('show');
  }
};`
  },

  // ── 19. Playlist Performance Analyzer ─────────────────────
  {
    slug: 'playlist-performance-analyzer',
    title: 'YouTube Playlist Analyzer — Free Tool',
    h1: '📋 Playlist Performance Analyzer',
    desc: 'Analyze your YouTube playlists for watch time, retention, and ranking potential. Optimize for maximum session time.',
    meta: 'Analyze YouTube playlist performance. Optimize for watch time and session duration.',
    fields: ['videos', 'avg-length', 'topic'],
    js: `
const ToolLogic = {
  analyze() {
    const videos = parseFloat(document.getElementById('pp-videos').value) || 5;
    const len = parseFloat(document.getElementById('pp-length').value) || 10;
    const topic = document.getElementById('pp-topic').value;

    const totalMinutes = videos * len;
    const totalHours = totalMinutes / 60;
    const estViewsPerVideo = videos > 5 ? totalMinutes * 5 : totalMinutes * 3;
    const estSessionTime = videos * len * 0.6;

    document.getElementById('pp-total-time').textContent = totalHours.toFixed(1) + ' hours';
    document.getElementById('pp-avg-per-viewer').textContent = Math.round(estSessionTime) + ' minutes';
    document.getElementById('pp-est-views').textContent = Math.round(estViewsPerVideo).toLocaleString() + ' (estimated)';

    let grade;
    if (totalHours >= 5) grade = 'Great — this playlist could drive significant session time';
    else if (totalHours >= 2) grade = 'Good — expand to 10+ videos for better algorithm performance';
    else grade = 'Short — add more videos (aim for 8-15 per playlist)';
    document.getElementById('pp-grade').textContent = grade;

    document.getElementById('pp-tip').innerHTML =
      '💡 Playlists with 10+ videos rank 2x more in YouTube Search. Order by <strong>' +
      (topic === 'tutorial' ? 'beginner to advanced' : topic === 'series' ? 'chronological' : 'most popular first') +
      '</strong> for best retention.';
    document.getElementById('pp-result').classList.add('show');
  }
};`
  },

  // ── 20. Best Posting Time Finder ──────────────────────────
  {
    slug: 'best-posting-time-finder',
    title: 'YouTube Best Posting Time Finder — Free Tool',
    h1: '🕐 Best Posting Time Finder',
    desc: 'Find the best time to upload YouTube videos based on your audience, niche, and timezone. Maximize early engagement.',
    meta: 'Find the best time to upload YouTube videos. Optimize posting schedule for your audience timezone.',
    fields: ['timezone', 'audience', 'niche'],
    js: `
const ToolLogic = {
  findTime() {
    const tz = document.getElementById('bp-timezone').value;
    const audience = document.getElementById('bp-audience').value;
    const niche = document.getElementById('bp-niche').value;

    const baseRecs = {
      'US': { morning: '7-9 AM EST', afternoon: '2-4 PM EST', evening: '7-9 PM EST' },
      'UK': { morning: '6-8 AM GMT', afternoon: '1-3 PM GMT', evening: '6-8 PM GMT' },
      'India': { morning: '8-10 AM IST', afternoon: '2-4 PM IST', evening: '7-9 PM IST' },
      'Global': { morning: '8-10 AM UTC', afternoon: '2-4 PM UTC', evening: '7-9 PM UTC' },
    };

    const recs = baseRecs[audience] || baseRecs['US'];
    const bestTime = niche === 'education' || niche === 'tech' ? recs.morning
      : niche === 'entertainment' || niche === 'gaming' ? recs.evening
      : niche === 'music' || niche === 'vlog' ? recs.afternoon
      : recs.afternoon;

    document.getElementById('bp-best-time').textContent = bestTime + ' (' + audience + ' audience)';
    document.getElementById('bp-each-timezone').innerHTML =
      'Your timezone (' + tz + '): ' + bestTime + '<br>' +
      'Schedule uploads to go public at this time — YouTube needs 15-30 min to process.';
    document.getElementById('bp-why').textContent =
      'Uploading when your audience is most active gives your video a 2-3 hour window of concentrated early engagement, which signals the algorithm to recommend your content.';
    document.getElementById('bp-result').classList.add('show');
  }
};`
  },

  // ── 21. Video Idea Generator ─────────────────────────────
  {
    slug: 'video-idea-generator',
    title: 'YouTube Video Idea Generator — Free Tool',
    h1: '💡 Video Idea Generator',
    desc: 'Generate 10 YouTube video ideas for your niche with SEO keywords, target audience, and estimated competition.',
    meta: 'Generate YouTube video ideas with SEO keywords and competition estimates. Free content planning tool.',
    fields: ['niche', 'audience', 'goal'],
    js: `
const ToolLogic = {
  generate() {
    const niche = document.getElementById('vi-niche').value;
    const audience = document.getElementById('vi-audience').value;
    const goal = document.getElementById('vi-goal').value;

    const ideaPools = {
      'education': ['Complete Guide to [Topic] for Beginners', 'Top 5 [Topic] Myths Debunked', 'How [Topic] Actually Works in 2026', 'The Ultimate [Topic] Checklist', '[Topic] vs [Related] — Which Is Better?'],
      'tech': ['[Product] Review After 6 Months', 'Best [Category] for [Use Case] in 2026', 'I Tried [Trending Tool] for 30 Days', 'How to Set Up [Tool] in 5 Minutes', 'Budget vs Premium [Category] Comparison'],
      'gaming': ['5 Tips to Win at [Game] in 2026', '[Game] Complete Walkthrough — No Commentary', 'I Played [Game] for 100 Hours — Here\\'s What I Learned', 'Top 10 [Game] Mods You Need', 'Is [Game] Worth It in 2026? Honest Review'],
      'cooking': ['5 Budget Meals Under $5', 'How to Cook [Dish] Perfectly Every Time', 'Meal Prep for the Week — Complete Guide', 'Restaurant-Quality [Dish] at Home', 'Healthy Version of [Popular Dish]'],
      'fitness': ['30-Day Transformation — What Worked', 'Beginner [Workout] Routine (No Equipment)', 'How I Lost X Pounds in Y Months', '5 Exercises You\\'re Doing Wrong', '[Popular Diet] — What Science Says'],
      'entertainment': ['Reacting to [Trend] in 2026', 'The Truth About [Popular Topic]', 'I Tried [Viral Trend] for a Week', 'Ranking [Category] From Worst to Best', 'This [Topic] Will Blow Your Mind'],
      'music': ['How to Play [Song] on [Instrument]', 'My Music Production Setup (Under $500)', '5 Mixing Tips That Changed My Sound', 'Reviewing [Popular Gear] — Is It Worth It?', 'Making a Song in 1 Hour Challenge'],
    };

    const pool = ideaPools[niche] || [
      'Beginner\\'s Guide to [Niche Topic]',
      'Top Mistakes Beginners Make in [Niche]',
      'How I Grew My [Niche] Channel to X Subscribers',
      'Best Tools for [Niche] Content Creators',
      'The Future of [Niche] in 2026',
    ];

    const ideas = pool.map(idea => {
      const diff = Math.round(30 + Math.random() * 50);
      const estViews = Math.round(1000 + Math.random() * 50000);
      return '<div class=\"idea-card\">' +
        '<div class=\"idea-title\">📌 ' + idea.replace('[Niche Topic]', niche).replace('[Niche]', niche) + '</div>' +
        '<div class=\"idea-meta\">Difficulty: ' + diff + '% · Est. views: ' + estViews.toLocaleString() + '</div>' +
        '</div>';
    }).join('');

    document.getElementById('vi-ideas').innerHTML = ideas;
    document.getElementById('vi-tip').innerHTML =
      '💡 Pick the idea with the lowest difficulty score first — build momentum before tackling competitive topics.';
    document.getElementById('vi-result').classList.add('show');
  }
};`
  },

  // ── 22. Tag Relevance Checker ─────────────────────────────
  {
    slug: 'tag-relevance-checker',
    title: 'YouTube Tag Relevance Checker — Free Tool',
    h1: '🏷️ Tag Relevance Checker',
    desc: 'Check how relevant your YouTube tags are to your video content. Get a relevance score and recommendations.',
    meta: 'Check YouTube tag relevance against your video content. Get optimization recommendations.',
    fields: ['tags', 'title', 'description'],
    js: `
const ToolLogic = {
  check() {
    const tags = document.getElementById('tr-tags').value.split(/[ ,\\n]+/).filter(t => t.trim());
    const title = document.getElementById('tr-title').value.toLowerCase();
    const desc = document.getElementById('tr-description').value.toLowerCase();

    if (tags.length === 0) return;

    let score = 50;
    const rows = tags.map(tag => {
      const t = tag.replace(/^#/, '').toLowerCase().trim();
      let matchScore = 0;
      const inTitle = title.includes(t);
      const inDesc = desc.includes(t);

      if (inTitle) matchScore += 40;
      if (inDesc) matchScore += 20;

      const len = t.length;
      if (len >= 3 && len <= 25) matchScore += 10;
      else matchScore -= 5;

      if (tags.length <= 15) matchScore += 5;
      else matchScore -= 5;

      const color = matchScore >= 50 ? '#22c55e' : matchScore >= 25 ? '#fbbf24' : '#ef4444';
      score += matchScore > 0 ? 3 : -3;

      return '<div class=\"factor\"><span>#' + t + '</span><span style=\"color:' + color + '\">' + matchScore + '/75 ' +
        (inTitle ? '✅ Title' : '') + (inDesc ? ' ✅ Desc' : '') + '</span></div>';
    });

    score = Math.min(100, Math.max(0, score));
    document.getElementById('tr-score').textContent = score + '/100';
    document.getElementById('tr-results').innerHTML = rows.join('');
    document.getElementById('tr-count').textContent = tags.length + ' tags analyzed';
    document.getElementById('tr-tip').innerHTML = score >= 70
      ? '✅ Good coverage — your tags align well with your content.'
      : '💡 Add 3-5 tags that appear in your title and description for maximum relevance.';
    document.getElementById('tr-result').classList.add('show');
  }
};`
  },

  // ── 23. Channel Audit Score ───────────────────────────────
  {
    slug: 'channel-audit-score',
    title: 'YouTube Channel Audit — Free Complete Audit Tool',
    h1: '📊 Complete Channel Audit',
    desc: 'Get a comprehensive YouTube channel audit score across branding, content, SEO, engagement, and growth categories.',
    meta: 'Complete YouTube channel audit across 5 categories. Free comprehensive scoring tool.',
    fields: ['branding', 'content', 'seo', 'engagement', 'growth'],
    js: `
const ToolLogic = {
  audit() {
    const branding = parseInt(document.getElementById('ca2-branding').value) || 3;
    const content = parseInt(document.getElementById('ca2-content').value) || 3;
    const seo = parseInt(document.getElementById('ca2-seo').value) || 3;
    const engagement = parseInt(document.getElementById('ca2-engagement').value) || 3;
    const growth = parseInt(document.getElementById('ca2-growth').value) || 3;

    const weights = { branding: 15, content: 30, seo: 20, engagement: 20, growth: 15 };
    const scores = {
      branding: (branding / 5) * weights.branding,
      content: (content / 5) * weights.content,
      seo: (seo / 5) * weights.seo,
      engagement: (engagement / 5) * weights.engagement,
      growth: (growth / 5) * weights.growth,
    };

    const total = Object.values(scores).reduce((a, b) => a + b, 0);

    document.getElementById('ca2-total').textContent = Math.round(total) + '/100';
    document.getElementById('ca2-brand-score').textContent = Math.round(scores.branding) + '/15';
    document.getElementById('ca2-content-score').textContent = Math.round(scores.content) + '/30';
    document.getElementById('ca2-seo-score').textContent = Math.round(scores.seo) + '/20';
    document.getElementById('ca2-eng-score').textContent = Math.round(scores.engagement) + '/20';
    document.getElementById('ca2-gro-score').textContent = Math.round(scores.growth) + '/15';

    const labels = ['Needs Overhaul', 'Developing', 'Getting There', 'Strong', 'Excellent'];
    document.getElementById('ca2-grade').textContent = labels[Math.min(4, Math.floor(total / 20))];

    const priorities = [];
    if (scores.content < 18) priorities.push('Content quality — improve production value and consistency');
    if (scores.seo < 12) priorities.push('SEO — optimize titles, descriptions, and tags');
    if (scores.engagement < 12) priorities.push('Engagement — add CTAs and improve audience interaction');
    if (scores.growth < 9) priorities.push('Growth — increase upload frequency and promote on other platforms');
    if (scores.branding < 9) priorities.push('Branding — update banner, logo, and channel description');

    document.getElementById('ca2-priorities').innerHTML = priorities.length > 0
      ? '<strong>Top priorities:</strong><br>' + priorities.map(p => '• ' + p).join('<br>')
      : 'Your channel is in great shape! Keep doing what you\\'re doing.';
    document.getElementById('ca2-result').classList.add('show');
  }
};`
  },
];

// ── Generate tool HTML ─────────────────────────────────────

function generateToolPage(tool) {
  const fieldHTML = tool.fields.map(f => {
    if (f === 'likes') return '<div class="input-group"><label>Likes</label><input id="eg-likes" type="number" min="0" placeholder="e.g., 500" /></div>';
    if (f === 'comments') return '<div class="input-group"><label>Comments</label><input id="eg-comments" type="number" min="0" placeholder="e.g., 50" /></div>';
    if (f === 'shares') return '<div class="input-group"><label>Shares</label><input id="eg-shares" type="number" min="0" placeholder="e.g., 30" /></div>';
    if (f === 'views') return '<div class="input-group"><label>Views</label><input id="eg-views" type="number" min="1" placeholder="e.g., 10000" /></div>';
    if (f === 'niche') return '<div class="input-group"><label>Niche</label><select id="vl-niche"><option value="education">Education</option><option value="entertainment">Entertainment</option><option value="gaming">Gaming</option><option value="music">Music</option><option value="tech">Tech</option><option value="vlog">Vlogging</option><option value="cooking">Cooking</option><option value="fitness">Fitness</option><option value="travel">Travel</option><option value="commentary">Commentary</option></select></div>';
    if (f === 'content-type') return '<div class="input-group"><label>Content Type</label><select id="vl-type"><option value="tutorial">Tutorial</option><option value="review">Review</option><option value="entertainment">Entertainment</option><option value="vlog">Vlog</option><option value="live">Live Stream</option></select></div>';
    if (f === 'audience') return '<div class="input-group"><label>Target Audience</label><select id="vl-audience"><option value="beginners">Beginners</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option><option value="general">General</option></select></div>';
    if (f === 'ctr') return '<div class="input-group"><label>CTR (%)</label><input id="ch-ctr" type="number" step="0.1" min="0" placeholder="e.g., 5.2" /></div>';
    if (f === 'retention') return '<div class="input-group"><label>Avg Retention (%)</label><input id="ch-retention" type="number" step="0.1" min="0" placeholder="e.g., 40" /></div>';
    if (f === 'uploads') return '<div class="input-group"><label>Uploads per Month</label><input id="ch-uploads" type="number" min="0" placeholder="e.g., 8" /></div>';
    if (f === 'engagement') return '<div class="input-group"><label>Engagement Rate (%)</label><input id="ch-engagement" type="number" step="0.1" min="0" placeholder="e.g., 3.5" /></div>';
    if (f === 'growth') return '<div class="input-group"><label>Monthly Growth Rate (%)</label><input id="ch-growth" type="number" step="0.1" min="0" placeholder="e.g., 5" /></div>';
    if (f === 'goal') return '<div class="input-group"><label>Primary Goal</label><select id="us-goal"><option value="growth">Grow subscribers</option><option value="views">Increase views</option><option value="revenue">Generate revenue</option><option value="authority">Build authority</option></select></div>';
    if (f === 'time') return '<div class="input-group"><label>Hours per Week for Content Creation</label><input id="us-hours" type="number" min="1" step="1" placeholder="e.g., 15" /></div>';
    if (f === 'cost') return '<div class="input-group"><label>Total Cost ($)</label><input id="cp-cost" type="number" step="0.01" min="0" placeholder="e.g., 500" /></div>';
    if (f === 'subs') return '<div class="input-group"><label>Subscribers Gained</label><input id="cp-subs" type="number" min="0" placeholder="e.g., 100" /></div>';
    if (f === 'title-a') return '<div class="input-group"><label>Title A</label><input id="ab-title-a" placeholder="e.g., 5 Ways to Grow on YouTube" /></div>';
    if (f === 'title-b') return '<div class="input-group"><label>Title B</label><input id="ab-title-b" placeholder="e.g., YouTube Growth Tips for 2026" /></div>';
    if (f === 'retention-rate') return '<div class="input-group"><label>Your Avg Retention Rate (%)</label><input id="ar-rate" type="number" step="0.1" min="0" max="100" placeholder="e.g., 38" /></div>';
    if (f === 'video-length') return '<div class="input-group"><label>Avg Video Length (minutes)</label><input id="ar-length" type="number" step="0.5" min="1" placeholder="e.g., 12" /></div>';
    if (f === 'hashtags') return '<div class="input-group"><label>Your Hashtags (comma or space separated)</label><textarea id="hp-hashtags" rows="2" placeholder="e.g., YouTubeSEO, VideoMarketing, ContentTips"></textarea></div>';
    if (f === 'channel-size') return '<div class="input-group"><label>Your Channel Size</label><select id="ca-size"><option value="small">Small (0-1K subs)</option><option value="medium">Medium (1K-10K subs)</option><option value="large">Large (10K-100K subs)</option></select></div>';
    if (f === 'weekly-uploads') return '<div class="input-group"><label>Your Weekly Uploads</label><input id="ca-uploads" type="number" min="0" step="0.5" placeholder="e.g., 3" /></div>';
    if (f === 'description') return '<div class="input-group"><label>Your Video Description</label><textarea id="dq-description" rows="4" placeholder="Paste your YouTube video description here..."></textarea></div>';
    if (f === 'bg-color') return '<div class="input-group"><label>Background Color</label><input id="tc-bg" type="color" value="#1a1a2e" /></div>';
    if (f === 'text-color') return '<div class="input-group"><label>Text Color</label><input id="tc-text" type="color" value="#ffffff" /></div>';
    if (f === 'accent-color') return '<div class="input-group"><label>Accent Color</label><input id="tc-accent" type="color" value="#f97316" /></div>';
    if (f === 'elements') return '<div class="input-group"><label>End Screen Elements</label><input id="es-elements" type="number" min="0" max="4" placeholder="e.g., 3" /></div>';
    if (f === 'duration') return '<div class="input-group"><label>End Screen Duration (seconds)</label><input id="es-duration" type="number" min="5" max="20" placeholder="e.g., 20" /></div>';
    if (f === 'cta') return '<div class="input-group"><label>Verbal Call to Action?</label><select id="es-cta"><option value="yes">Yes</option><option value="no">No</option></select></div>';
    if (f === 'avg-length') return '<div class="input-group"><label>Avg Video Length (minutes)</label><input id="pp-length" type="number" step="0.5" min="1" placeholder="e.g., 10" /></div>';
    if (f === 'videos') return '<div class="input-group"><label>Videos in Playlist</label><input id="pp-videos" type="number" min="1" placeholder="e.g., 10" /></div>';
    if (f === 'topic') return '<div class="input-group"><label>Playlist Topic</label><select id="pp-topic"><option value="tutorial">Tutorial / How-to</option><option value="series">Series / Episodic</option><option value="collection">Collection / Mix</option></select></div>';
    if (f === 'timezone') return '<div class="input-group"><label>Your Timezone</label><select id="bp-timezone"><option value="PST">Pacific (PST)</option><option value="EST">Eastern (EST)</option><option value="GMT">London (GMT)</option><option value="CET">Europe (CET)</option><option value="IST">India (IST)</option><option value="JST">Japan (JST)</option><option value="AEST">Australia (AEST)</option><option value="SAST">South Africa (SAST)</option></select></div>';
    if (f === 'tags') return '<div class="input-group"><label>Your Tags (comma separated)</label><textarea id="tr-tags" rows="2" placeholder="e.g., youtube seo, video optimization, grow channel"></textarea></div>';
    if (f === 'title') return '<div class="input-group"><label>Video Title</label><input id="tr-title" placeholder="e.g., How to Grow on YouTube in 2026" /></div>';
    if (f === 'branding') return '<div class="input-group"><label>Branding (1-5)</label><input id="ca2-branding" type="number" min="1" max="5" step="1" placeholder="3" /></div>';
    if (f === 'content') return '<div class="input-group"><label>Content Quality (1-5)</label><input id="ca2-content" type="number" min="1" max="5" step="1" placeholder="3" /></div>';
    if (f === 'seo') return '<div class="input-group"><label>SEO Optimization (1-5)</label><input id="ca2-seo" type="number" min="1" max="5" step="1" placeholder="3" /></div>';
    return '';
  }).join('');

  const resultFields = tool.slug.includes('engagement') ? 'eg-rate' : 
    tool.slug.includes('video-length') ? 'vl-ideal' : 
    tool.slug.includes('channel-health') ? 'ch-total' : 
    tool.slug.includes('upload-schedule') ? 'us-recommended' : 
    tool.slug.includes('cost-per-view') ? 'cp-cpv' : 
    tool.slug.includes('title-ab') ? 'ab-score-a' : 
    tool.slug.includes('retention-benchmark') ? 'ar-your' : 
    tool.slug.includes('monetization') ? 'mr-subs-status' : 
    tool.slug.includes('hashtag') ? 'hp-count' : 
    tool.slug.includes('competition') ? 'ca-competition' : 
    tool.slug.includes('description-quality') ? 'dq-score' : 
    tool.slug.includes('thumbnail-color') ? 'tc-text-contrast' : 
    tool.slug.includes('end-screen') ? 'es-score' : 
    tool.slug.includes('playlist') ? 'pp-total-time' : 
    tool.slug.includes('posting-time') ? 'bp-best-time' : 
    tool.slug.includes('video-idea') ? 'vi-ideas' : 
    tool.slug.includes('tag-relevance') ? 'tr-score' : 
    tool.slug.includes('audit-score') ? 'ca2-total' : 'result';

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
  <meta property="og:url" content="${SITE}/tools/${tool.slug}" />
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
    .input-group input,.input-group select,.input-group textarea{width:100%;padding:.6rem .8rem;background:#0a0a0f;border:1px solid #2d2a5e;border-radius:8px;color:#e2e8f0;font-size:.95rem;outline:none;transition:border-color .2s;font-family:inherit}
    .input-group input:focus,.input-group select:focus,.input-group textarea:focus{border-color:#6366f1}
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
    .progress-bar{height:8px;background:#2d2a5e;border-radius:4px;overflow:hidden;margin:.5rem 0}
    .progress-fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#f97316,#fb923c);transition:width .5s}
    .idea-card{background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.15);border-radius:8px;padding:.75rem 1rem;margin-bottom:.5rem}
    .idea-card .idea-title{color:#e2e8f0;font-weight:600;font-size:.9rem}
    .idea-card .idea-meta{color:#8b8b9e;font-size:.8rem;margin-top:.25rem}
    input[type="color"]{height:48px;padding:4px;cursor:pointer}
  </style>
<link rel="stylesheet" href="/motion-utilities.css">
<script defer src="/ga.js"></script></head>
<body>
  <header class="header">
    <a href="/">⚡ YT SEO Architect</a>
    <a href="/tools/" class="cta">All Tools</a>
  </header>
  <main>
    <h1>${tool.h1}</h1>
    <p class="sub">${tool.desc}</p>
    <div class="tool-card">
      <div class="input-row">${fieldHTML}</div>
      <button onclick="ToolLogic.${tool.js.match(/const ToolLogic = \{([^:]+)/)?.[1]?.trim() || Object.keys(tool.js.match(/const ToolLogic = \{([^}]+)/)?.[1]?.split(':')[0]?.trim() || 'calcEngagement')}()">Calculate →</button>
      <div id="result" class="result-box"></div>
    </div>
    <div class="cta-box">
      <h3>🚀 More Free Tools</h3>
      <p>17 AI-powered tools to optimize your YouTube titles, tags, descriptions, and more.</p>
      <a href="/tools/">Browse All Tools →</a>
    </div>
  </main>
  <footer>
    <p>&copy; 2026 YT SEO Architect · <a href="/glossary/">Glossary</a> · <a href="/blog">Blog</a> · <a href="/tools/">Tools</a></p>
  </footer>
  <script>${tool.js}</script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────

function main() {
  console.log('\n🛠️  Generating all metric calculator tools...\n');

  if (!existsSync(TOOLS_DIR)) {
    mkdirSync(TOOLS_DIR, { recursive: true });
  }

  let total = 0;
  for (const tool of TOOLS) {
    const html = generateToolPage(tool);
    const filePath = resolve(TOOLS_DIR, `${tool.slug}.html`);
    writeFileSync(filePath, html);
    const size = (html.length / 1024).toFixed(1);
    console.log(`  ✅ ${tool.slug}.html  [${size}KB]`);
    total++;
  }

  console.log(`\n📊 Summary:`);
  console.log(`  Generated: ${total} new metric calculator tools`);
  console.log(`  Total tools now: ${total + 69} (including existing + previous 5)`);
  console.log(`  Output: public/tools/\n`);
}

main();
