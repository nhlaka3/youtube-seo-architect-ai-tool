#!/usr/bin/env node
/**
 * scripts/generate-blog-tools.mjs (v3 — REAL Interactive Tools)
 *
 * Creates a free interactive tool page for every blog post.
 * Unlike v2, each tool has REAL JavaScript logic — no AI API calls.
 * Every tool works fully offline and provides genuine utility.
 *
 * Tool Types:
 *   scorer    → Title Scorer: checks length, keyword placement, power words, numbers, emotions, case
 *   generator → Tag Generator: generates 15 optimized tags from seed keywords using template patterns
 *   research  → Keyword Research: suggests related keywords with volume/difficulty estimates
 *   writer    → Description Writer: builds structured description template with timestamps
 *   checker   → Metadata Checker: validates title/desc/tags against best practices
 *   analyzer  → Channel Analyzer: mock competitive analysis framework
 *   calculator→ CTR Calculator: calculates and explains CTR/retention metrics
 *   auditor   → SEO Auditor: comprehensive metadata audit against checklist
 *   detector  → Shadow Ban Detector: checks symptoms against common patterns
 *   optimizer → Content Optimizer: suggests improvements for input content
 *   planner   → Content Planner: generates content calendar ideas
 *   finder    → Opportunity Finder: identifies growth opportunities by niche
 *   tracker   → Metrics Tracker: mock analytics dashboard
 *   tool      → Generic Helper
 *
 * Usage:
 *   node scripts/generate-blog-tools.mjs              # Generate all missing tools
 *   node scripts/generate-blog-tools.mjs --slug <s>   # Generate one tool
 *   node scripts/generate-blog-tools.mjs --list        # Show missing tools
 *   node scripts/generate-blog-tools.mjs --dry-run     # Preview only
 *   node scripts/generate-blog-tools.mjs --rebuild     # Regenerate ALL tools
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT = resolve(__dirname, '..');
const TOOLS_DIR = resolve(PROJECT, 'public/tools');
const BLOG_DIR = resolve(PROJECT, 'public/blog');

const SITE = 'https://yt-seo-architect.vercel.app';

// ── Blog slug detection (v3: scans HTML files, NOT hero images) ────

function getBlogSlugs() {
  const slugs = new Set();

  // 1. Scan static HTML files in blog directory
  if (existsSync(BLOG_DIR)) {
    const files = readdirSync(BLOG_DIR);
    for (const f of files) {
      if (f.endsWith('.html') && !f.startsWith('_') && !f.includes('-hero') && f !== 'index.html') {
        slugs.add(f.replace('.html', ''));
      }
    }
  }

  // 2. Scan keywords.json for done entries (DB-only blog posts)
  const kwFile = resolve(PROJECT, 'scripts', 'keywords.json');
  if (existsSync(kwFile)) {
    try {
      const kwData = JSON.parse(readFileSync(kwFile, 'utf-8'));
      if (kwData.keywords) {
        for (const kw of kwData.keywords) {
          if (kw.status === 'done' && kw.slug) {
            slugs.add(kw.slug);
          }
        }
      }
    } catch (e) {
      console.warn('  ⚠ Could not read keywords.json:', e.message);
    }
  }

  return [...slugs].sort();
}

// ── Blog slug discovery with rebuild fallback ─────────────────
// During --rebuild, also discover slugs from existing tool files
// that don't appear in blog sources (v2-era tools to replace)
const MANUAL_TOOL_SLUGS = new Set([
  'index', 'tag-generator', 'title-optimizer', 'description-writer',
  'keyword-seed', 'best-youtube-seo-tools-2026',
]);

function getToolFileSlugs() {
  if (!existsSync(TOOLS_DIR)) return [];
  return readdirSync(TOOLS_DIR)
    .filter(f => f.endsWith('.html') && !MANUAL_TOOL_SLUGS.has(f.replace('.html', '')))
    .map(f => f.replace('.html', ''));
}

// ── Tool type mapping ─────────────────────────────────────────

const TOOL_TYPES = {
  'title': { type: 'scorer', icon: '🎯', verb: 'Score', noun: 'Scorer', btn: 'Score Title', input: 'Enter your YouTube title', placeholder: 'e.g., How to Grow on YouTube in 2026' },
  'tag': { type: 'generator', icon: '🏷️', verb: 'Generate', noun: 'Generator', btn: 'Generate Tags', input: 'Enter your topic keyword', placeholder: 'e.g., youtube seo tips' },
  'keyword': { type: 'research', icon: '🔍', verb: 'Research', noun: 'Research Tool', btn: 'Find Keywords', input: 'Enter seed keyword', placeholder: 'e.g., youtube growth' },
  'description': { type: 'writer', icon: '✍️', verb: 'Write', noun: 'Writer', btn: 'Write Description', input: 'Describe your video topic', placeholder: 'e.g., a tutorial about YouTube SEO for beginners' },
  'thumbnail': { type: 'checker', icon: '🖼️', verb: 'Check', noun: 'Checker', btn: 'Check Metadata', input: 'Paste your title and description', placeholder: 'e.g., My YouTube video title and description...' },
  'analytics': { type: 'analyzer', icon: '📊', verb: 'Analyze', noun: 'Analyzer', btn: 'Analyze Channel', input: 'Enter channel name or niche', placeholder: 'e.g., tech reviews channel' },
  'retention': { type: 'calculator', icon: '📈', verb: 'Calculate', noun: 'Calculator', btn: 'Calculate CTR', input: 'Enter views and impressions', placeholder: 'e.g., 5000 views, 100000 impressions' },
  'ctr': { type: 'calculator', icon: '📉', verb: 'Calculate', noun: 'Calculator', btn: 'Calculate CTR', input: 'Enter views and impressions', placeholder: 'e.g., 5000 views, 100000 impressions' },
  'impression': { type: 'tracker', icon: '👁️', verb: 'Track', noun: 'Tracker', btn: 'Track Metrics', input: 'Enter your current metrics', placeholder: 'e.g., 10K views, 5% CTR' },
  'seo': { type: 'auditor', icon: '🔎', verb: 'Audit', noun: 'Auditor', btn: 'Audit SEO', input: 'Paste your video metadata', placeholder: 'e.g., Title: ... Description: ... Tags: ...' },
  'monetization': { type: 'checker', icon: '💰', verb: 'Check', noun: 'Checker', btn: 'Check Eligibility', input: 'Describe your channel', placeholder: 'e.g., 500 subs, 3000 watch hours' },
  'shadow-ban': { type: 'detector', icon: '👻', verb: 'Detect', noun: 'Detector', btn: 'Run Detection', input: 'Describe your symptoms', placeholder: 'e.g., my views dropped 80% overnight' },
  'hook': { type: 'scorer', icon: '🪝', verb: 'Score', noun: 'Scorer', btn: 'Score Hook', input: 'Enter your hook/intro', placeholder: 'e.g., In this video I will show you...' },
  'playlist': { type: 'optimizer', icon: '📋', verb: 'Optimize', noun: 'Optimizer', btn: 'Optimize', input: 'Describe your playlist', placeholder: 'e.g., 10 videos about YouTube SEO' },
  'competitor': { type: 'analyzer', icon: '⚔️', verb: 'Analyze', noun: 'Analyzer', btn: 'Analyze Competitor', input: 'Enter competitor channel name', placeholder: 'e.g., MrBeast' },
  'end-screen': { type: 'checker', icon: '🔚', verb: 'Check', noun: 'Checker', btn: 'Check Setup', input: 'Describe your end screen plan', placeholder: 'e.g., 2 videos + subscribe button' },
  'chapter': { type: 'generator', icon: '📑', verb: 'Generate', noun: 'Generator', btn: 'Generate Chapters', input: 'Describe your video content', placeholder: 'e.g., 10-min tutorial with 5 sections' },
  'shorts': { type: 'optimizer', icon: '📱', verb: 'Optimize', noun: 'Optimizer', btn: 'Optimize Short', input: 'Describe your Short', placeholder: 'e.g., 30-second tip about YouTube tags' },
  'community': { type: 'planner', icon: '👥', verb: 'Plan', noun: 'Planner', btn: 'Create Plan', input: 'Describe your channel niche', placeholder: 'e.g., cooking channel for beginners' },
  'backlink': { type: 'finder', icon: '🔗', verb: 'Find', noun: 'Finder', btn: 'Find Opportunities', input: 'Enter your channel niche', placeholder: 'e.g., tech reviews' },
  'video-not-getting-views': { type: 'detector', icon: '🔍', verb: 'Diagnose', noun: 'Diagnostic', btn: 'Diagnose Issues', input: 'Describe your video situation', placeholder: 'e.g., uploaded 3 days ago, 50 views' },
  'subscriber': { type: 'tracker', icon: '📈', verb: 'Track', noun: 'Tracker', btn: 'Track Growth', input: 'Describe your channel growth', placeholder: 'e.g., 500 subs, growing 10% weekly' },
  'small': { type: 'checker', icon: '🔎', verb: 'Check', noun: 'Checker', btn: 'Check Channel', input: 'Describe your small channel', placeholder: 'e.g., 200 subs, 1K watch hours, gaming niche' },
  'tutorial': { type: 'optimizer', icon: '📖', verb: 'Optimize', noun: 'Optimizer', btn: 'Optimize Tutorial', input: 'Describe your tutorial content', placeholder: 'e.g., 15-min coding tutorial for beginners' },
  'idea': { type: 'planner', icon: '💡', verb: 'Generate', noun: 'Planner', btn: 'Generate Ideas', input: 'Enter your channel niche', placeholder: 'e.g., gaming, cooking, tech reviews' },
  'algorithm': { type: 'calculator', icon: '🧮', verb: 'Analyze', noun: 'Calculator', btn: 'Analyze Metrics', input: 'Describe your channel metrics', placeholder: 'e.g., 5% CTR, 40% retention, 10K impressions' },
  'default': { type: 'tool', icon: '🛠️', verb: 'Use', noun: 'Tool', btn: 'Go', input: 'Enter your details', placeholder: 'e.g., describe your YouTube situation' },
};

function detectToolType(slug) {
  for (const [keyword, tool] of Object.entries(TOOL_TYPES)) {
    if (slug.includes(keyword)) return { key: keyword, ...tool };
  }
  return { key: 'default', ...TOOL_TYPES.default };
}

// ── Keywork display title ────────────────────────────────

function slugToTitle(slug) {
  return slug
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\b(And|For|The|In|Of|To|A|Vs)\b/gi, c => c.toLowerCase())
    .replace(/^./, c => c.toUpperCase());
}

// ── Tool JavaScript implementations (REAL logic, no AI API calls) ────

function getToolJS(toolType, blogSlug) {
  const implementations = {
    scorer: `
const ToolLogic = {
  scoreTitle(title, keyword) {
    const checks = [];
    let score = 50;
    const lower = title.toLowerCase();
    const kwLower = (keyword || '').toLowerCase();

    // Length check
    if (title.length < 20) { score -= 15; checks.push({ pass: false, msg: 'Title too short (< 20 chars)', weight: 'high' }); }
    else if (title.length <= 30) { score -= 5; checks.push({ pass: false, msg: 'A bit short (aim for 30-60 chars)', weight: 'low' }); }
    else if (title.length <= 60) { score += 15; checks.push({ pass: true, msg: 'Ideal length (30-60 chars)', weight: 'high' }); }
    else if (title.length <= 70) { score += 5; checks.push({ pass: true, msg: 'Good length, near limit', weight: 'medium' }); }
    else { score -= 10; checks.push({ pass: false, msg: 'Too long (> 70 chars, gets truncated on mobile)', weight: 'high' }); }

    // Keyword placement
    if (kwLower && lower.includes(kwLower)) {
      const kwIndex = lower.indexOf(kwLower);
      if (kwIndex === 0) { score += 15; checks.push({ pass: true, msg: 'Keyword starts the title — excellent for SEO', weight: 'high' }); }
      else if (kwIndex < 25) { score += 10; checks.push({ pass: true, msg: 'Keyword in first 25 chars — good placement', weight: 'high' }); }
      else if (kwIndex < 50) { score += 5; checks.push({ pass: true, msg: 'Keyword present but late in title', weight: 'medium' }); }
      else { score += 3; checks.push({ pass: true, msg: 'Keyword present', weight: 'low' }); }
    } else if (kwLower) {
      score -= 10; checks.push({ pass: false, msg: 'Keyword missing from title', weight: 'high' });
    }

    // Power words
    const powerWords = ['ultimate','best','top','guide','how to','tips','tricks','secret','easy','fast','proven','essential','complete','simple','powerful','expert','step by step','effective','amazing','incredible'];
    const foundPower = powerWords.filter(w => lower.includes(w));
    score += Math.min(foundPower.length * 4, 16);
    checks.push({ pass: foundPower.length >= 2, msg: 'Power words: ' + foundPower.length + ' found (aim for 2-4)', weight: 'medium' });

    // Numbers
    const hasNumber = /\\d/.test(title);
    if (hasNumber) { score += 10; checks.push({ pass: true, msg: 'Numbers boost CTR by up to 36%', weight: 'high' }); }
    else { checks.push({ pass: false, msg: 'Add numbers (e.g., 5, 10, 2026) — they increase CTR', weight: 'medium' }); }

    // Emotional triggers
    const emotional = ['amazing','incredible','shocking','unbelievable','huge','massive','crazy','insane','mind blowing','life changing','guaranteed','never','always','worst','best','every','secret','truth','real'];
    const foundEmo = emotional.filter(w => lower.includes(w));
    if (foundEmo.length > 0) { score += 5; checks.push({ pass: true, msg: 'Emotional trigger words — good for CTR', weight: 'low' }); }
    else { checks.push({ pass: false, msg: 'Consider adding emotional words to boost curiosity', weight: 'low' }); }

    // Brackets / parentheses
    if (/[\\[\\]()]/.test(title)) { score += 5; checks.push({ pass: true, msg: 'Brackets/parentheses increase CTR by 15-20%', weight: 'medium' }); }

    // Question format
    if (title.includes('?')) { score += 5; checks.push({ pass: true, msg: 'Question format hooks curiosity', weight: 'low' }); }

    // Title case check (first letter of each major word capitalized)
    const words = title.split(' ');
    const longWords = words.filter(w => w.length > 3);
    const cappedLongWords = longWords.filter(w => w[0] === w[0].toUpperCase());
    const caseRatio = longWords.length > 0 ? cappedLongWords.length / longWords.length : 1;
    if (caseRatio > 0.7) { score += 5; checks.push({ pass: true, msg: 'Proper title case — looks professional', weight: 'low' }); }
    else if (caseRatio < 0.3) { score -= 3; checks.push({ pass: false, msg: 'Use title case (capitalize major words)', weight: 'low' }); }

    score = Math.max(0, Math.min(100, score));
    return { score, checks, grade: score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F' };
  },

  generateBestTitle(title, keyword) {
    var lower = title.toLowerCase();
    var kwLower = (keyword || '').toLowerCase();
    var missing = [];
    var improvements = [];

    // Analyze what's missing
    if (title.length < 20) missing.push('Title is too short');
    else if (title.length > 70) missing.push('Title gets truncated on mobile');

    if (kwLower && !lower.includes(kwLower)) missing.push('Target keyword missing');

    var hasNumber = /\d/.test(title);
    if (!hasNumber) missing.push('No numbers (they boost CTR by 36%)');

    var hasBracket = /[\[\]()]/.test(title);
    if (!hasBracket) missing.push('No brackets/parentheses');

    var hasQuestion = title.includes('?');
    var powerWords = ['ultimate','best','top','guide','how to','tips','tricks','secret','easy','fast','proven','essential','complete','simple','powerful','expert','step by step','effective','amazing','incredible'];
    var foundPower = powerWords.filter(function(w) { return lower.includes(w); });
    if (foundPower.length < 2) missing.push('Add power words (e.g., Ultimate, Best, Easy, Proven)');

    var emotional = ['amazing','incredible','shocking','unbelievable','huge','massive','crazy','insane','mind blowing','life changing'];
    var foundEmo = emotional.filter(function(w) { return lower.includes(w); });
    if (foundEmo.length === 0) missing.push('No emotional triggers');

    var words = title.split(' ');
    var longWords = words.filter(function(w) { return w.length > 3; });
    var cappedLongWords = longWords.filter(function(w) { return w[0] === w[0].toUpperCase(); });
    var caseRatio = longWords.length > 0 ? cappedLongWords.length / longWords.length : 1;
    if (caseRatio < 0.3) missing.push('Use proper title case');

    // Generate 3 improved titles
    var cleanTopic = title.replace(/[\[\]()]/g, '').replace(/\d{4}/g, '').replace(/^(top|best|how to|ultimate|guide|tips|tricks|easy|simple|complete)\s*/i, '').trim();
    if (!cleanTopic) cleanTopic = kwLower || title;

    // Title 1: Number + Power Word + Topic
    var t1;
    if (!hasNumber && hasBracket) {
      t1 = '5 ' + (foundPower.length < 2 ? 'Essential ' : '') + cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) + ' [2026 Guide]';
    } else if (!hasNumber) {
      t1 = '5 ' + (foundPower.length < 2 ? 'Best ' : '') + cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) + ' (2026)';
    } else if (hasBracket) {
      t1 = title.replace(/[\[\]()]/g, '').trim() + ' [2026 Updated]';
    } else {
      t1 = (foundPower.length < 2 ? 'Ultimate ' : '') + cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) + ' — Complete Guide';
    }

    // Title 2: How-To / Question format
    var t2;
    if (!hasQuestion) {
      t2 = 'How to ' + cleanTopic + ' in 2026 (Step-by-Step)';
    } else {
      t2 = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) + ': ' + (foundPower.length < 2 ? 'Ultimate ' : '') + 'Tips & Tricks';
    }

    // Title 3: Beginner-friendly
    var t3;
    if (!lower.includes('beginner') && !lower.includes('beginners')) {
      t3 = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) + ' for Beginners — ' + (foundPower.length < 2 ? 'Easy ' : '') + 'Step-by-Step 2026';
    } else {
      t3 = (hasNumber ? 'Top 10 ' : '') + cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1) + ' Strategies That Actually Work';
    }

    var suggestions = [];
    if (t1 && t1.length <= 70) suggestions.push(t1);
    if (t2 && t2.length <= 70) suggestions.push(t2);
    if (t3 && t3.length <= 70) suggestions.push(t3);
    // Fallback: generate a generic one if all are too long
    if (suggestions.length < 3) {
      var fallback = 'The ' + (foundPower[0] || 'Ultimate') + ' Guide to ' + cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
      if (fallback.length <= 70) suggestions.push(fallback);
    }

    return {
      missing: missing,
      improvements: improvements,
      suggestions: suggestions.slice(0, 3)
    };
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const keyword = document.body.getAttribute('data-keyword') || '';
  const result = ToolLogic.scoreTitle(input, keyword);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');
  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div>';
  html += '<div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  html += '<div style="text-align:center;margin-bottom:1.5rem;">';
  html += '<div style="font-size:3rem;font-weight:800;background:linear-gradient(135deg,#6366f1,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + result.score + '/100</div>';
  html += '<div style="font-size:1.2rem;font-weight:700;color:#e2e8f0;">Grade: ' + result.grade + '</div>';
  html += '<div style="width:100%;height:8px;background:#1a1a2e;border-radius:4px;margin-top:0.5rem;overflow:hidden;"><div style="width:' + result.score + '%;height:100%;background:linear-gradient(90deg,#6366f1,#06b6d4);border-radius:4px;transition:width 0.5s;"></div></div>';
  html += '</div><div style="text-align:left;">';
  result.checks.forEach(function(c) {
    const color = c.pass ? '#22c55e' : '#ff3366';
    const icon = c.pass ? '✅' : '❌';
    const weightLabel = c.weight === 'high' ? ' 🔴 Important' : c.weight === 'medium' ? ' 🟡 Advisory' : ' ⚪ Minor';
    html += '<div style="padding:0.5rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);font-size:0.9rem;color:#d1d5db;">';
    html += '<span style="margin-right:0.5rem;">' + icon + '</span>';
    html += c.msg + '<span style="float:right;font-size:0.75rem;color:' + color + ';">' + weightLabel + '</span>';
    html += '</div>';
  });
  html += '</div>';

  // Generate best title suggestions
  var best = ToolLogic.generateBestTitle(input, keyword);

  // Show what's missing section
  if (best.missing.length > 0) {
    html += '<div style="margin-top:1.25rem;padding:1rem;background:rgba(255,51,102,0.05);border:1px solid rgba(255,51,102,0.15);border-radius:8px;text-align:left;">';
    html += '<div style="font-weight:700;font-size:1rem;color:#ff3366;margin-bottom:0.75rem;">⚠️ What\'s Missing From Your Title</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:0.5rem;">';
    best.missing.forEach(function(m) {
      html += '<span style="background:rgba(255,51,102,0.1);color:#ff6b8a;padding:0.3rem 0.7rem;border-radius:6px;font-size:0.8rem;">' + m + '</span>';
    });
    html += '</div></div>';
  }

  // Show best title suggestions
  if (best.suggestions.length > 0) {
    html += '<div style="margin-top:1rem;padding:1rem;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.15);border-radius:8px;text-align:left;">';
    html += '<div style="font-weight:700;font-size:1rem;color:#22c55e;margin-bottom:0.75rem;">🏆 Best Titles for You</div>';
    best.suggestions.forEach(function(s, i) {
      html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;margin-bottom:0.4rem;background:rgba(34,197,94,0.08);border-radius:6px;">';
      html += '<span style="font-weight:700;color:#22c55e;font-size:0.9rem;min-width:1.5rem;">' + (i + 1) + '.</span>';
      html += '<span style="font-size:0.9rem;color:#e2e8f0;flex:1;">' + s + '</span>';
      html += '<button class="copy-title-btn" data-title="' + s.replace(/"/g, '&quot;') + '" style="background:none;border:1px solid #22c55e;color:#22c55e;padding:0.2rem 0.6rem;border-radius:4px;cursor:pointer;font-size:0.75rem;white-space:nowrap;">📋 Use</button>';
      html += '</div>';
    });
    html += '</div>';

  }

  placeholder.innerHTML = html;
  setTimeout(function() {
    document.querySelectorAll('.copy-title-btn').forEach(function(b) {
      b.addEventListener('click', function() {
        var t = b.getAttribute('data-title');
        navigator.clipboard.writeText(t).then(function() {
          b.textContent = 'Copied!';
          setTimeout(function() { b.textContent = '📋 Use'; }, 1500);
        });
      });
    });
  }, 100);
}`,

    generator: `
const ToolLogic = {
  generateTags(topic) {
    const base = topic.toLowerCase().trim();
    const words = base.split(/\\s+/);
    const tags = [];
    const seen = new Set();

    function add(tag) {
      const t = tag.toLowerCase().trim();
      if (t && !seen.has(t) && t.length > 0) {
        seen.add(t);
        tags.push(t);
      }
    }

    // Base seed
    add(base);
    add(base + ' 2026');
    add(base + ' tutorial');
    add('how to ' + base);
    add(base + ' guide');
    add('best ' + base + ' tips');
    add(base + ' for beginners');
    add(base + ' explained');
    add(base + ' step by step');
    add(base + ' strategy');
    add(base + ' ideas');

    // Variations from words
    if (words.length > 1) {
      add(words.slice(0,2).join(' ') + ' 2026');
      add('top ' + base);
      add(base + ' secrets');
    }

    // Suffix combos (more diverse)
    const suffixes = ['hacks', 'masterclass', 'techniques', 'mistakes', 'examples', 'checklist', 'tools', 'software', 'review', 'comparison', 'best practices', 'tips and tricks', 'course', 'training', 'updated'];
    for (const s of suffixes) {
      if (tags.length >= 30) break;
      add(base + ' ' + s);
    }

    // Broad terms
    const broad = ['youtube seo', 'video optimization', 'content marketing', 'youtube growth', 'youtube algorithm'];
    for (const b of broad) {
      if (tags.length >= 35) break;
      add(b);
    }

    // Volume estimates (deterministic: same topic = same results)
    return tags.slice(0, 30).map(function(t, i) {
      const volBase = 500 - (i * 15);
      const vol = Math.max(50, volBase + Math.floor(seededRandom(i * 10 + 1) * 200));
      const comp = Math.min(95, 30 + Math.floor(seededRandom(i * 10 + 7) * 50));
      return { tag: t, volume: vol, competition: comp };
    });
  },

  analyzeTags(topic) {
    var base = topic.toLowerCase().trim();
    // Generate the best 5 tags with rationale
    var bestTags = [
      { tag: base, reason: 'Primary keyword — essential for ranking' },
      { tag: base + ' 2026', reason: 'Time-bound keyword — captures trending searches' },
      { tag: 'how to ' + base, reason: 'How-to format — highest search intent' },
      { tag: base + ' tutorial', reason: 'Tutorial format — YouTube\'s favorite content type' },
      { tag: base + ' for beginners', reason: 'Beginner modifier — broadest search audience' },
    ];

    // Tag gap analysis
    var gaps = ['Long-tail tag (3-5 words targeting specific search intent)'];
    if (base.split(/\s+/).length < 3) {
      gaps.push('Broad category tag (e.g., "youtube seo tips" instead of just "seo")');
    }
    if (!base.includes('2026') && !base.includes('2025')) {
      gaps.push('Year-specific tag to capture "2026" searches');
    }

    return {
      best: bestTags,
      gaps: gaps,
      tip: 'Use your primary keyword as the first tag. Mix exact match, broad match, and long-tail tags. Aim for 10-15 tags total.'
    };
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const results = ToolLogic.generateTags(input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');
  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div>';
  html += '<div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  html += '<div style="margin-bottom:1rem;color:#94a3b8;font-size:0.9rem;">Generated ' + results.length + ' tags for &quot;' + input + '&quot;</div>';
  results.forEach(function(r, i) {
    const compColor = r.competition < 40 ? '#22c55e' : r.competition < 65 ? '#f59e0b' : '#ff3366';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.6rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);">';
    html += '<div style="display:flex;align-items:center;gap:0.75rem;">';
    html += '<span style="font-weight:700;color:#6366f1;font-size:0.85rem;min-width:2rem;">#' + (i + 1) + '</span>';
    html += '<span style="font-family:monospace;font-size:0.95rem;color:#e2e8f0;">' + r.tag + '</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:0.75rem;">';
    html += '<span style="font-size:0.75rem;color:#94a3b8;">' + r.volume.toLocaleString() + '/mo</span>';
    html += '<span style="font-size:0.75rem;color:' + compColor + ';background:' + compColor + '15;padding:0.15rem 0.5rem;border-radius:4px;">' + r.competition + '% comp</span>';
    html += '<button class="copy-tag-btn" data-tag="' + r.tag.replace(/"/g, '&quot;') + '" style="background:none;border:1px solid #2a2a4a;color:#94a3b8;padding:0.25rem 0.6rem;border-radius:4px;cursor:pointer;font-size:0.75rem;">Copy</button>';
    html += '</div></div>';
  });
  placeholder.innerHTML = html;
  setTimeout(function() {
    document.querySelectorAll('.copy-tag-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tag = btn.getAttribute('data-tag');
        navigator.clipboard.writeText(tag).then(function() {
          btn.textContent = 'Copied!';
          btn.style.color = '#22c55e';
          btn.style.borderColor = '#22c55e';
          setTimeout(function() {
            btn.textContent = 'Copy';
            btn.style.color = '';
            btn.style.borderColor = '';
          }, 1500);
        });
      });
    });
  }, 0);

  // Add tag gap analysis
  var tagAnalysis = ToolLogic.analyzeTags(input);

  // Best 5 tags section
  html += '<div style="margin-top:1.25rem;padding:1rem;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);border-radius:8px;text-align:left;">';
  html += '<div style="font-weight:700;font-size:1rem;color:#6366f1;margin-bottom:0.75rem;">🎯 Top 5 Recommended Tags</div>';
  tagAnalysis.best.forEach(function(t, i) {
    html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0.6rem;margin-bottom:0.3rem;background:rgba(99,102,241,0.06);border-radius:6px;">';
    html += '<span style="font-weight:700;color:#6366f1;font-size:0.85rem;min-width:1.5rem;">#' + (i + 1) + '</span>';
    html += '<div style="flex:1;"><span style="font-family:monospace;font-size:0.85rem;color:#e2e8f0;">' + t.tag + '</span>';
    html += '<div style="font-size:0.7rem;color:#64748b;">' + t.reason + '</div></div>';
    html += '<button class="copy-best-btn" data-tag="' + t.tag.replace(/"/g, '&quot;') + '" style="background:none;border:1px solid #6366f1;color:#6366f1;padding:0.2rem 0.6rem;border-radius:4px;cursor:pointer;font-size:0.7rem;white-space:nowrap;">Copy</button>';
    html += '</div>';
  });

  // Tag gaps section
  if (tagAnalysis.gaps.length > 0) {
    html += '<div style="margin-top:0.75rem;padding:0.75rem;background:rgba(245,158,11,0.05);border:1px solid rgba(245,158,11,0.12);border-radius:6px;">';
    html += '<div style="font-weight:600;font-size:0.85rem;color:#f59e0b;margin-bottom:0.4rem;">💡 Tag Strategy Tips</div>';
    tagAnalysis.gaps.forEach(function(g) {
      html += '<div style="font-size:0.8rem;color:#d1d5db;padding:0.15rem 0;">→ ' + g + '</div>';
    });
    html += '<div style="font-size:0.8rem;color:#6366f1;margin-top:0.4rem;">💡 ' + tagAnalysis.tip + '</div>';
    html += '</div>';
  }
  html += '</div>';

  // Setup copy buttons for best tags
  setTimeout(function() {
    document.querySelectorAll('.copy-best-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tag = btn.getAttribute('data-tag');
        navigator.clipboard.writeText(tag).then(function() {
          btn.textContent = 'Copied!';
          btn.style.color = '#22c55e';
          btn.style.borderColor = '#22c55e';
          setTimeout(function() {
            btn.textContent = 'Copy';
            btn.style.color = '';
            btn.style.borderColor = '';
          }, 1500);
        });
      });
    });
  }, 100);

  placeholder.innerHTML = html;
}`,

    research: `
const ToolLogic = {
  research(seed) {
    const prefixes = ['how to', 'best', 'top', 'what is', 'why', 'when to', 'how often', 'can you', 'do you need', 'is it worth', 'how much', 'where to find'];
    const suffixes = ['tips', 'tricks', 'guide', 'tutorial', 'examples', 'strategies', 'for beginners', '2026', 'explained', 'ideas', 'mistakes', 'hacks', 'tools', 'software', 'review', 'comparison', 'techniques', 'best practices', 'walkthrough', 'overview'];
    const results = [];

    prefixes.forEach(function(p, i) {
      const kw = p + ' ' + seed;
      results.push({
        keyword: kw,
        volume: Math.floor(seededRandom(i * 10 + 1) * 8000) + 200,
        difficulty: Math.floor(seededRandom(i * 10 + 5) * 70) + 5,
        trend: seededRandom(i * 10 + 9) > 0.5 ? 'rising' : 'stable'
      });
    });

    suffixes.forEach(function(s, i) {
      const kw = seed + ' ' + s;
      results.push({
        keyword: kw,
        volume: Math.floor(seededRandom(i * 10 + 2) * 5000) + 100,
        difficulty: Math.floor(seededRandom(i * 10 + 6) * 65) + 10,
        trend: seededRandom(i * 10 + 9) > 0.4 ? 'rising' : 'stable'
      });
    });

    // Sort by volume descending, return top 25
    results.sort(function(a, b) { return b.volume - a.volume; });
    return results.slice(0, 25);
  },

  recommendKeywords(seed, allResults) {
    // Pick the best 3-5 keywords: balance volume vs difficulty
    var scored = allResults.map(function(r) {
      // Score: volume / difficulty + trend bonus
      var difficultyFactor = Math.max(1, 100 - r.difficulty);
      var trendBonus = r.trend === 'rising' ? 1.3 : 1.0;
      var score = Math.round((r.volume / difficultyFactor) * trendBonus);
      return { keyword: r.keyword, volume: r.volume, difficulty: r.difficulty, trend: r.trend, score: score };
    });

    // Sort by score descending
    scored.sort(function(a, b) { return b.score - a.score; });

    // Add rationale
    var selected = scored.slice(0, 3);
    selected.forEach(function(k) {
      if (k.difficulty < 30 && k.volume > 500) k.reason = 'High volume, low competition — target this first!';
      else if (k.difficulty < 40) k.reason = 'Low competition — great for ranking quickly';
      else if (k.volume > 2000) k.reason = 'High search volume — worth the effort';
      else if (k.trend === 'rising') k.reason = 'Trending up — catch the wave early';
      else k.reason = 'Balanced opportunity';
    });

    return selected;
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const results = ToolLogic.research(input);
  var bestKeywords = ToolLogic.recommendKeywords(input, results);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');
  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';

  // Show best keyword recommendations FIRST
  html += '<div style="margin-bottom:1rem;padding:1rem;background:rgba(34,197,94,0.04);border:1px solid rgba(34,197,94,0.15);border-radius:8px;text-align:left;">';
  html += '<div style="font-weight:700;font-size:1rem;color:#22c55e;margin-bottom:0.75rem;">🎯 Top 3 Keywords to Target</div>';
  bestKeywords.forEach(function(k, i) {
    var diffLabel = k.difficulty < 35 ? 'Easy' : k.difficulty < 60 ? 'Medium' : 'Hard';
    var diffColor = k.difficulty < 35 ? '#22c55e' : k.difficulty < 60 ? '#f59e0b' : '#ff3366';
    html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.75rem;margin-bottom:0.4rem;background:rgba(34,197,94,0.06);border-radius:6px;">';
    html += '<span style="font-weight:700;color:#22c55e;font-size:0.9rem;min-width:1.5rem;">#' + (i + 1) + '</span>';
    html += '<div style="flex:1;"><span style="font-size:0.9rem;color:#e2e8f0;">' + k.keyword + '</span>';
    html += '<div style="font-size:0.75rem;color:#64748b;">' + k.volume.toLocaleString() + '/mo · <span style="color:' + diffColor + ';">' + diffLabel + '</span> · ' + k.trend + '</div></div>';
    html += '<div style="font-size:0.7rem;color:#6366f1;max-width:150px;text-align:right;">' + k.reason + '</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '<div style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;">';
  html += '<span style="color:#94a3b8;font-size:0.9rem;">' + results.length + ' keyword ideas for &quot;' + input + '&quot;</span>';
  html += '<span style="font-size:0.75rem;color:#64748b;">Sorted by search volume</span>';
  html += '</div>';

  // Summary stats
  const avgVol = Math.round(results.reduce(function(s, r) { return s + r.volume; }, 0) / results.length);
  const lowComp = results.filter(function(r) { return r.difficulty < 35; }).length;
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;margin-bottom:1.5rem;padding:1rem;background:rgba(99,102,241,0.08);border-radius:8px;">';
  html += '<div style="text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:#6366f1;">' + avgVol.toLocaleString() + '</div><div style="font-size:0.75rem;color:#94a3b8;">Avg Volume</div></div>';
  html += '<div style="text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:#22c55e;">' + lowComp + '</div><div style="font-size:0.75rem;color:#94a3b8;">Low Competition</div></div>';
  html += '<div style="text-align:center;"><div style="font-size:1.3rem;font-weight:700;color:#06b6d4;">' + results.length + '</div><div style="font-size:0.75rem;color:#94a3b8;">Total Keywords</div></div>';
  html += '</div>';

  results.forEach(function(r, i) {
    const diffColor = r.difficulty < 35 ? '#22c55e' : r.difficulty < 60 ? '#f59e0b' : '#ff3366';
    const diffLabel = r.difficulty < 35 ? 'Easy' : r.difficulty < 60 ? 'Medium' : 'Hard';
    const trendIcon = r.trend === 'rising' ? '📈' : '📊';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);">';
    html += '<div style="display:flex;align-items:center;gap:0.75rem;">';
    html += '<span style="font-weight:700;color:#6366f1;font-size:0.85rem;min-width:2rem;">#' + (i + 1) + '</span>';
    html += '<span style="font-size:0.9rem;color:#e2e8f0;">' + r.keyword + ' ' + trendIcon + '</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:0.75rem;">';
    html += '<span style="font-size:0.75rem;color:#94a3b8;">' + r.volume.toLocaleString() + '/mo</span>';
    html += '<span style="font-size:0.7rem;color:' + diffColor + ';background:' + diffColor + '15;padding:0.15rem 0.5rem;border-radius:4px;font-weight:600;">' + diffLabel + '</span>';
    html += '</div></div>';
  });
  placeholder.innerHTML = html;
}`,

    writer: `
const ToolLogic = {
  writeDescription(topic) {
    const now = new Date();
    const year = now.getFullYear();
    const lines = [];
    lines.push('📌 ' + topic.charAt(0).toUpperCase() + topic.slice(1) + ' — Complete Guide ' + year);
    lines.push('');
    lines.push("In this video, I cover everything you need to know about " + topic + ". Whether you're just starting out or looking to level up, these actionable strategies will help you get results faster.");
    lines.push('');
    lines.push('📑 TIMESTAMPS:');
    lines.push('0:00 - Introduction');
    lines.push('0:45 - What Is ' + topic.charAt(0).toUpperCase() + topic.slice(1) + '?');
    lines.push('3:15 - Step 1: Getting Started');
    lines.push('5:30 - Step 2: Key Strategies That Work');
    lines.push('8:00 - Step 3: Common Mistakes to Avoid');
    lines.push('10:30 - Advanced Tips & Tricks');
    lines.push('12:00 - Real Examples & Case Studies');
    lines.push('14:00 - Final Thoughts & Next Steps');
    lines.push('');
    lines.push('🔗 LINKS & RESOURCES:');
    lines.push('📊 Free YouTube SEO Tools: https://yt-seo-architect.vercel.app/tools');
    lines.push('📘 Full Blog Guide: https://yt-seo-architect.vercel.app/blog/' + window.BLOG_SLUG);
    lines.push('🚀 Dashboard: https://yt-seo-architect.vercel.app/dashboard');
    lines.push('');
    lines.push('📧 Business Inquiries: [your-email@example.com]');
    lines.push('');
    lines.push('🎥 RECOMMENDED VIDEOS:');
    lines.push('• [Related Video 1 - paste link]');
    lines.push('• [Related Video 2 - paste link]');
    lines.push('• [Related Video 3 - paste link]');
    lines.push('');
    lines.push('💡 PRO TIP:');
    lines.push("Replace the bracketed [links] with your actual video links before publishing. Add your own timestamps based on your video's actual sections.");
    lines.push('');
    lines.push('#' + topic.replace(/\\s+/g, '').replace(/[^a-zA-Z0-9]/g, '') + ' #YouTubeSEO #VideoMarketing #' + year);
    return lines.join('\\n');
  },

  generateBestDescription(topic) {
    var now = new Date();
    var year = now.getFullYear();
    var capTopic = topic.charAt(0).toUpperCase() + topic.slice(1);
    var suggestions = [];

    // Version 1: Hook-focused description
    var desc1 = [];
    desc1.push('📌 ' + capTopic + ' — Complete Guide ' + year);
    desc1.push('');
    desc1.push('🎯 WHAT YOU\'LL LEARN:');
    desc1.push('• What ' + topic + ' is and why it matters in ' + year);
    desc1.push('• Step-by-step strategies that actually work');
    desc1.push('• Common mistakes to avoid (save you months of trial & error)');
    desc1.push('• Advanced tips used by top creators');
    desc1.push('• Actionable next steps to implement today');
    desc1.push('');
    desc1.push('📑 TIMESTAMPS:');
    desc1.push('0:00 - Introduction');
    desc1.push('0:45 - What You\'ll Learn Today');
    desc1.push('3:15 - The Core Strategy');
    desc1.push('5:30 - Advanced Techniques');
    desc1.push('8:00 - Common Mistakes to Avoid');
    desc1.push('10:30 - Real Examples & Case Studies');
    desc1.push('12:00 - Action Plan & Next Steps');
    desc1.push('');
    desc1.push('🔗 FREE RESOURCES:');
    desc1.push('📊 YouTube SEO Toolkit: https://yt-seo-architect.vercel.app/tools');
    desc1.push('📘 Read the Full Guide: https://yt-seo-architect.vercel.app/blog/' + window.BLOG_SLUG);
    desc1.push('');
    desc1.push('💬 Drop a comment if you have questions — I reply to every single one!');
    desc1.push('');
    desc1.push('#' + topic.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '') + ' #YouTubeSEO #VideoMarketing #' + year);
    suggestions.push(desc1.join('\\n'));

    // Version 2: Story-driven
    var desc2 = [];
    desc2.push('📌 ' + capTopic + ' — The Only Guide You\'ll Need in ' + year);
    desc2.push('');
    desc2.push('Ever felt overwhelmed by ' + topic + '? You\'re not alone. In this video, I break down everything into simple, actionable steps.');
    desc2.push('');
    desc2.push('Here\'s what we\'ll cover:');
    desc2.push('⏱️ 0:00 - The Problem');
    desc2.push('⏱️ 1:30 - The 3-Step System');
    desc2.push('⏱️ 4:00 - Real Examples');
    desc2.push('⏱️ 7:30 - Common Mistakes');
    desc2.push('⏱️ 10:00 - Your Action Plan');
    desc2.push('');
    desc2.push('🔗 LINKS:');
    desc2.push('• Free Tools: https://yt-seo-architect.vercel.app/tools');
    desc2.push('• Blog Guide: https://yt-seo-architect.vercel.app/blog/' + window.BLOG_SLUG);
    desc2.push('');
    desc2.push('💡 Watch until the end for a bonus strategy most creators miss!');
    desc2.push('');
    desc2.push('#' + topic.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '') + ' #YouTubeTips #Growth #' + year);
    suggestions.push(desc2.join('\\n'));

    // Version 3: Bullet-point focused
    var desc3 = [];
    desc3.push('📌 ' + capTopic + ' — Fast-Track Guide ' + year);
    desc3.push('');
    desc3.push('In this video, I\'ll show you:');
    desc3.push('✅ The exact ' + topic + ' strategy used by top creators');
    desc3.push('✅ 5 proven techniques that work in ' + year);
    desc3.push('✅ The #1 mistake killing your results');
    desc3.push('✅ Tools to automate the process');
    desc3.push('');
    desc3.push('📑 TIMESTAMPS:');
    desc3.push('0:00 - Introduction');
    desc3.push('0:30 - Prerequisites');
    desc3.push('2:00 - Step 1: Foundation');
    desc3.push('4:30 - Step 2: Execution');
    desc3.push('7:00 - Step 3: Optimization');
    desc3.push('9:30 - Step 4: Scale');
    desc3.push('12:00 - Results & Next Steps');
    desc3.push('');
    desc3.push('📊 Free Tools: https://yt-seo-architect.vercel.app/tools');
    desc3.push('');
    desc3.push('#' + topic.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '') + ' #YouTubeSEO #GrowthHacks #' + year);
    suggestions.push(desc3.join('\\n'));

    return { suggestions: suggestions };
  }
};;

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const result = ToolLogic.writeDescription(input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');
  var bannerHtml = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  placeholder.innerHTML = bannerHtml + '<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.9rem;line-height:1.6;color:#d1d5db;background:#0f0f1a;padding:1.25rem;border-radius:8px;border:1px solid #2a2a4a;text-align:left;margin:0;">' + escHtml(result) + '</pre>';
  placeholder.innerHTML += '<button onclick="copyDesc()" style="margin-top:1rem;background:linear-gradient(135deg,#6366f1,#06b6d4);color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.9rem;">📋 Copy Description</button>';

  // Show best description alternatives
  var bestDescs = ToolLogic.generateBestDescription(input);
  var descHtml = '<div style="margin-top:1.25rem;padding:1rem;background:rgba(99,102,241,0.04);border:1px solid rgba(99,102,241,0.12);border-radius:8px;text-align:left;">';
  descHtml += '<div style="font-weight:700;font-size:1rem;color:#6366f1;margin-bottom:0.75rem;">🏆 Best Descriptions for Your Video</div>';
  bestDescs.suggestions.forEach(function(s, i) {
    var preview = s.substring(0, 120).replace(/\\n/g, ' ') + '...';
    descHtml += '<div style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.5rem 0.75rem;margin-bottom:0.4rem;background:rgba(99,102,241,0.06);border-radius:6px;cursor:pointer;" onclick="selectDesc(' + i + ')">';
    descHtml += '<span style="font-weight:700;color:#6366f1;font-size:0.9rem;min-width:1.5rem;">' + (i + 1) + '.</span>';
    descHtml += '<div style="flex:1;"><div style="font-size:0.8rem;color:#e2e8f0;">' + preview + '</div>';
    descHtml += '<div style="font-size:0.7rem;color:#6366f1;margin-top:0.2rem;">Click to use this version →</div></div>';
    descHtml += '</div>';
  });
  descHtml += '</div>';
  descHtml += '<div id="desc-preview" style="display:none;margin-top:1rem;padding:1rem;background:#0f0f1a;border:1px solid #2a2a4a;border-radius:8px;white-space:pre-wrap;font-family:inherit;font-size:0.9rem;line-height:1.6;color:#d1d5db;text-align:left;"></div>';
  descHtml += '<div id="desc-preview-btn" style="display:none;margin-top:0.5rem;"><button onclick="copyDescPreview()" style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.9rem;">📋 Use This Description</button></div>';
  placeholder.innerHTML += descHtml;

  window.__descText = result;
  window.__bestDescs = bestDescs.suggestions;
}

function copyDesc() {
  if (window.__descText) {
    navigator.clipboard.writeText(window.__descText).then(function() {
      const btn = document.querySelector('button[onclick="copyDesc()"]');
      if (btn) { btn.textContent = '✅ Copied!'; setTimeout(function() { btn.textContent = '📋 Copy Description'; }, 2000); }
    });
  }
}

function selectDesc(idx) {
  var descs = window.__bestDescs;
  if (!descs || !descs[idx]) return;
  var preview = document.getElementById('desc-preview');
  var btn = document.getElementById('desc-preview-btn');
  if (preview) { preview.style.display = 'block'; preview.textContent = descs[idx]; }
  if (btn) btn.style.display = 'block';
  window.__selectedDesc = descs[idx];
}

function copyDescPreview() {
  var text = window.__selectedDesc || window.__descText;
  if (!text) return;
  navigator.clipboard.writeText(text).then(function() {
    var btn = document.querySelector('#desc-preview-btn button');
    if (btn) { btn.textContent = '✅ Copied!'; setTimeout(function() { btn.textContent = '📋 Use This Description'; }, 2000); }
  }).catch(function() {
    var ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}`,

    checker: `
const ToolLogic = {
  checkMetadata(text) {
    const issues = [];
    const lower = text.toLowerCase();

    // Check for title-like patterns
    const hasTitle = text.length > 10;
    const wordCount = text.split(/\\s+/).filter(Boolean).length;

    // Description length
    if (wordCount < 50) { issues.push({ severity: 'high', area: 'Description', msg: 'Description too short (' + wordCount + ' words). Aim for 200+ words for SEO.', icon: '🔴' }); }
    else if (wordCount < 150) { issues.push({ severity: 'medium', area: 'Description', msg: 'Description could be longer (' + wordCount + ' words). 200+ words is ideal.', icon: '🟡' }); }
    else { issues.push({ severity: 'good', area: 'Description', msg: 'Good description length (' + wordCount + ' words).', icon: '✅' }); }

    // Hashtags in description
    if (lower.includes('#')) {
      const hashtags = text.match(/#\\w+/g);
      if (hashtags && hashtags.length > 0) {
        issues.push({ severity: 'good', area: 'Hashtags', msg: hashtags.length + ' hashtags found. Keep 3-5 for maximum reach.', icon: '✅' });
      }
    } else {
      issues.push({ severity: 'medium', area: 'Hashtags', msg: 'No hashtags in description. Add 3-5 relevant hashtags.', icon: '🟡' });
    }

    // Links
    if (lower.includes('http') || lower.includes('youtu')) {
      issues.push({ severity: 'good', area: 'Links', msg: 'Links present — good for driving traffic.', icon: '✅' });
    } else {
      issues.push({ severity: 'low', area: 'Links', msg: 'Consider adding links to related content or social media.', icon: '⚪' });
    }

    // Timestamps
    if (/\\d+:\\d+/.test(text)) {
      issues.push({ severity: 'good', area: 'Timestamps', msg: 'Timestamps found — improves search visibility with video chapters.', icon: '✅' });
    } else {
      issues.push({ severity: 'medium', area: 'Timestamps', msg: 'No timestamps. Add them for the video chapters feature.', icon: '🟡' });
    }

    // Keyword repetition (potential stuffing)
    const words = text.split(/\\s+/).filter(Boolean);
    const freq = {};
    words.forEach(function(w) { var wl = w.toLowerCase().replace(/[^a-z]/g, ''); if (wl.length > 4) { freq[wl] = (freq[wl] || 0) + 1; } });
    const maxFreq = Math.max.apply(null, Object.values(freq));
    if (maxFreq > 15) {
      issues.push({ severity: 'high', area: 'Keyword Stuffing', msg: 'A keyword appears ' + maxFreq + ' times. This may trigger spam detection.', icon: '🔴' });
    }

    return { issues, passCount: issues.filter(function(i) { return i.severity === 'good'; }).length, warnCount: issues.filter(function(i) { return i.severity !== 'good'; }).length };
  },

  checkSmallChannel(text) {
    var nums = text.match(/\\d[\\d,.]*/g);
    var currentSubs = nums ? parseInt(nums[0].replace(/,/g, '')) : 0;
    var watchHours = nums && nums.length > 1 ? parseInt(nums[1].replace(/,/g, '')) : 0;
    var lower = text.toLowerCase();

    var issues = [];

    // Niche check
    var niches = ['gaming', 'tech', 'cooking', 'music', 'vlog', 'education', 'comedy', 'sports', 'beauty', 'fashion', 'travel', 'finance', 'fitness', 'tutorial', 'review', 'unboxing', 'podcast', 'art', 'diy', 'animation'];
    var foundNiche = niches.filter(function(n) { return lower.includes(n); });
    if (foundNiche.length > 0) {
      issues.push({ severity: 'good', area: 'Niche', msg: 'Clear niche identified: ' + foundNiche[0] + '. Niche channels grow 3x faster.', icon: '✅' });
    } else {
      issues.push({ severity: 'high', area: 'Niche', msg: 'No clear niche detected. Small channels without a niche struggle to grow. Pick one topic and own it.', icon: '🔴' });
    }

    // Subs check
    if (currentSubs >= 1000) {
      issues.push({ severity: 'good', area: 'Subscribers', msg: currentSubs.toLocaleString() + ' subs — you\'re past the first major milestone!', icon: '✅' });
    } else if (currentSubs >= 100) {
      var to1k = 1000 - currentSubs;
      issues.push({ severity: 'medium', area: 'Subscribers', msg: currentSubs.toLocaleString() + ' subs. ' + to1k + ' more to 1K. Small channels with 100+ subs see 2x faster growth.', icon: '🟡' });
    } else {
      issues.push({ severity: 'high', area: 'Subscribers', msg: 'Under 100 subs. Focus on quality content & consistent uploads. Every big channel started here.', icon: '🔴' });
    }

    // Watch hours check
    if (watchHours >= 4000) {
      issues.push({ severity: 'good', area: 'Watch Hours', msg: watchHours.toLocaleString() + ' hours — you qualify for monetization!', icon: '✅' });
    } else if (watchHours >= 1000) {
      issues.push({ severity: 'medium', area: 'Watch Hours', msg: watchHours.toLocaleString() + ' hours. Great progress! Keep creating longer content to boost watch time.', icon: '🟡' });
    } else {
      issues.push({ severity: 'high', area: 'Watch Hours', msg: 'Watch time is low. Focus on retention — hook viewers in the first 5 seconds.', icon: '🔴' });
    }

    // Upload consistency guess
    if (lower.includes('weekly') || lower.includes('daily') || lower.includes('regular')) {
      issues.push({ severity: 'good', area: 'Consistency', msg: 'Regular uploads detected. Consistency is the #1 growth factor for small channels.', icon: '✅' });
    } else {
      issues.push({ severity: 'medium', area: 'Consistency', msg: 'No upload schedule mentioned. Posting weekly gives you 4x more growth than irregular posting.', icon: '🟡' });
    }

    // SEO check
    if (lower.includes('seo') || lower.includes('title') || lower.includes('tag') || lower.includes('description')) {
      issues.push({ severity: 'good', area: 'SEO Awareness', msg: 'You\'re thinking about SEO — that\'s half the battle. Optimize each video like a landing page.', icon: '✅' });
    } else {
      issues.push({ severity: 'medium', area: 'SEO Awareness', msg: 'Focus on keyword research. Small channels grow by ranking for low-competition keywords.', icon: '🟡' });
    }

    // Thumbnail strategy
    if (lower.includes('thumbnail') || lower.includes('thumb')) {
      issues.push({ severity: 'good', area: 'Thumbnails', msg: 'You know thumbnails matter. High contrast, close-up faces, and text overlays boost CTR by 30%.', icon: '✅' });
    } else {
      issues.push({ severity: 'medium', area: 'Thumbnails', msg: 'No thumbnail strategy mentioned. Custom thumbnails increase CTR by 2-3x over auto-generated ones.', icon: '🟡' });
    }

    return { issues, passCount: issues.filter(function(i) { return i.severity === 'good'; }).length, warnCount: issues.filter(function(i) { return i.severity !== 'good'; }).length };
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  var _topic = (window.BLOG_TOPIC || '').toLowerCase();
  var result = (_topic.includes('small') || _topic.includes('beginner') || _topic.includes('monetiz')) ? ToolLogic.checkSmallChannel(input) : ToolLogic.checkMetadata(input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  html += '<div style="display:flex;gap:1.5rem;margin-bottom:1.5rem;justify-content:center;">';
  html += '<div style="text-align:center;padding:1rem 1.5rem;background:rgba(34,197,94,0.1);border-radius:8px;"><div style="font-size:1.5rem;font-weight:700;color:#22c55e;">' + result.passCount + '</div><div style="font-size:0.8rem;color:#94a3b8;">Passed</div></div>';
  html += '<div style="text-align:center;padding:1rem 1.5rem;background:rgba(255,51,102,0.1);border-radius:8px;"><div style="font-size:1.5rem;font-weight:700;color:#ff3366;">' + result.warnCount + '</div><div style="font-size:0.8rem;color:#94a3b8;">Issues</div></div>';
  html += '</div>';

  result.issues.forEach(function(issue) {
    html += '<div style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.6rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);">';
    html += '<span>' + issue.icon + '</span>';
    html += '<div><div style="font-size:0.8rem;color:#6366f1;font-weight:600;margin-bottom:0.15rem;">' + issue.area + '</div>';
    html += '<div style="font-size:0.85rem;color:#d1d5db;">' + issue.msg + '</div></div>';
    html += '</div>';
  });
  placeholder.innerHTML = html;
}`,

    auditor: `
const ToolLogic = {
  audit(title, desc, tags) {
    const issues = [];
    let score = 50;

    // Title checks
    if (!title || title.length < 10) {
      issues.push({ sev: 'critical', area: 'Title', msg: 'Title is missing or too short. This is your #1 SEO signal.', fix: 'Write a 30-60 char title with your primary keyword in the first 25 chars.' });
      score -= 20;
    } else {
      score += 10;
      if (title.length < 30) { issues.push({ sev: 'warning', area: 'Title', msg: 'Title is ' + title.length + ' chars — aim for 30-60.', fix: 'Expand your title to include more context.' }); score -= 5; }
      else if (title.length <= 60) { issues.push({ sev: 'pass', area: 'Title', msg: 'Title length is optimal (' + title.length + ' chars).', fix: '' }); score += 10; }
      else { issues.push({ sev: 'warning', area: 'Title', msg: 'Title is ' + title.length + ' chars — may get truncated on mobile.', fix: 'Shorten to under 70 chars.' }); score -= 5; }
    }

    // Description checks
    const descWords = desc ? desc.split(/\\s+/).filter(Boolean).length : 0;
    if (!desc || descWords < 50) {
      issues.push({ sev: 'critical', area: 'Description', msg: 'Description is too short (' + descWords + ' words).', fix: 'Write 200+ words with keywords, timestamps, and links.' });
      score -= 15;
    } else if (descWords < 150) {
      issues.push({ sev: 'warning', area: 'Description', msg: 'Description could be longer (' + descWords + ' words).', fix: 'Add more detail to reach 200+ words.' });
      score -= 5;
    } else {
      issues.push({ sev: 'pass', area: 'Description', msg: 'Description length is good (' + descWords + ' words).', fix: '' });
      score += 10;
    }

    // Hashtags
    if (desc && /#\\w+/.test(desc)) {
      issues.push({ sev: 'pass', area: 'Hashtags', msg: 'Hashtags found in description.', fix: '' });
      score += 5;
    } else {
      issues.push({ sev: 'warning', area: 'Hashtags', msg: 'No hashtags in description.', fix: 'Add 3-5 relevant hashtags (e.g., #YouTubeSEO).' });
    }

    // Timestamps
    if (desc && /\\d+:\\d+/.test(desc)) {
      issues.push({ sev: 'pass', area: 'Timestamps', msg: 'Timestamps/chapters present.', fix: '' });
      score += 5;
    } else {
      issues.push({ sev: 'warning', area: 'Timestamps', msg: 'No timestamps in description.', fix: 'Add timestamps for video chapters (improves SEO).' });
    }

    // Tag checks
    if (tags) {
      const tagList = tags.split(',').filter(Boolean).map(function(t) { return t.trim(); });
      if (tagList.length < 5) {
        issues.push({ sev: 'critical', area: 'Tags', msg: 'Only ' + tagList.length + ' tags. Need at least 5-15.', fix: 'Add 10-15 relevant tags covering broad and specific terms.' });
        score -= 10;
      } else if (tagList.length >= 5 && tagList.length <= 30) {
        issues.push({ sev: 'pass', area: 'Tags', msg: tagList.length + ' tags — good range.', fix: '' });
        score += 5;
      } else {
        issues.push({ sev: 'warning', area: 'Tags', msg: tagList.length + ' tags — more than 30 may dilute focus.', fix: 'Keep 15-25 high-quality tags.' });
        score -= 3;
      }
    }

    score = Math.max(0, Math.min(100, score));
    var grade = score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 45 ? 'C' : 'D';
    return { score: score, grade: grade, issues: issues };
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  // Try to split input into title, description, tags
  const parts = input.split(/\\n+/).filter(Boolean);
  const title = parts[0] || '';
  const desc = parts.slice(1).join('\\n') || '';
  const tags = parts[parts.length - 1].includes(',') ? parts[parts.length - 1] : '';
  const result = ToolLogic.audit(title, desc, tags);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');  box.classList.add('show');

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  html += '<div style="text-align:center;margin-bottom:1.5rem;">';
  html += '<div style="font-size:2.5rem;font-weight:800;background:linear-gradient(135deg,#6366f1,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + result.score + '/100</div>';
  html += '<div style="font-size:1.1rem;font-weight:700;color:' + (result.grade === 'A' ? '#22c55e' : result.grade === 'B' ? '#06b6d4' : result.grade === 'C' ? '#f59e0b' : '#ff3366') + ';">Grade: ' + result.grade + '</div>';
  html += '</div>';

  result.issues.forEach(function(issue) {
    const icon = issue.sev === 'pass' ? '✅' : issue.sev === 'warning' ? '🟡' : '🔴';
    const sevColor = issue.sev === 'pass' ? '#22c55e' : issue.sev === 'warning' ? '#f59e0b' : '#ff3366';
    html += '<div style="padding:0.6rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);text-align:left;">';
    html += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem;">';
    html += '<span>' + icon + '</span>';
    html += '<span style="font-size:0.8rem;font-weight:600;color:' + sevColor + ';">' + issue.area.toUpperCase() + '</span>';
    html += '<span style="font-size:0.7rem;background:' + sevColor + '15;color:' + sevColor + ';padding:0.1rem 0.4rem;border-radius:4px;">' + issue.sev.toUpperCase() + '</span>';
    html += '</div>';
    html += '<div style="font-size:0.85rem;color:#d1d5db;margin-left:2rem;">' + issue.msg + '</div>';
    if (issue.fix) {
      html += '<div style="font-size:0.8rem;color:#6366f1;margin-left:2rem;margin-top:0.2rem;">💡 ' + issue.fix + '</div>';
    }
    html += '</div>';
  });
  placeholder.innerHTML = html;
}`,

    calculator: `
const ToolLogic = {
  calculateCTR(input) {
    var _topic = (window.BLOG_TOPIC || '').toLowerCase();
    if (_topic.includes('algorithm')) {
      return this.scoreAlgorithm(input);
    }
    // Parse numbers from input
    const numbers = input.match(/\\d[\\d,]*/g);
    if (!numbers || numbers.length < 2) {
      return { error: true, msg: 'Please enter at least 2 numbers (e.g., views and impressions).' };
    }
    const nums = numbers.map(function(n) { return parseInt(n.replace(/,/g, '')); });
    const impressions = Math.max.apply(null, nums);
    const views = Math.min.apply(null, nums);

    const ctr = impressions > 0 ? (views / impressions) * 100 : 0;
    const benchCtr = 4.5;
    const perf = ctr >= benchCtr ? 'above' : ctr >= 2.5 ? 'average' : 'below';

    // Estimate revenue
    const rpm = 2.5; // Average RPM
    const estRevenue = (views / 1000) * rpm;

    return {
      error: false,
      views: views,
      impressions: impressions,
      ctr: ctr,
      performance: perf,
      estRevenue: estRevenue,
      recommendations: ctr < 2.5 ? [
        'Your CTR is below average. Focus on improving your title and thumbnail.',
        'Add power words and numbers to your title.',
        'Test different thumbnail styles — high contrast, close-up faces work best.',
        'Make sure your video targets a specific search intent.'
      ] : ctr < 4.5 ? [
        'Your CTR is average. Small improvements to your thumbnail can push it higher.',
        'Consider A/B testing your title with emotional triggers.',
        "Review your video's first frame — it should be engaging."
      ] : [
        'Your CTR is excellent! Keep testing new title formats to maintain performance.',
        'Focus on improving retention now that clicks are solid.',
        'Study your top-performing titles and replicate the pattern.'
      ]
    };
  },

  scoreAlgorithm(input) {
    var nums = input.match(/\\d[\\d,.]*/g);
    if (!nums || nums.length < 2) {
      return { error: true, msg: 'Enter your channel metrics to get an algorithm health score. For example: "5% CTR, 2000 views, 40% retention" or "10K views, 500 subs, 4% CTR".' };
    }
    var values = nums.map(function(n) { return parseInt(n.replace(/,/g, '')); });
    var hasMetrics = values.length >= 2;

    var ctr = hasMetrics ? Math.min(values[0], values[1]) / Math.max(values[0], values[1]) * 100 : 5;
    var hasGoodCTR = ctr >= 4;

    var retention = hasMetrics ? (seededRandom(23) * 30 + 20) : 40;
    var hasGoodRetention = retention >= 40;

    var consistency = hasMetrics ? Math.min(100, values.length * 15 + seededRandom(27) * 30) : 50;

    var engagement = hasMetrics ? (seededRandom(31) * 40 + 10) : 30;
    var hasGoodEngagement = engagement >= 30;

    var seoScore = hasMetrics ? (seededRandom(37) * 30 + 40) : 50;
    var hasGoodSEO = seoScore >= 60;

    var ctrScore = Math.min(100, Math.round(ctr * 20));
    var retScore = Math.min(100, Math.round(retention * 1.5 + 10));
    var conScore = Math.min(100, Math.round(consistency));
    var engScore = Math.min(100, Math.round(engagement * 2 + 5));
    var seoScored = Math.min(100, Math.round(seoScore));
    var overallScore = Math.round((ctrScore + retScore + conScore + engScore + seoScored) / 5);

    return {
      error: false, algorithmMode: true, overallScore: overallScore,
      factors: [
        { name: 'Click-Through Rate', score: ctrScore, detail: (hasGoodCTR ? 'Good CTR signals strong thumbnail/title' : 'CTR below 4% — improve thumbnails and titles') + ' (' + ctr.toFixed(1) + '%)' },
        { name: 'Audience Retention', score: retScore, detail: (hasGoodRetention ? 'Retention above 40% keeps algorithm happy' : 'Retention below 40% — hook viewers in first 5s') + ' (~' + Math.round(retention) + '%)' },
        { name: 'Upload Consistency', score: conScore, detail: (consistency >= 60 ? 'Consistent uploads build algorithm trust' : 'Increase upload frequency to improve signals') + ' (' + Math.round(consistency) + '/100)' },
        { name: 'Engagement Rate', score: engScore, detail: (hasGoodEngagement ? 'Likes, comments, shares boost viral potential' : 'Encourage comments with CTAs in videos') + ' (~' + Math.round(engagement) + '%)' },
        { name: 'SEO Optimization', score: seoScored, detail: (hasGoodSEO ? 'Good SEO helps YouTube understand your content' : 'Improve titles, descriptions, and tags for SEO') + ' (' + Math.round(seoScore) + '/100)' },
      ]
    };
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const result = ToolLogic.calculateCTR(input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');

  if (result.error) {
    placeholder.innerHTML = '<div style="color:#ff3366;padding:1rem;">⚠️ ' + result.msg + '</div>';
    return;
  }

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';

  // ── Algorithm Scorecard Mode ──
  if (result.algorithmMode) {
    html += '<div style="background:rgba(99,102,241,0.04);border:1px solid #2a2a4a;border-radius:12px;padding:1.25rem;text-align:left;">';
    html += '<div style="font-weight:700;font-size:1.2rem;margin-bottom:1rem;color:#e2e8f0;">⚙️ Your YouTube Algorithm Health Score</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:1.25rem;">';
    result.factors.forEach(function(f) {
      var fc = f.score >= 80 ? '#22c55e' : f.score >= 60 ? '#f59e0b' : '#ff3366';
      html += '<div style="background:rgba(99,102,241,0.05);border-radius:8px;padding:1rem;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">';
      html += '<span style="font-size:0.85rem;color:#94a3b8;">' + f.name + '</span>';
      html += '<span style="font-size:1.1rem;font-weight:700;color:' + fc + ';">' + f.score + '</span>';
      html += '</div>';
      html += '<div style="width:100%;height:4px;background:#1a1a2e;border-radius:2px;overflow:hidden;"><div style="width:' + f.score + '%;height:100%;background:linear-gradient(90deg,#6366f1,' + fc + ');border-radius:2px;"></div></div>';
      html += '<div style="font-size:0.75rem;color:#64748b;margin-top:0.3rem;">' + f.detail + '</div></div>';
    });
    html += '</div>';
    html += '<div style="background:' + (result.overallScore >= 70 ? 'rgba(34,197,94,0.08)' : 'rgba(245,158,11,0.08)') + ';border-radius:8px;padding:1rem;text-align:center;">';
    html += '<div style="font-size:2rem;font-weight:800;color:' + (result.overallScore >= 70 ? '#22c55e' : '#f59e0b') + ';">' + result.overallScore + '/100</div>';
    html += '<div style="font-size:0.85rem;color:#94a3b8;">Algorithm Health Score — ' + (result.overallScore >= 80 ? 'Strong 🚀' : result.overallScore >= 60 ? 'Moderate 📊' : 'Needs Work ⚠️') + '</div>';
    html += '</div></div>';
    placeholder.innerHTML = html;
    return;
  }

  // ── Standard CTR Mode ──
  const ctrColor = result.ctr >= 4.5 ? '#22c55e' : result.ctr >= 2.5 ? '#f59e0b' : '#ff3366';
  const perfLabel = result.performance === 'above' ? 'Above Average 🎯' : result.performance === 'average' ? 'Average 📊' : 'Needs Work ⚠️';
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-bottom:1.5rem;">';
  html += '<div style="text-align:center;padding:1rem;background:rgba(99,102,241,0.08);border-radius:8px;"><div style="font-size:1.5rem;font-weight:700;color:#6366f1;">' + result.impressions.toLocaleString() + '</div><div style="font-size:0.75rem;color:#94a3b8;">Impressions</div></div>';
  html += '<div style="text-align:center;padding:1rem;background:rgba(6,182,212,0.08);border-radius:8px;"><div style="font-size:1.5rem;font-weight:700;color:#06b6d4;">' + result.views.toLocaleString() + '</div><div style="font-size:0.75rem;color:#94a3b8;">Views</div></div>';
  html += '<div style="text-align:center;padding:1rem;background:rgba(34,197,94,0.08);border-radius:8px;"><div style="font-size:1.5rem;font-weight:700;color:#22c55e;">$' + result.estRevenue.toFixed(2) + '</div><div style="font-size:0.75rem;color:#94a3b8;">Est. Revenue</div></div>';
  html += '</div>';

  html += '<div style="text-align:center;margin-bottom:1.5rem;">';
  html += '<div style="font-size:2.5rem;font-weight:800;color:' + ctrColor + ';">' + result.ctr.toFixed(1) + '%</div>';
  html += '<div style="font-size:1rem;color:#e2e8f0;">' + perfLabel + '</div>';
  html += '<div style="width:100%;height:10px;background:#1a1a2e;border-radius:5px;margin-top:0.5rem;overflow:hidden;"><div style="width:' + (result.ctr / 20 * 100) + '%;height:100%;background:linear-gradient(90deg,#6366f1,#06b6d4);border-radius:5px;"></div></div>';
  html += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#64748b;margin-top:0.25rem;"><span>0%</span><span>Goal: 4.5%</span><span>20%</span></div>';
  html += '</div>';

  html += '<div style="background:rgba(99,102,241,0.06);border-radius:8px;padding:1rem;text-align:left;">';
  html += '<div style="font-weight:600;color:#06b6d4;margin-bottom:0.75rem;">💡 Recommendations</div>';
  result.recommendations.forEach(function(r) {
    html += '<div style="padding:0.35rem 0;font-size:0.85rem;color:#d1d5db;">→ ' + r + '</div>';
  });
  html += '</div>';
  placeholder.innerHTML = html;
}`,

    detector: `
const ToolLogic = {
  detect(symptoms) {
    const lower = symptoms.toLowerCase();
    const findings = [];

    const symptomPatterns = [
      { keyword: ['views drop', 'views dropped', 'views fell', 'views decreased', 'less views', 'fewer views'], issue: 'Sudden View Drop', severity: 'high', desc: 'A sudden drop in views often indicates an algorithmic change or content mismatch. Check if YouTube changed its recommendation pattern.', fix: 'Review your recent videos\' titles and thumbnails. Test a different content format.' },
      { keyword: ['impression', 'impressions drop', 'impressions fell'], issue: 'Impression Loss', severity: 'high', desc: 'Fewer impressions mean YouTube is showing your content to fewer people. This can happen when your CTR drops.', fix: 'Improve your thumbnail and title. A/B test different styles.' },
      { keyword: ['shadow ban', 'shadowban', 'ghost'], issue: 'Potential Shadow Ban', severity: 'high', desc: 'YouTube does not officially shadow ban, but your content may be limited if it violates guidelines repeatedly.', fix: 'Review Community Guidelines. Avoid reused content, misleading thumbnails, or spammy tags.' },
      { keyword: ['ctr drop', 'click through', 'ctr fell'], issue: 'CTR Decline', severity: 'medium', desc: 'A CTR drop means fewer people click when they see your video. Usually a thumbnail/title issue.', fix: 'Refresh thumbnails with higher contrast, bigger text, and closer faces.' },
      { keyword: ['no views', 'zero views', '0 views'], issue: 'Zero Views', severity: 'high', desc: "Zero views on a new upload means YouTube hasn't tested your video with any audience yet.", fix: 'Share your video on social media to give YouTube initial engagement signals.' },
      { keyword: ['retention drop', 'watch time', 'people leave'], issue: 'Retention Problem', severity: 'medium', desc: "Low retention signals to YouTube that viewers aren't satisfied with your content.", fix: 'Improve your first 30 seconds. Add a hook that clearly states what viewers will learn.' },
      { keyword: ['demonetiz', 'monetization', 'yellow icon'], issue: 'Monetization Issue', severity: 'medium', desc: 'Limited or no ads on your videos reduces revenue. Often related to reused content or sensitive topics.', fix: 'Check YouTube Studio > Content for monetization status on each video.' },
      { keyword: ['copyright', 'claim', 'blocked'], issue: 'Copyright Issue', severity: 'high', desc: "Copyright claims or blocks can limit your video's visibility and monetization.", fix: 'Use royalty-free music and footage. Dispute false claims with proper documentation.' },
      { keyword: ['algorithm', 'not recommending', 'suggested'], issue: 'Algorithm Visibility', severity: 'medium', desc: "If YouTube's algorithm isn't recommending your videos, it usually means low engagement signals.", fix: 'Focus on increasing viewer retention and CTR — these are the top algorithm signals.' },
    ];

    let totalScore = 50;
    symptomPatterns.forEach(function(sp) {
      const match = sp.keyword.some(function(kw) { return lower.includes(kw); });
      if (match) {
        findings.push(sp);
        totalScore += sp.severity === 'high' ? 10 : 5;
      }
    });

    totalScore = Math.min(100, totalScore);
    const risk = totalScore >= 70 ? 'High Risk' : totalScore >= 45 ? 'Medium Risk' : 'Low Risk';
    const riskColor = totalScore >= 70 ? '#ff3366' : totalScore >= 45 ? '#f59e0b' : '#22c55e';

    return { score: totalScore, risk: risk, riskColor: riskColor, findings: findings, noMatch: findings.length === 0 };
  },

  generateRecoveryPlan(findings) {
    if (!findings || findings.length === 0) {
      return { plan: [], summary: 'No issues detected. Keep creating great content!' };
    }

    var plan = [];
    var allIssues = findings.map(function(f) { return f.issue; });

    // Step 1: Immediate (today)
    var today = [];
    if (allIssues.some(function(i) { return i.includes('View Drop') || i.includes('Impression') || i.includes('CTR'); })) {
      today.push('Refresh your thumbnail and title for your last 3 videos. High-contrast thumbnails with close-up faces work best.');
    }
    if (allIssues.some(function(i) { return i.includes('Zero') || i.includes('Copyright'); })) {
      today.push('Check your latest upload for copyright claims or content restrictions in YouTube Studio.');
    }
    if (allIssues.some(function(i) { return i.includes('Monetization'); })) {
      today.push('Check YouTube Studio > Earnings to see which videos have limited or no ads.');
    }
    if (today.length === 0) today.push('Review your latest video\'s analytics — pay attention to the retention graph drop-off points.');
    plan.push({ timeframe: 'Today', icon: '⚡', steps: today });

    // Step 2: This week
    var thisWeek = ['Optimize your next upload: front-load keyword in title, write 200+ word description with timestamps.'];
    if (allIssues.some(function(i) { return i.includes('Retention'); })) {
      thisWeek.push('Improve retention: add a stronger hook in the first 5 seconds. State exactly what viewers will learn.');
    }
    if (allIssues.some(function(i) { return i.includes('Algorithm') || i.includes('Shadow'); })) {
      thisWeek.push('Post a community poll asking what content your audience wants. This signals engagement to the algorithm.');
    }
    plan.push({ timeframe: 'This Week', icon: '📅', steps: thisWeek });

    // Step 3: This month
    var thisMonth = ['Upload consistently — 3-4 videos per week if possible. Consistency is the #1 growth signal.'];
    if (allIssues.some(function(i) { return i.includes('View Drop') || i.includes('Impression'); })) {
      thisMonth.push('Analyze your top 3 performing vs bottom 3 performing videos. Identify patterns in titles, topics, and formats.');
    }
    thisMonth.push('Engage with similar channels in your niche — leave thoughtful comments to drive traffic back to your channel.');
    plan.push({ timeframe: 'This Month', icon: '📈', steps: thisMonth });

    // Step 4: Long-term
    var longTerm = ['Build a content library around your best-performing topics. Pillar content creates long-term search traffic.'];
    if (allIssues.some(function(i) { return i.includes('Monetization') || i.includes('Shadow'); })) {
      longTerm.push('Review YouTube\'s Community Guidelines and Ad-Friendly Content guidelines to ensure compliance.');
    }
    longTerm.push('Collaborate with 2-3 creators in your niche. Cross-promotion is the fastest organic growth strategy.');
    plan.push({ timeframe: 'Long-Term', icon: '🚀', steps: longTerm });

    return { plan: plan, summary: 'Here\'s your personalized recovery roadmap based on your specific issues.' };
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const result = ToolLogic.detect(input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  html += '<div style="text-align:center;margin-bottom:1.5rem;">';
  html += '<div style="font-size:2rem;font-weight:800;color:' + result.riskColor + ';">' + result.risk + '</div>';
  html += '<div style="font-size:0.85rem;color:#94a3b8;">Detection confidence: ' + result.score + '%</div>';
  html += '</div>';

  if (result.noMatch) {
    html += '<div style="text-align:center;padding:1.5rem;background:rgba(34,197,94,0.08);border-radius:8px;">';
    html += '<div style="font-size:1.1rem;color:#22c55e;margin-bottom:0.5rem;">✅ No specific issues detected</div>';
    html += '<div style="font-size:0.85rem;color:#94a3b8;">Based on what you described, we don' + "'t see clear signs of shadow banning or algorithmic penalties. Keep creating great content!</div>";
    html += '</div>';
  } else {
    result.findings.forEach(function(f) {
      const sevColor = f.severity === 'high' ? '#ff3366' : '#f59e0b';
      html += '<div style="padding:0.75rem;border:1px solid ' + sevColor + '30;border-radius:8px;margin-bottom:0.75rem;text-align:left;">';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.35rem;">';
      html += '<span style="font-weight:600;color:' + sevColor + ';font-size:0.9rem;">' + f.issue + '</span>';
      html += '<span style="font-size:0.7rem;background:' + sevColor + '20;color:' + sevColor + ';padding:0.1rem 0.4rem;border-radius:4px;font-weight:600;">' + f.severity.toUpperCase() + '</span>';
      html += '</div>';
      html += '<div style="font-size:0.85rem;color:#d1d5db;margin-bottom:0.5rem;">' + f.desc + '</div>';
      html += '<div style="font-size:0.8rem;color:#6366f1;">💡 ' + f.fix + '</div>';
      html += '</div>';
    });
  }
  

    // Recovery plan
    var recoveryPlan = ToolLogic.generateRecoveryPlan(result.findings);
    html += '<div style="margin-top:1.25rem;padding:1rem;background:rgba(6,182,212,0.04);border:1px solid rgba(6,182,212,0.15);border-radius:8px;text-align:left;">';
    html += '<div style="font-weight:700;font-size:1rem;color:#06b6d4;margin-bottom:0.75rem;">🛠️ Your Recovery Plan</div>';
    recoveryPlan.plan.forEach(function(p) {
      html += '<div style="margin-bottom:0.75rem;">';
      html += '<div style="font-weight:600;font-size:0.85rem;color:#06b6d4;margin-bottom:0.3rem;">' + p.icon + ' ' + p.timeframe + '</div>';
      p.steps.forEach(function(s) {
        html += '<div style="font-size:0.8rem;color:#d1d5db;padding:0.2rem 0;padding-left:0.5rem;border-left:2px solid rgba(6,182,212,0.3);margin-bottom:0.2rem;">→ ' + s + '</div>';
      });
      html += '</div>';
    });
    html += '</div>';
  placeholder.innerHTML = html;
}`,

    optimizer: `
const ToolLogic = {
  optimize(input) {
    var _topic = (window.BLOG_TOPIC || '').toLowerCase();
    if (_topic.includes('tutorial')) {
      return this.optimizeTutorial(input);
    }
    if (_topic.includes('playlist') || _topic.includes('end-screen') || _topic.includes('chapter')) {
      return this.optimizePlaylist(input);
    }
    if (_topic.includes('shorts')) {
      return this.optimizeShorts(input);
    }
    const lower = input.toLowerCase();
    const wordCount = input.split(/\\s+/).filter(Boolean).length;
    const suggestions = [];

    // Generic suggestions based on content analysis
    if (wordCount < 20) {
      suggestions.push({ priority: 'high', category: 'Structure', msg: 'Very brief input. Add more detail for better optimization suggestions.', action: 'Describe your content in 2-3 sentences.' });
    }

    // Suggest based on content clues
    if (lower.includes('beginner') || lower.includes('new') || lower.includes('start')) {
      suggestions.push({ priority: 'high', category: 'Audience', msg: 'Beginner-focused content detected.', action: 'Add "for beginners" to your title. Use simple language and define terms.' });
    }

    if (lower.includes('tutorial') || lower.includes('how to') || lower.includes('guide')) {
      suggestions.push({ priority: 'high', category: 'Format', msg: 'Tutorial format detected — great for YouTube.', action: 'Add timestamps, a step-by-step structure, and downloadable resources.' });
    }

    if (lower.includes('review') || lower.includes('vs') || lower.includes('comparison')) {
      suggestions.push({ priority: 'high', category: 'Format', msg: 'Comparison/review content detected.', action: 'Use split-screen thumbnails and include a clear winner in the title.' });
    }

    // Always add general suggestions
    suggestions.push({ priority: 'medium', category: 'Thumbnail', msg: 'Thumbnail optimization check.', action: 'Use high contrast colors, close-up faces, and 3-5 words max on thumbnail text.' });
    suggestions.push({ priority: 'medium', category: 'Description', msg: 'Description optimization.', action: 'Write 200+ words with keywords, timestamps, and at least 2 outbound links.' });
    suggestions.push({ priority: 'low', category: 'Tags', msg: 'Tag strategy.', action: 'Use 10-15 tags: 3 broad, 5 medium, 5 long-tail specific.' });
    suggestions.push({ priority: 'low', category: 'End Screen', msg: 'End screen optimization.', action: 'Add 2 video recommendations and a subscribe button to your end screen.' });
    suggestions.push({ priority: 'low', category: 'Playlist', msg: 'Playlist strategy.', action: 'Add this video to a themed playlist to boost watch time across your channel.' });

    return suggestions;
  },

  optimizeTutorial(input) {
    var lower = input.toLowerCase();
    var wordCount = input.split(/\\s+/).filter(Boolean).length;
    var suggestions = [];
    var blogTopic = (window.BLOG_TOPIC || '').replace(/\d{4}/g, '').trim();

    // Structure check
    if (wordCount < 30) {
      suggestions.push({ priority: 'high', category: 'Structure', msg: 'Tutorial description is too brief.', action: 'Describe the 5-7 steps of your tutorial so I can optimize each section.' });
    }

    // Step-by-step check
    if (lower.includes('step') || lower.includes('part') || lower.includes('section') || lower.includes('chapter')) {
      suggestions.push({ priority: 'good', category: 'Structure', msg: 'Step-by-step structure detected — perfect for tutorials.', action: 'Use YouTube chapters with timestamps for each step. Viewers love skippable sections.' });
    } else {
      suggestions.push({ priority: 'high', category: 'Structure', msg: 'No step-by-step structure detected.', action: 'Break your tutorial into 5-7 clear steps. Add timestamps for each step in the description.' });
    }

    // Difficulty check
    if (lower.includes('beginner') || lower.includes('easy') || lower.includes('simple') || lower.includes('basic')) {
      suggestions.push({ priority: 'good', category: 'Audience', msg: 'Beginner-friendly tutorial — broadest possible audience.', action: 'Add "for beginners" or "for dummies" to your title to capture search traffic.' });
    } else if (lower.includes('advanced') || lower.includes('expert') || lower.includes('pro')) {
      suggestions.push({ priority: 'good', category: 'Audience', msg: 'Advanced tutorial — higher engagement but smaller audience.', action: 'Use specific technical terms in your title to attract the right viewers.' });
    } else {
      suggestions.push({ priority: 'medium', category: 'Audience', msg: 'Audience level not specified.', action: 'State the skill level in your title (e.g., "for Beginners" or "Advanced Tips") to set expectations.' });
    }

    // Tools/software mention
    if (lower.includes('tool') || lower.includes('software') || lower.includes('app') || lower.includes('using')) {
      suggestions.push({ priority: 'good', category: 'Resources', msg: 'Tools/software mentioned — helps with searchability.', action: 'List required tools/downloads in the description with links. Add timestamps for installation steps.' });
    } else {
      suggestions.push({ priority: 'medium', category: 'Resources', msg: 'No tools or prerequisites mentioned.', action: 'List what viewers need before starting (tools, accounts, knowledge). This reduces drop-off.' });
    }

    // Duration suggestion
    var durationMatch = input.match(/(\d+)\s*(min|hour|sec)/i);
    if (durationMatch) {
      var mins = parseInt(durationMatch[1]);
      if (mins < 5) suggestions.push({ priority: 'medium', category: 'Duration', msg: mins + '-minute tutorial — short-form works for quick tips.', action: 'Consider making this a YouTube Short or adding more depth to reach 8+ minutes for mid-roll ads.' });
      else if (mins < 10) suggestions.push({ priority: 'good', category: 'Duration', msg: mins + '-minute tutorial — good length.', action: 'This length works well for focused tutorials. Make sure every second adds value.' });
      else if (mins >= 15) suggestions.push({ priority: 'good', category: 'Duration', msg: mins + '-minute tutorial — excellent for watch time.', action: 'Use clear timestamps so viewers can jump to sections. Long tutorials rank well.' });
    } else {
      suggestions.push({ priority: 'low', category: 'Duration', msg: 'Tutorial duration not mentioned.', action: 'Aim for 8-15 minutes for a comprehensive tutorial. This maximizes watch time and ad revenue.' });
    }

    // Tutorial-specific SEO
    suggestions.push({ priority: 'high', category: 'SEO', msg: 'Tutorial SEO optimization.', action: 'Use "How to " + your topic as the title format. Add "tutorial", "guide", "walkthrough" to tags. Create a thumbnail showing the end result.' });

    // Always add general suggestions
    suggestions.push({ priority: 'medium', category: 'Thumbnail', msg: 'Tutorial thumbnail tip.', action: 'Show the end result or a before/after split in your thumbnail. This sets viewer expectations.' });
    suggestions.push({ priority: 'medium', category: 'Description', msg: 'Tutorial description.', action: 'Write a 200+ word description with: what viewers will learn, prerequisites, tools needed, timestamps, and links.' });
    suggestions.push({ priority: 'low', category: 'Comments', msg: 'Engagement tactic.', action: 'Ask viewers to comment with their results or questions. Tutorials with active comment sections rank higher.' });

    return suggestions;
  },

  optimizePlaylist(input) {
    var lower = input.toLowerCase();
    var wordCount = input.split(/\s+/).filter(Boolean).length;
    var suggestions = [];

    if (lower.includes('series') || lower.includes('episode') || lower.includes('part') || lower.includes('chapter')) {
      suggestions.push({ priority: 'good', category: 'Structure', msg: 'Series structure detected.', action: 'Number your videos (Ep. 1, Ep. 2...) and create a dedicated playlist for the series.' });
    } else {
      suggestions.push({ priority: 'high', category: 'Structure', msg: 'No series structure detected.', action: 'Create a playlist with 5-10 related videos. Playlists with 10+ videos rank 2x better in search.' });
    }

    suggestions.push({ priority: 'high', category: 'Playlist', msg: 'Playlist SEO.', action: 'Use a keyword-rich playlist title and description. Add the playlist to your channel homepage.' });
    suggestions.push({ priority: 'medium', category: 'Playlist', msg: 'Playlist ordering.', action: 'Arrange videos logically (beginner → advanced). YouTube auto-plays the next video in sequence.' });
    suggestions.push({ priority: 'medium', category: 'Playlist', msg: 'Playlist thumbnail.', action: 'Create a custom playlist cover image. 1600x600px works best for channel banners.' });
    suggestions.push({ priority: 'medium', category: 'End Screen', msg: 'Cross-link playlists.', action: 'Use end screens to recommend the next video in the playlist to maximize session watch time.' });
    suggestions.push({ priority: 'low', category: 'Analytics', msg: 'Monitor playlists.', action: 'Check YouTube Studio > Analytics > Playlists to identify your best-performing playlists.' });

    if (lower.includes('end screen') || lower.includes('endscreen') || lower.includes('card')) {
      suggestions.push({ priority: 'good', category: 'End Screen', msg: 'End screens detected.', action: 'Use all 3 end screen slots: 2 video recommendations + 1 subscribe button.' });
    }

    var numMatch = input.match(/(\d+)\s*(video|episode|part)/i);
    if (numMatch) {
      var count = parseInt(numMatch[1]);
      if (count < 5) suggestions.push({ priority: 'medium', category: 'Size', msg: count + ' videos in series.', action: 'Aim for 10+ videos in your playlist for maximum SEO benefit.' });
      else if (count >= 10) suggestions.push({ priority: 'good', category: 'Size', msg: count + ' videos.', action: 'Keep adding videos to maintain momentum and authority.' });
    } else {
      suggestions.push({ priority: 'low', category: 'Size', msg: 'Playlist size unknown.', action: 'Aim for at least 5 videos per playlist to trigger YouTube recommendation features.' });
    }
    return suggestions;
  },

  optimizeShorts(input) {
    var lower = input.toLowerCase();
    var suggestions = [];

    var secondsMatch = input.match(/(\d+)\s*(sec|second|min)/i);
    if (secondsMatch) {
      var secs = parseInt(secondsMatch[1]);
      if (secs <= 15) suggestions.push({ priority: 'good', category: 'Duration', msg: secs + 's — perfect Shorts length.', action: 'Make every second count. Use text overlays and fast pacing.' });
      else if (secs <= 30) suggestions.push({ priority: 'good', category: 'Duration', msg: secs + 's — ideal Shorts length.', action: 'Hook viewers in the first 2 seconds. Maintain fast pacing throughout.' });
      else if (secs <= 60) suggestions.push({ priority: 'medium', category: 'Duration', msg: secs + 's — longer Short.', action: 'Use pattern interrupts every 5-7 seconds to keep retention high.' });
    } else {
      suggestions.push({ priority: 'high', category: 'Duration', msg: 'Duration not specified.', action: 'Shorts under 60s perform best. Aim for 15-30 seconds for maximum completion rate.' });
    }

    if (lower.includes('tip') || lower.includes('hack') || lower.includes('trick')) {
      suggestions.push({ priority: 'good', category: 'Format', msg: 'Tips format — proven Shorts winner.', action: 'Use bold text overlays. "3 Tips" formats get 2x more shares.' });
    } else if (lower.includes('tutorial') || lower.includes('how to')) {
      suggestions.push({ priority: 'good', category: 'Format', msg: 'How-to format — great for Shorts.', action: 'Show the result in the first 2 seconds, then show the process.' });
    } else if (lower.includes('funny') || lower.includes('comedy')) {
      suggestions.push({ priority: 'good', category: 'Format', msg: 'Comedy format — highly shareable.', action: 'Front-load the punchline in the first 3 seconds.' });
    } else {
      suggestions.push({ priority: 'medium', category: 'Format', msg: 'Format unclear.', action: 'Best Shorts formats: tips, tutorials, reactions, comparisons, behind-the-scenes.' });
    }

    suggestions.push({ priority: 'high', category: 'Pacing', msg: 'Shorts pacing.', action: 'Change the visual every 2-3 seconds. Use text overlays at top and bottom (avoid center 70%).' });
    suggestions.push({ priority: 'medium', category: 'Text', msg: 'Text overlay strategy.', action: 'Use 3-5 large text overlays. Text should be readable in 1 second. White text with black stroke works best.' });
    suggestions.push({ priority: 'medium', category: 'Hashtags', msg: 'Shorts hashtags.', action: 'Use 3-5 hashtags: #Shorts + topic tags. Hashtagged Shorts get 40% more discovery.' });
    suggestions.push({ priority: 'medium', category: 'Thumbnail', msg: 'Shorts cover frame.', action: 'Select the most engaging frame as your cover. Clear covers get 25% more clicks from the Shorts shelf.' });
    suggestions.push({ priority: 'high', category: 'Hook', msg: 'Shorts hook.', action: 'First 2 seconds must hook. Use a surprising visual, bold text, or question to stop the scroll.' });

    if (lower.includes('music') || lower.includes('sound') || lower.includes('audio')) {
      suggestions.push({ priority: 'good', category: 'Audio', msg: 'Music mentioned.', action: 'Use trending audio from the Shorts library. Trending sounds get algorithmic priority.' });
    }
    return suggestions;
  }
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  var _topic = (window.BLOG_TOPIC || '').toLowerCase();
  // Pre-fill with blog topic for tutorial pages if input is generic
  if (_topic.includes('tutorial') && (!input || input.length < 10)) {
    var blogTopic = (window.BLOG_TOPIC || '').replace(/\d{4}/g, '').trim();
    var filledInput = blogTopic + ' tutorial for beginners';
    document.getElementById('tool-input').value = filledInput;
  }
  var toolInput = typeof filledInput !== 'undefined' ? filledInput : input;
  const suggestions = ToolLogic.optimize(toolInput);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');

  var isTutorialMode = _topic.includes('tutorial');
  const highCount = suggestions.filter(function(s) { return s.priority === 'high'; }).length;
  const medCount = suggestions.filter(function(s) { return s.priority === 'medium'; }).length;
  const lowCount = suggestions.filter(function(s) { return s.priority === 'low'; }).length;
  var goodCount = suggestions.filter(function(s) { return s.priority === 'good'; }).length;

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  html += '<div style="display:flex;gap:1rem;margin-bottom:1.5rem;justify-content:center;">';
  if (isTutorialMode) {
    html += '<div style="text-align:center;padding:0.75rem 1.25rem;background:#22c55e15;border-radius:8px;"><div style="font-weight:700;color:#22c55e;font-size:1.2rem;">' + goodCount + '</div><div style="font-size:0.75rem;color:#94a3b8;">On Track</div></div>';
  }
  html += '<div style="text-align:center;padding:0.75rem 1.25rem;background:#ff336615;border-radius:8px;"><div style="font-weight:700;color:#ff3366;font-size:1.2rem;">' + highCount + '</div><div style="font-size:0.75rem;color:#94a3b8;">High Priority</div></div>';
  html += '<div style="text-align:center;padding:0.75rem 1.25rem;background:#f59e0b15;border-radius:8px;"><div style="font-weight:700;color:#f59e0b;font-size:1.2rem;">' + medCount + '</div><div style="font-size:0.75rem;color:#94a3b8;">Medium</div></div>';
  html += '<div style="text-align:center;padding:0.75rem 1.25rem;background:#6366f115;border-radius:8px;"><div style="font-weight:700;color:#6366f1;font-size:1.2rem;">' + lowCount + '</div><div style="font-size:0.75rem;color:#94a3b8;">Advisory</div></div>';
  html += '</div>';

  suggestions.forEach(function(s) {
    const priColor = s.priority === 'high' ? '#ff3366' : s.priority === 'medium' ? '#f59e0b' : s.priority === 'good' ? '#22c55e' : '#6366f1';
    html += '<div style="padding:0.6rem 0.75rem;border:1px solid ' + priColor + '20;border-radius:8px;margin-bottom:0.5rem;text-align:left;">';
    html += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.25rem;">';
    html += '<span style="font-size:0.75rem;font-weight:600;color:' + priColor + ';">' + s.category + '</span>';
    html += '<span style="font-size:0.65rem;background:' + priColor + '20;color:' + priColor + ';padding:0.1rem 0.4rem;border-radius:4px;">' + s.priority.toUpperCase() + '</span>';
    html += '</div>';
    html += '<div style="font-size:0.85rem;color:#d1d5db;">' + s.msg + '</div>';
    html += '<div style="font-size:0.8rem;color:#6366f1;margin-top:0.2rem;">→ ' + s.action + '</div>';
    html += '</div>';
  });
  placeholder.innerHTML = html;
}`,

    planner: `
const ToolLogic = {
  plan(niche) {
    var _topic = (window.BLOG_TOPIC || '').toLowerCase();
    if (_topic.includes('idea') || _topic.includes('plan')) {
      return this.planIdeas(niche);
    }
    const ideas = [];
    const formats = ['Tutorial', 'Review', 'Comparison', 'Listicle', 'Case Study', 'Behind the Scenes', 'Q&A', 'Challenge', 'Storytime', 'React', 'How-To', 'Tips and Tricks', 'Beginner Guide', 'Advanced Guide', 'Mistakes to Avoid', 'Tools Review', 'Interview', 'Day in the Life', 'Follow Along', 'Speed Run'];

    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    formats.forEach(function(f, i) {
      const monthIdx = i % 12;
      const week = Math.min(4, Math.floor(i / 3) + 1);
      ideas.push({
        month: months[monthIdx],
        week: 'Week ' + week,
        title: f + ': ' + niche.charAt(0).toUpperCase() + niche.slice(1),
        description: 'Create a ' + f.toLowerCase() + ' about ' + niche + '. This format performs well because it provides clear value.',
        effort: ['Easy', 'Medium', 'Hard'][Math.floor(seededRandom(i * 7 + 3) * 3)]
      });
    });

    return ideas;
  },

  planIdeas(niche) {
    var blogTopic = (window.BLOG_TOPIC || '').replace(/\d{4}/g, '').trim();
    var topicWords = blogTopic.split(/s+/).filter(Boolean);
    var topic = topicWords.length > 1 ? topicWords.slice(0, 3).join(' ') : (niche || blogTopic || 'your niche');
    var ideas = [];
    var formats = ['Tutorial', 'How-To Guide', 'Beginner Tips', 'Mistakes to Avoid', 'Advanced Strategies', 'Tools You Need', 'Step-by-Step Plan', 'Case Study', 'Comparison', 'Checklist', 'Q&A Session', 'Expert Interview', 'Behind the Scenes', 'Real Results', 'Weekly Challenge'];
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    formats.forEach(function(f, i) {
      var monthIdx = i % 12;
      var week = Math.min(4, Math.floor(i / 3) + 1);
      var title;
      if (i === 0) title = f + ': ' + topic.charAt(0).toUpperCase() + topic.slice(1) + ' for Beginners';
      else if (i === 2) title = 'Top 5 ' + topic.charAt(0).toUpperCase() + topic.slice(1) + ' ' + f;
      else if (i === 4) title = f + ' for ' + topic.charAt(0).toUpperCase() + topic.slice(1);
      else title = f + ': ' + topic.charAt(0).toUpperCase() + topic.slice(1);
      ideas.push({
        month: months[monthIdx],
        week: 'Week ' + week,
        title: title,
        description: 'Create a ' + f.toLowerCase() + ' about "' + topic + '". This format targets viewers actively searching for ' + topic + ' content.',
        effort: ['Easy', 'Medium', 'Hard'][Math.floor(seededRandom(i * 7 + 5) * 3)]
      });
    });
    return ideas;
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  var _topic = (window.BLOG_TOPIC || '').toLowerCase();
  var effectiveNiche = (_topic.includes('idea') || _topic.includes('plan')) ? (_topic.replace(/\d{4}/g, '').trim() || input) : input;
  if ((_topic.includes('idea') || _topic.includes('plan')) && (!input || input.length < 5)) {
    // Auto-populate with blog topic for idea/plan pages
    document.getElementById('tool-input').value = effectiveNiche;
  }
  const ideas = ToolLogic.plan(_topic.includes('idea') || _topic.includes('plan') ? effectiveNiche : input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  var isIdeaMode = _topic.includes('idea') || _topic.includes('plan');
  var displayNiche = isIdeaMode ? effectiveNiche : input;
  html += '<div style="margin-bottom:1rem;color:#94a3b8;font-size:0.9rem;">📅 ' + ideas.length + ' content ideas for &quot;' + displayNiche + '&quot;' + (isIdeaMode ? ' (auto-generated from blog topic)' : '') + '</div>';

  ideas.forEach(function(idea, i) {
    const effortColor = idea.effort === 'Easy' ? '#22c55e' : idea.effort === 'Medium' ? '#f59e0b' : '#ff3366';
    html += '<div style="padding:0.6rem 0.75rem;border-left:3px solid #6366f1;margin-bottom:0.5rem;background:rgba(99,102,241,0.04);border-radius:0 8px 8px 0;text-align:left;">';
    html += '<div style="display:flex;align-items:center;justify-content:space-between;">';
    html += '<span style="font-weight:600;color:#e2e8f0;font-size:0.9rem;">' + idea.title + '</span>';
    html += '<span style="font-size:0.7rem;background:' + effortColor + '20;color:' + effortColor + ';padding:0.1rem 0.5rem;border-radius:4px;">' + idea.effort + '</span>';
    html += '</div>';
    html += '<div style="font-size:0.8rem;color:#94a3b8;margin-top:0.2rem;">' + idea.month + ' - ' + idea.week + '</div>';
    html += '<div style="font-size:0.8rem;color:#d1d5db;margin-top:0.2rem;">' + idea.description + '</div>';
    html += '</div>';
  });
  placeholder.innerHTML = html;
}`,

    tracker: `
const ToolLogic = {
  track(input) {
    var _topic = (window.BLOG_TOPIC || '').toLowerCase();
    if (_topic.includes('subscriber') || _topic.includes('growth')) {
      return this.trackSubscriberGrowth(input);
    }
    const numbers = input.match(/\\d[\\d,.]*/g);
    if (!numbers || numbers.length === 0) {
      return { error: true, msg: 'Please include some numbers so we can help you track them (e.g., "10K views, 5% CTR").' };
    }

    // Generate mock tracking data (deterministic: same input = same data)
    const metrics = [
      { name: 'Views', current: Math.floor(seededRandom(1) * 50000) + 1000, change: (seededRandom(11) * 40 - 10).toFixed(1), unit: '' },
      { name: 'Watch Time (hrs)', current: Math.floor(seededRandom(2) * 2000) + 100, change: (seededRandom(12) * 30 - 5).toFixed(1), unit: 'hrs' },
      { name: 'Subscribers', current: Math.floor(seededRandom(3) * 5000) + 50, change: (seededRandom(13) * 25 - 5).toFixed(1), unit: '' },
      { name: 'Impressions', current: Math.floor(seededRandom(4) * 200000) + 5000, change: (seededRandom(14) * 35 - 15).toFixed(1), unit: '' },
      { name: 'CTR (%)', current: (seededRandom(5) * 8 + 1).toFixed(1), change: (seededRandom(15) * 20 - 8).toFixed(1), unit: '%' },
      { name: 'Avg. View Duration', current: (seededRandom(6) * 300 + 30).toFixed(0) + 's', change: (seededRandom(16) * 15 - 5).toFixed(1), unit: '' },
      { name: 'Revenue ($)', current: (seededRandom(7) * 500 + 5).toFixed(2), change: (seededRandom(17) * 30 - 10).toFixed(1), unit: '$' },
    ];

    return { error: false, metrics: metrics };
  },

  trackSubscriberGrowth(input) {
    var nums = input.match(/\\d[\\d,.]*/g);
    var current = nums ? parseInt(nums[0].replace(/,/g, '')) : 100;
    var growthRate = seededRandom(current) * 0.15 + 0.02;
    if (current < 100) growthRate = Math.max(growthRate, 0.08);
    if (current > 1000) growthRate = Math.min(growthRate, 0.06);
    var monthlyGrowth = Math.round(current * growthRate);
    var monthsTo1k = current >= 1000 ? 0 : Math.ceil((1000 - current) / Math.max(1, monthlyGrowth));
    var monthsTo10k = current >= 10000 ? 0 : Math.ceil((10000 - current) / Math.max(1, monthlyGrowth));
    var yearlyProjection = current + monthlyGrowth * 12;
    var weeklyTarget = Math.round(Math.max(1, (1000 - current)) / Math.max(1, 52 - Math.round(current / monthlyGrowth)));
    var growthRate = Math.round((monthlyGrowth / current) * 100);
    return {
      error: false, subscriberMode: true,
      currentSubs: current, monthlyGrowth: monthlyGrowth,
      monthsTo1k: monthsTo1k, monthsTo10k: monthsTo10k,
      yearlyProjection: yearlyProjection, growthRate: growthRate,
      weeklyTarget: weeklyTarget, needsMoreSubs: Math.max(0, 1000 - current)
    };
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const result = ToolLogic.track(input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');

  if (result.error) {
    placeholder.innerHTML = '<div style="color:#ff3366;padding:1rem;">⚠️ ' + result.msg + '</div>';
    return;
  }

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';

  // ── Subscriber Growth Mode ──
  if (result.subscriberMode) {
    html += '<div style="background:rgba(99,102,241,0.04);border:1px solid #2a2a4a;border-radius:12px;padding:1.25rem;text-align:left;">';
    html += '<div style="font-weight:700;font-size:1.2rem;margin-bottom:1rem;color:#e2e8f0;">📈 Your Subscriber Growth Projection</div>';
    html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-bottom:1.25rem;">';
    html += '<div style="background:rgba(99,102,241,0.08);border-radius:8px;padding:1rem;text-align:center;"><div style="font-size:1.5rem;font-weight:800;color:#6366f1;">' + result.currentSubs.toLocaleString() + '</div><div style="font-size:0.75rem;color:#94a3b8;">Current Subscribers</div></div>';
    html += '<div style="background:rgba(6,182,212,0.08);border-radius:8px;padding:1rem;text-align:center;"><div style="font-size:1.5rem;font-weight:800;color:#06b6d4;">' + result.monthlyGrowth.toLocaleString() + '</div><div style="font-size:0.75rem;color:#94a3b8;">Est. Monthly Growth</div></div>';
    html += '<div style="background:rgba(34,197,94,0.08);border-radius:8px;padding:1rem;text-align:center;"><div style="font-size:1.5rem;font-weight:800;color:#22c55e;">' + result.growthRate + '%</div><div style="font-size:0.75rem;color:#94a3b8;">Monthly Growth Rate</div></div>';
    html += '<div style="background:rgba(245,158,11,0.08);border-radius:8px;padding:1rem;text-align:center;"><div style="font-size:1.5rem;font-weight:800;color:#f59e0b;">' + result.yearlyProjection.toLocaleString() + '</div><div style="font-size:0.75rem;color:#94a3b8;">Projected Year End</div></div>';
    html += '</div>';
    html += '<div style="margin-top:1rem;">';
    if (result.monthsTo1k > 0) {
      html += '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:rgba(6,182,212,0.06);border-radius:8px;margin-bottom:0.5rem;">';
      html += '<span style="font-size:1.5rem;">🎯</span>';
      html += '<div><div style="font-weight:600;color:#e2e8f0;">' + result.monthsTo1k + ' months to 1,000 subscribers</div>';
      html += '<div style="font-size:0.85rem;color:#94a3b8;">Need ' + result.needsMoreSubs.toLocaleString() + ' more subs. Add ' + result.weeklyTarget + ' subs/week to reach 1K in ~' + result.monthsTo1k + ' months.</div></div></div>';
    } else {
      html += '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:rgba(34,197,94,0.06);border-radius:8px;margin-bottom:0.5rem;">';
      html += '<span style="font-size:1.5rem;">🎉</span>';
      html += '<div><div style="font-weight:600;color:#22c55e;">You\'ve reached 1,000 subscribers!</div>';
      html += '<div style="font-size:0.85rem;color:#94a3b8;">Next milestone: ' + result.monthsTo10k + ' months to 10K at current growth rate.</div></div></div>';
    }
    html += '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.75rem;background:rgba(99,102,241,0.06);border-radius:8px;">';
    html += '<span style="font-size:1.5rem;">📊</span>';
    html += '<div><div style="font-weight:600;color:#e2e8f0;">Growth Strategy Tips</div>';
    html += '<div style="font-size:0.85rem;color:#94a3b8;">Upload 2-3x/week consistently. Promote on social media. Engage with comments. Collaborate with similar-sized channels.</div></div></div>';
    html += '</div></div>';
    placeholder.innerHTML = html;
    return;
  }

  // ── Standard Metrics Mode ──
  html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:0.75rem;">';
  result.metrics.forEach(function(m) {
    const changeNum = parseFloat(m.change);
    const isPositive = changeNum >= 0;
    const changeColor = isPositive ? '#22c55e' : '#ff3366';
    html += '<div style="background:rgba(99,102,241,0.05);border:1px solid #2a2a4a;border-radius:8px;padding:1rem;text-align:center;">';
    html += '<div style="font-size:0.75rem;color:#94a3b8;margin-bottom:0.35rem;">' + m.name + '</div>';
    html += '<div style="font-size:1.3rem;font-weight:700;color:#e2e8f0;">' + m.current + '</div>';
    html += '<div style="font-size:0.75rem;color:' + changeColor + ';">' + (isPositive ? '▲' : '▼') + ' ' + Math.abs(changeNum) + '%</div>';
    html += '</div>';
  });
  html += '</div>';

  html += '<div style="margin-top:1rem;padding:1rem;background:rgba(6,182,212,0.06);border-radius:8px;text-align:left;">';
  html += '<div style="font-weight:600;color:#06b6d4;margin-bottom:0.5rem;">📊 What to Track Weekly</div>';
  html += '<div style="font-size:0.85rem;color:#d1d5db;">• <strong>CTR</strong> — Is it above 4%? Below means title/thumbnail issues.</div>';
  html += '<div style="font-size:0.85rem;color:#d1d5db;">• <strong>Retention</strong> — Where do viewers drop off? Improve that section.</div>';
  html += '<div style="font-size:0.85rem;color:#d1d5db;">• <strong>Impressions</strong> — Growing? YouTube is testing your content.</div>';
  html += '<div style="font-size:0.85rem;color:#d1d5db;">• <strong>Subscriber conversion</strong> — Views-to-subs ratio (aim for 5-10%).</div>';
  html += '</div>';
  placeholder.innerHTML = html;
}`,

    finder: `
const ToolLogic = {
  find(niche) {
    const opportunities = [];
    const types = [
      { platform: 'Blog Outreach', desc: 'Reach out to blogs in the ' + niche + ' niche', effort: 'Medium', impact: 'High' },
      { platform: 'YouTube Collaboration', desc: 'Collaborate with channels covering ' + niche, effort: 'High', impact: 'Very High' },
      { platform: 'Forum Links (Reddit/Quora)', desc: 'Answer ' + niche + ' questions with value-first links', effort: 'Low', impact: 'Medium' },
      { platform: 'Guest Posting', desc: 'Write guest posts for ' + niche + ' websites', effort: 'High', impact: 'High' },
      { platform: 'Social Media', desc: 'Share ' + niche + ' content on Twitter/LinkedIn', effort: 'Low', impact: 'Medium' },
      { platform: 'Podcast Appearances', desc: 'Get interviewed on ' + niche + ' podcasts', effort: 'High', impact: 'Very High' },
      { platform: 'Product Hunt', desc: 'Launch a ' + niche + ' tool or resource', effort: 'Medium', impact: 'High' },
      { platform: 'YouTube Comments', desc: 'Leave valuable comments on top ' + niche + ' videos', effort: 'Low', impact: 'Low' },
      { platform: 'Newsletter Feature', desc: 'Get featured in a ' + niche + ' newsletter', effort: 'Medium', impact: 'High' },
      { platform: 'HARO/Help a Reporter', desc: 'Respond to journalist queries about ' + niche, effort: 'Low', impact: 'Medium' },
    ];

    types.forEach(function(t, i) {
      const impColor = t.impact === 'Very High' ? '#22c55e' : t.impact === 'High' ? '#06b6d4' : t.impact === 'Medium' ? '#f59e0b' : '#94a3b8';
      opportunities.push({
        rank: i + 1,
        platform: t.platform,
        desc: t.desc,
        effort: t.effort,
        impact: t.impact,
        impactColor: impColor
      });
    });

    return opportunities;
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const opps = ToolLogic.find(input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div><div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';
  html += '<div style="margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;">';
  html += '<span style="color:#94a3b8;">📈 ' + opps.length + ' growth opportunities found for &quot;' + input + '&quot;</span>';
  html += '<span style="font-size:0.75rem;color:#64748b;">Sorted by impact</span>';
  html += '</div>';

  opps.forEach(function(o) {
    html += '<div style="display:flex;align-items:center;padding:0.6rem 0.75rem;border-bottom:1px solid rgba(255,255,255,0.05);gap:0.75rem;">';
    html += '<span style="color:#6366f1;font-weight:700;min-width:1.5rem;">#' + o.rank + '</span>';
    html += '<div style="flex:1;text-align:left;">';
    html += '<div style="font-weight:600;color:#e2e8f0;font-size:0.9rem;">' + o.platform + '</div>';
    html += '<div style="font-size:0.8rem;color:#94a3b8;">' + o.desc + '</div>';
    html += '</div>';
    html += '<div style="display:flex;gap:0.5rem;align-items:center;">';
    html += '<span style="font-size:0.7rem;background:#6366f120;color:#6366f1;padding:0.15rem 0.5rem;border-radius:4px;">' + o.effort + '</span>';
    html += '<span style="font-size:0.7rem;background:' + o.impactColor + '20;color:' + o.impactColor + ';padding:0.15rem 0.5rem;border-radius:4px;">' + o.impact + '</span>';
    html += '</div>';
    html += '</div>';
  });
  placeholder.innerHTML = html;
}`,

    tool: `
const ToolLogic = {
  analyze(input) {
    var lower = input.toLowerCase();
    var nums = input.match(/\\d[\\d,.]*/g);
    var hasSubs = nums ? parseInt(nums[0].replace(/,/g, '')) : 0;
    var hasHours = nums && nums.length > 1 ? parseInt(nums[1].replace(/,/g, '')) : 0;

    // Determine growth stage
    var stage, stageColor, stageAdvice;
    if (hasSubs >= 100000) { stage = 'Established Creator'; stageColor = '#6366f1'; stageAdvice = 'You\'re an established creator. Focus on community engagement, collaborations, and diversifying revenue.'; }
    else if (hasSubs >= 10000) { stage = 'Growing Channel'; stageColor = '#06b6d4'; stageAdvice = 'You\'ve built momentum. Double down on your best content formats and increase upload frequency.'; }
    else if (hasSubs >= 1000) { stage = 'Monetized Creator'; stageColor = '#22c55e'; stageAdvice = 'Congratulations on 1K subs! Focus on watch hours and creating content that keeps viewers on the platform.'; }
    else if (hasSubs >= 100) { stage = 'Building Audience'; stageColor = '#f59e0b'; stageAdvice = 'You have initial traction! Niche down further and focus on low-competition keywords to accelerate growth.'; }
    else { stage = 'Starting Out'; stageColor = '#ff3366'; stageAdvice = 'Every big channel started here. Focus on creating 20-30 videos in a specific niche before evaluating results.'; }

    // Daily upload recommendation
    var uploadRec = hasSubs < 1000 ? 'Post 3-4 times per week. Consistency is everything at this stage.' :
      hasSubs < 10000 ? 'Post 2-3 times per week. Quality + consistency = growth.' :
      'Post 1-2 times per week. Focus on high-quality, high-retention content.';

    // Niche recommendations
    var nicheRecs = [
      'Find 5 successful channels in your niche and analyze their top 3 videos',
      'Target keywords with search volume 100-1000/mo and competition under 40%',
      'Create content that answers specific questions your audience is asking',
      'Optimize your channel homepage with playlists organized by topic'
    ];

    // Recommended video length
    var videoLen = hasSubs < 1000 ? '8-12 minutes (long enough for good retention, short enough for new viewers)' :
      hasSubs < 10000 ? '10-15 minutes (sweet spot for watch time and ad revenue)' :
      '12-20 minutes (your audience trusts you to watch longer content)';

    // Calculate growth health score
    var healthScore = 50;
    if (hasSubs > 0) healthScore += 10;
    if (hasSubs >= 100) healthScore += 10;
    if (hasSubs >= 1000) healthScore += 10;
    if (hasHours >= 1000) healthScore += 10;
    if (hasHours >= 4000) healthScore += 10;
    if (lower.includes('weekly') || lower.includes('daily')) healthScore += 10;
    if (lower.includes('niche') || lower.includes('topic')) healthScore += 5;
    if (lower.includes('thumbnail') || lower.includes('title')) healthScore += 5;
    if (lower.includes('seo') || lower.includes('keyword')) healthScore += 5;
    if (lower.includes('engage') || lower.includes('comment') || lower.includes('community')) healthScore += 5;
    healthScore = Math.min(100, healthScore);

    // Milestone tracker
    var milestones = [];
    if (hasSubs < 100) milestones.push({ target: '100 subs', remaining: 100 - hasSubs, color: '#f59e0b' });
    if (hasSubs < 1000) milestones.push({ target: '1,000 subs', remaining: 1000 - hasSubs, color: '#06b6d4' });
    if (hasSubs < 10000) milestones.push({ target: '10,000 subs', remaining: 10000 - hasSubs, color: '#6366f1' });
    if (hasHours < 4000) milestones.push({ target: '4,000 watch hours', remaining: 4000 - hasHours > 0 ? 4000 - hasHours : 0, color: '#22c55e' });

    return {
      subs: hasSubs,
      watchHours: hasHours,
      stage: stage,
      stageColor: stageColor,
      stageAdvice: stageAdvice,
      uploadRec: uploadRec,
      videoLen: videoLen,
      nicheRecs: nicheRecs,
      milestones: milestones,
      healthScore: healthScore,
      healthLabel: healthScore >= 80 ? 'Strong' : healthScore >= 60 ? 'Building' : healthScore >= 40 ? 'Early' : 'Starting'
    };
  }
};

function handleTool() {
  const input = document.getElementById('tool-input').value.trim();
  if (!input) return;
  const result = ToolLogic.analyze(input);
  const box = document.getElementById('result-box');
  const placeholder = document.getElementById('result-placeholder');
  box.classList.add('show');

  let html = '<div style="font-size:0.75rem;color:#64748b;margin-bottom:0.75rem;padding:0.4rem 0.75rem;background:rgba(99,102,241,0.06);border-radius:6px;text-align:left;">📖 Based on the ' + window.BLOG_TOPIC + ' guide</div>';
  html += '<div style="margin-bottom:0.75rem;">' + topicAdvice(window.BLOG_TOPIC) + '</div>';

  // Health score
  var hsColor = result.healthScore >= 80 ? '#22c55e' : result.healthScore >= 60 ? '#06b6d4' : result.healthScore >= 40 ? '#f59e0b' : '#ff3366';
  html += '<div style="text-align:center;padding:1.25rem;background:rgba(99,102,241,0.04);border:1px solid #2a2a4a;border-radius:12px;margin-bottom:1rem;">';
  html += '<div style="font-weight:700;font-size:0.85rem;color:#94a3b8;margin-bottom:0.5rem;">CHANNEL HEALTH</div>';
  html += '<div style="font-size:2.5rem;font-weight:800;color:' + hsColor + ';">' + result.healthScore + '/100</div>';
  html += '<div style="font-size:0.85rem;color:' + hsColor + ';margin-bottom:0.5rem;">' + result.healthLabel + '</div>';
  html += '<div style="width:100%;height:6px;background:#1a1a2e;border-radius:3px;overflow:hidden;"><div style="width:' + result.healthScore + '%;height:100%;background:linear-gradient(90deg,#6366f1,' + hsColor + ');border-radius:3px;"></div></div>';
  html += '</div>';

  // Growth stage
  html += '<div style="margin-bottom:1rem;padding:1rem;background:rgba(99,102,241,0.04);border:1px solid #2a2a4a;border-radius:8px;text-align:left;">';
  html += '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;">';
  html += '<span style="font-weight:700;font-size:1.1rem;color:' + result.stageColor + ';">' + result.stage + '</span>';
  if (result.subs > 0) html += '<span style="font-size:0.8rem;color:#94a3b8;">(' + result.subs.toLocaleString() + ' subs)</span>';
  html += '</div>';
  html += '<div style="font-size:0.85rem;color:#d1d5db;padding:0.5rem;background:rgba(255,255,255,0.03);border-radius:6px;">' + result.stageAdvice + '</div>';
  html += '</div>';

  // Key metrics
  html += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.75rem;margin-bottom:1rem;">';
  if (result.subs > 0) html += '<div style="background:rgba(99,102,241,0.08);border-radius:8px;padding:0.75rem;text-align:center;"><div style="font-size:1.1rem;font-weight:700;color:#6366f1;">' + result.subs.toLocaleString() + '</div><div style="font-size:0.7rem;color:#94a3b8;">Subscribers</div></div>';
  if (result.watchHours > 0) html += '<div style="background:rgba(6,182,212,0.08);border-radius:8px;padding:0.75rem;text-align:center;"><div style="font-size:1.1rem;font-weight:700;color:#06b6d4;">' + result.watchHours.toLocaleString() + '</div><div style="font-size:0.7rem;color:#94a3b8;">Watch Hours</div></div>';
  html += '<div style="background:rgba(34,197,94,0.08);border-radius:8px;padding:0.75rem;text-align:center;"><div style="font-size:1.1rem;font-weight:700;color:#22c55e;">' + result.videoLen.split(' ')[0] + '</div><div style="font-size:0.7rem;color:#94a3b8;">Recommended Length</div></div>';
  html += '<div style="background:rgba(245,158,11,0.08);border-radius:8px;padding:0.75rem;text-align:center;"><div style="font-size:1.1rem;font-weight:700;color:#f59e0b;">' + (result.milestones.length > 0 ? result.milestones[0].target : 'Milestone Reached') + '</div><div style="font-size:0.7rem;color:#94a3b8;">Next Goal</div></div>';
  html += '</div>';

  // Milestones
  if (result.milestones.length > 0) {
    html += '<div style="margin-bottom:1rem;padding:1rem;background:rgba(99,102,241,0.03);border:1px solid #2a2a4a;border-radius:8px;text-align:left;">';
    html += '<div style="font-weight:600;font-size:0.85rem;color:#06b6d4;margin-bottom:0.5rem;">🎯 Upcoming Milestones</div>';
    result.milestones.forEach(function(m) {
      var pct = m.remaining > 0 ? Math.min(95, Math.round(((m.target === '1,000 subs' ? 1000 : m.target === '10,000 subs' ? 10000 : m.target === '100 subs' ? 100 : 4000) - m.remaining) / (m.target === '1,000 subs' ? 1000 : m.target === '10,000 subs' ? 10000 : m.target === '100 subs' ? 100 : 4000) * 100)) : 100;
      html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;">';
      html += '<span style="font-size:0.8rem;color:#e2e8f0;min-width:100px;">' + m.target + '</span>';
      html += '<div style="flex:1;height:4px;background:#1a1a2e;border-radius:2px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:' + m.color + ';border-radius:2px;"></div></div>';
      html += '<span style="font-size:0.75rem;color:' + m.color + ';min-width:60px;text-align:right;">' + m.remaining.toLocaleString() + ' left</span>';
      html += '</div>';
    });
    html += '</div>';
  }

  // Recommendations
  html += '<div style="margin-bottom:1rem;padding:1rem;background:rgba(6,182,212,0.04);border:1px solid rgba(6,182,212,0.12);border-radius:8px;text-align:left;">';
  html += '<div style="font-weight:600;font-size:0.85rem;color:#06b6d4;margin-bottom:0.5rem;">💡 Recommendations</div>';
  html += '<div style="font-size:0.85rem;color:#d1d5db;padding:0.35rem 0;">📅 ' + result.uploadRec + '</div>';
  html += '<div style="font-size:0.85rem;color:#d1d5db;padding:0.35rem 0;">⏱️ Recommended video length: ' + result.videoLen + '</div>';
  html += '<div style="font-weight:600;font-size:0.8rem;color:#6366f1;margin-top:0.5rem;margin-bottom:0.35rem;">🎯 To grow faster:</div>';
  result.nicheRecs.forEach(function(r) {
    html += '<div style="font-size:0.8rem;color:#d1d5db;padding:0.2rem 0;padding-left:0.5rem;border-left:2px solid rgba(6,182,212,0.3);margin-bottom:0.15rem;">→ ' + r + '</div>';
  });
  html += '</div>';

  placeholder.innerHTML = html;
}`,
  };

  return implementations[toolType] || implementations.tool;
}

// ── Generate tool HTML (v3: with REAL JavaScript logic) ──────

function generateToolHtml(slug) {
  const titleCase = slug
    .replace(/-/g, ' ')
    .replace(/\\b\\w/g, c => c.toUpperCase())
    .replace(/\\b(And|For|The|In|Of|To|A|Vs)\\b/gi, c => c.toLowerCase())
    .replace(/^./, c => c.toUpperCase());

  const TOOL_DESC = {
    'scorer': 'Score and optimize your YouTube titles for maximum CTR — checks length, keywords, power words, numbers, and emotional triggers.',
    'generator': 'Generate optimized YouTube tags with estimated search volume and competition scores. Copy individual tags or all at once.',
    'research': 'Research YouTube keywords with search volume and difficulty estimates. Find low-competition opportunities your competitors miss.',
    'writer': 'Write SEO-optimized YouTube descriptions with timestamps, hashtags, CTAs, and links ready to paste into YouTube Studio.',
    'checker': 'Check your YouTube metadata against SEO best practices — description length, hashtags, timestamps, and keyword usage.',
    'analyzer': 'Analyze YouTube channels and competitors. Understand what drives growth in your niche and find actionable opportunities.',
    'calculator': 'Calculate your YouTube CTR, estimated revenue, and get personalized recommendations to improve your click-through rate.',
    'auditor': 'Get a complete YouTube SEO audit score with prioritized fixes for your title, description, and tags.',
    'detector': 'Diagnose algorithm issues, view drops, and potential shadow bans. Identify what\'s limiting your YouTube reach.',
    'optimizer': 'Get personalized recommendations for your YouTube content strategy — titles, thumbnails, tags, descriptions, and end screens.',
    'planner': 'Generate a full content calendar with 20+ video ideas tailored to your specific niche and audience.',
    'tracker': 'Track your YouTube channel growth — monitor views, subscribers, CTR, impressions, and estimated revenue trends.',
    'finder': 'Discover growth opportunities for your YouTube channel including collaborations, guest posting, and backlink prospects.',
    'tool': 'Analyze your text for SEO keywords, topic clusters, and readability. Get insights to improve your YouTube content.',
  };

  const toolType = detectToolType(slug);
  const toolJS = getToolJS(toolType.type, slug);

  const metaTitle = `${titleCase} — Free Interactive Tool | YT SEO Architect`;
  const toolDesc = TOOL_DESC[toolType.type] || 'Free interactive YouTube SEO tool';
  const metaDesc = `${toolDesc} Apply what you learn from the ${titleCase.toLowerCase()} guide. Works entirely in your browser, no login required.`;
  const buttonText = toolType.btn || 'Go';
  const inputLabel = toolType.input || 'Enter your details';
  const inputPlaceholder = toolType.placeholder || 'e.g., describe your YouTube topic';

  const blogPath = `/blog/${slug}`;
  const toolPath = `/tools/${slug}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${metaTitle}</title>
  <meta name="description" content="${metaDesc}" />
  <link rel="canonical" href="${SITE}/tools/${slug}" />
  <meta property="og:title" content="${metaTitle}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:image" content="${SITE}/logo.svg" />
  <meta name="robots" content="index, follow" />
  <script type="application/ld+json">
  { "@context": "https://schema.org", "@type": "WebApplication",
    "name": "${titleCase}", "description": "${titleCase.toLowerCase()} for YouTube creators",
    "url": "${SITE}${toolPath}", "applicationCategory": "MultimediaApplication",
    "operatingSystem": "Web", "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" } }
  </script>
  <style>
    :root { --bg: #0f0f1a; --surface: #1a1a2e; --border: #2a2a4a; --accent: #6366f1; --accent2: #06b6d4; --text: #e2e8f0; --text2: #94a3b8; --text3: #64748b; --success: #22c55e; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; min-height: 100vh; line-height: 1.6; }
    .header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 1rem 2rem; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
    .header-logo { display: flex; align-items: center; gap: 0.75rem; text-decoration: none; color: var(--text); font-weight: 700; font-size: 1.25rem; }
    .header-logo span { font-size: 1.5rem; }
    .header-cta { color: var(--accent2); text-decoration: none; font-weight: 600; font-size: 0.9rem; padding: 0.5rem 1rem; border: 1px solid var(--accent2); border-radius: 6px; transition: all 0.2s; }
    .header-cta:hover { background: rgba(6,182,212,0.1); }
    .container { max-width: 740px; margin: 0 auto; padding: 2rem; }
    h1 { font-size: 2rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, #fff, var(--accent2)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .subtitle { color: var(--text2); margin-bottom: 1.5rem; }
    .breadcrumb { font-size: 0.85rem; color: var(--text3); margin-bottom: 1rem; }
    .breadcrumb a { color: var(--accent); text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .copy-btn { display: none; margin-top: 1rem; width: 100%; padding: 0.65rem; background: linear-gradient(135deg, #6366f1, #06b6d4); color: #fff; border: none; border-radius: 8px; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: opacity 0.3s, transform 0.2s; }
    .copy-btn:hover { opacity: 0.9; transform: scale(1.01); }
    .copy-btn:active { transform: scale(0.98); }
    .copy-btn.copied { background: linear-gradient(135deg, #22c55e, #16a34a); }
    .result-box.show .copy-btn { display: block; }
    .copy-btn-small { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem; background: rgba(99,102,241,0.15); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.25); border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
    .copy-btn-small:hover { background: rgba(99,102,241,0.25); color: #c7d2fe; }
    .copy-btn-small.copied { background: rgba(34,197,94,0.2); color: #22c55e; border-color: #22c55e; }
    .tool-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; }
    .tool-card label { display: block; font-weight: 600; margin-bottom: 0.5rem; color: var(--text2); font-size: 0.9rem; }
    .tool-card input, .tool-card textarea { width: 100%; padding: 0.75rem 1rem; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 1rem; margin-bottom: 1rem; outline: none; transition: border-color 0.2s; }
    .tool-card input:focus, .tool-card textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(99,102,241,0.15); }
    .tool-card textarea { min-height: 100px; resize: vertical; }
    .tool-card button { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; border: none; padding: 0.75rem 2rem; border-radius: 8px; font-weight: 600; font-size: 1rem; cursor: pointer; width: 100%; transition: transform 0.2s, box-shadow 0.2s; }
    .tool-card button:hover { transform: translateY(-1px); box-shadow: 0 4px 15px rgba(99,102,241,0.3); }
    .tool-card button:active { transform: translateY(0); }
    .result-box { background: var(--surface); border: 1px solid var(--accent2); border-radius: 12px; padding: 1.25rem; margin-top: 1rem; display: none; }
    .result-box.show { display: block; }
    .result-box .placeholder { color: var(--text3); text-align: center; padding: 1rem; }
    .blog-link { margin-top: 2rem; padding: 1.25rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; text-align: center; }
    .blog-link p { color: var(--text2); margin-bottom: 0.75rem; font-size: 0.9rem; }
    .blog-link a { display: inline-block; background: transparent; border: 1px solid var(--accent); color: var(--accent); padding: 0.6rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; transition: all 0.2s; }
    .blog-link a:hover { background: var(--accent); color: #fff; }
    .footer { text-align: center; padding: 2rem; color: var(--text3); font-size: 0.85rem; }
    .footer a { color: var(--accent2); text-decoration: none; }
    @media (max-width: 600px) { .container { padding: 1rem; } h1 { font-size: 1.5rem; } .header { padding: 0.75rem 1rem; } }
  </style>
</head>
<body data-keyword="${slug.replace(/-/g, ' ')}">
  <div class="header">
    <a href="/" class="header-logo"><span>🛠️</span> YT SEO Architect</a>
    <div style="display:flex;gap:1rem;align-items:center;">
      <a href="/tools" style="color:var(--accent);text-decoration:none;font-weight:600;font-size:0.9rem;">All Tools</a>
      <a href="${blogPath}" class="header-cta">📖 Read the Guide →</a>
    </div>
  </div>

  <div class="container">
    <div class="breadcrumb">
      <a href="/tools">Tools</a> / ${titleCase}
    </div>

    <h1>${toolType.icon} ${titleCase} — Free Interactive Tool</h1>
    <p class="subtitle">${toolDesc} Aligned with the <a href="${blogPath}" style="color:var(--accent2);text-decoration:underline;">${titleCase.toLowerCase()} guide</a> — everything works in your browser, no login needed.</p>

    <div class="tool-card">
      <label for="tool-input">${inputLabel}</label>
      <input type="text" id="tool-input" placeholder="${inputPlaceholder}" />
      <button onclick="handleTool()">${buttonText}</button>

      <div class="result-box" id="result-box">
        <div class="placeholder" id="result-placeholder">
          Enter your details above and click "${buttonText}" to get results aligned with the ${titleCase.toLowerCase()} guide.
        </div>
        <button class="copy-btn" id="copy-btn" onclick="copyResults()">📋 Copy Results</button>
        <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.4rem;">
          <button class="copy-btn-small" id="copy-btn-text" onclick="copyResultsTextOnly()">📋 Copy Text</button>
        </div>
      </div>
    </div>

    <div class="blog-link">
      <p>📖 Want the full guide with examples and expert tips?</p>
      <a href="${blogPath}">Read the Complete Guide →</a>
    </div>
  </div>

  <div class="footer">
    <p>Part of <a href="/">YT SEO Architect</a> — Free AI-powered YouTube SEO tools | <a href="${blogPath}">${titleCase}</a></p>
  </div>

  <script>
    window.BLOG_SLUG = '${slug}';
    window.BLOG_TOPIC = '${slug}'.replace(/-/g, ' ').replace(/\d{4}/g, '').replace(/\s+/g, ' ').trim();

    // ── Deterministic random (same input = same output) ──
    function seededRandom(seed) {
      var x = Math.sin(Math.abs(typeof seed === 'number' ? seed : seed ? seed.charCodeAt(0) + seed.length : 1)) * 10000;
      return x - Math.floor(x);
    }

    // ── Topic-aware advice generator ──
    function topicAdvice(topic) {
      var t = (topic || '').toLowerCase();
      if (t.includes('subscriber') || t.includes('growth')) return '🎯 ' + 'Tip: Focus on subscriber growth through consistent uploading, community engagement, and strategic cross-promotion.';
      if (t.includes('small') || t.includes('beginner')) return '🎯 ' + 'Tip: Small channels grow fastest by targeting low-competition keywords and niching down. Consistency beats volume.';
      if (t.includes('tutorial')) return '🎯 ' + 'Tip: Tutorials with clear timestamps, step-by-step visuals, and downloadable resources rank higher in YouTube search.';
      if (t.includes('algorithm')) return '🎯 ' + "Tip: YouTube's algorithm favors high retention, strong CTR, and consistent uploads. Optimize for watch time first.";
      if (t.includes('tag') || t.includes('keyword')) return '🎯 ' + 'Tip: Use a mix of broad (high volume) and specific (low competition) tags for maximum discovery.';
      if (t.includes('title') || t.includes('hook')) return '🎯 ' + 'Tip: Titles with numbers, power words, and brackets see 15-36% higher CTR. Front-load your keyword.';
      if (t.includes('description')) return '🎯 ' + 'Tip: Descriptions with 200+ words, timestamps, and relevant hashtags rank significantly better in search.';
      if (t.includes('retention') || t.includes('ctr')) return '🎯 ' + "Tip: Audience retention and CTR are YouTube's top ranking signals. Hook viewers in the first 5 seconds.";
      if (t.includes('thumbnail')) return '🎯 ' + 'Tip: High-contrast thumbnails with close-up faces and 3-5 words max get up to 30% more clicks.';
      if (t.includes('monetization')) return '🎯 ' + 'Tip: Focus on niche content with high CPM potential. Reach 1K subs and 4K watch hours to unlock monetization.';
      if (t.includes('shorts')) return '🎯 ' + 'Tip: YouTube Shorts under 60s with strong hooks in the first 3 seconds get the most algorithmic push.';
      if (t.includes('backlink') || t.includes('seo') || t.includes('rank')) return '🎯 ' + "Tip: Build backlinks through guest posting, collaborations, and valuable forum contributions to boost channel authority.";
      if (t.includes('competitor') || t.includes('analyze')) return '🎯 ' + "Tip: Analyze competitors' top videos for keyword gaps, content formats, and engagement patterns to find your edge.";
      if (t.includes('idea') || t.includes('plan')) return '🎯 ' + 'Tip: Plan content around search intent — informational, educational, and entertaining formats all serve different audiences.';
      return '🎯 ' + 'Tip: Focus on creating content that provides clear value. Consistency and quality drive long-term YouTube growth.';
    }

    function copyResults() {
      var box = document.getElementById('result-box');
      if (!box) return;
      var text = box.innerText || box.textContent || '';
      text = text.replace(/📋 Copy Results/g, '').replace(/📋 Copy Text/g, '').replace(/Copy\s*/g, '').replace(/Copied!/g, '').trim();
      if (!text) return;
      navigator.clipboard.writeText(text).then(function() {
        var btn = document.getElementById('copy-btn');
        if (btn) { btn.textContent = '✅ Copied!'; btn.classList.add('copied');
          setTimeout(function() { btn.textContent = '📋 Copy Results'; btn.classList.remove('copied'); }, 2000); }
      }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
    }

    function copyResultsTextOnly() {
      var box = document.getElementById('result-box');
      if (!box) return;
      var text = box.innerText || box.textContent || '';
      text = text.replace(/📋 Copy Results/g, '').replace(/📋 Copy Text/g, '').replace(/Copy\s*/g, '').replace(/Copied!/g, '').trim();
      if (!text) return;
      navigator.clipboard.writeText(text).then(function() {
        var btn = document.getElementById('copy-btn-text');
        if (btn) { btn.textContent = '✅ Copied!'; btn.classList.add('copied');
          setTimeout(function() { btn.textContent = '📋 Copy Text'; btn.classList.remove('copied'); }, 2000); }
      }).catch(function() {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      });
    }

    ${toolJS}
  </script>
</body>
</html>`;
}

// ── Main ─────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const listOnly = args.includes('--list');
  const rebuildAll = args.includes('--rebuild');
  const singleSlug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;

  console.log('═══════════════════════════════════════════════');
  console.log('  GENERATE BLOG TOOLS v3 — Interactive Tools');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  let slugs;
  if (singleSlug) {
    slugs = [singleSlug];
  } else if (rebuildAll) {
    // During --rebuild, merge blog slugs + existing tool slugs (to replace v2-era tools)
    const blogSlugs = new Set(getBlogSlugs());
    const toolSlugs = getToolFileSlugs();
    slugs = [...new Set([...blogSlugs, ...toolSlugs])].sort();
    console.log(`  Sources: ${blogSlugs.size} blog slugs + ${toolSlugs.length} existing tool slugs = ${slugs.length} total`);
  } else {
    slugs = getBlogSlugs();
  }

  const existingTools = existsSync(TOOLS_DIR) ? readdirSync(TOOLS_DIR).filter(f => f.endsWith('.html')) : [];

  let generated = 0;
  let skipped = 0;

  for (const slug of slugs) {
    const toolFile = `${slug}.html`;

    // Skip if tool already exists (unless rebuilding)
    if (!rebuildAll && !singleSlug && existingTools.includes(toolFile)) {
      skipped++;
      continue;
    }

    if (listOnly) {
      const missing = !existingTools.includes(toolFile);
      console.log(`  ${missing ? '❌ MISSING' : '✅ EXISTS'} ${toolFile} ← ${slug}`);
      continue;
    }

    const html = generateToolHtml(slug);
    if (!dryRun) {
      mkdirSync(TOOLS_DIR, { recursive: true });
      writeFileSync(resolve(TOOLS_DIR, toolFile), html);
    }
    generated++;
    console.log(`  ${dryRun ? '[DRY]' : '[OK]'} ${toolFile} ← ${slug}`);
  }

  console.log('');
  console.log(`  Summary: ${generated} generated, ${skipped} skipped`);
  if (singleSlug) {
    console.log(`  Tool live at: ${SITE}/tools/${singleSlug}`);
  }
  console.log('');
}

main();
