import 'dotenv/config';

import * as Sentry from '@sentry/node';

import express from 'express';

import cors from 'cors';

import helmet from 'helmet';



// Initialize Sentry

Sentry.init({ dsn: process.env.SENTRY_DSN });



import rateLimit from 'express-rate-limit';



// Import monitoring and logging

import { initSentry, captureError, captureMessage, addBreadcrumb } from '../src/monitoring/sentry.js';

import logger from '../src/monitoring/logger.js';

import { performanceMiddleware } from '../src/monitoring/performance.js';



// Import database

import { initDatabase, checkDatabaseHealth } from '../src/database/connection.js';



process.on('uncaughtException', (err) => {

  console.error('CRITICAL: Uncaught Exception:', err);
  console.error('Build: 2026-07-24-v2');

  process.exit(1);

});



process.on('unhandledRejection', (reason, promise) => {

  console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);

});



// Import Modular Routers

import { router as creditsRouter } from './credits.js';

import { router as aiRouter } from './ai-engine.js';

import { router as youtubeRouter } from './youtube-ops.js';

import { generateCSRFToken, csrfMiddleware } from './middleware/csrf.js';
import { requireAdmin } from './middleware/admin-guard.js';

import { sanitizePromptInput } from './ai-engine.js';

// Programmatic SEO permanently disabled (2026-05-27)
import { router as agentRouter, runAutonomousLoop } from './agent-workflows/orchestrator.js';
import { router as cronOptimizerRouter } from './cron-optimizer.js';
// BLOG POSTS PERMANENTLY DISABLED — import removed (2026-05-19)
// import { dailyBlogCronHandler } from './cron-blog-posts.js';
import { router as measureRouter } from './cron-measure-impact.js';
import abTestRouter from './ab-test.js';
import coachMemoryRouter from './coach-memory.js';
import trendPulseRouter from './trend-pulse.js';
import analyticsRouter from './analytics.js';
import agentCoreRouter from './agent-core/approvals.js';
import learningRouter from './agent-core/learning.js';
import safetyRouter from './agent-core/safety.js';
import { router as marketingRouter } from './marketing.js';



const ALLOWED_ORIGINS = new Set([

  'https://yt-seo-architect.vercel.app',

]);



const isOriginAllowed = (origin) => {

  if (!origin) return true;

  if (ALLOWED_ORIGINS.has(origin)) return true;

  if (origin.endsWith('.vercel.app')) return true;

  if (process.env.NODE_ENV === 'development' && (

    origin.startsWith('http://localhost:') || 

    origin.startsWith('http://127.0.0.1:')

  )) return true;

  return false;

};



const app = express();



// Sentry Request Handler (MUST BE FIRST)

if (Sentry && Sentry.Handlers) {

  app.use(Sentry.Handlers.requestHandler());

  app.use(Sentry.Handlers.tracingHandler());

} else {

  console.warn('[Sentry] Handlers not found, skipping middleware');

}



// Initialize Sentry for error tracking

initSentry();



// Environment variable validation

const requiredEnvVars = ['GROQ_API_KEY', 'CSRF_SECRET'];

if (process.env.NODE_ENV === 'production') {

  requiredEnvVars.push('PAYPAL_CLIENT_ID', 'PAYPAL_SECRET', 'PAYPAL_WEBHOOK_ID', 'DATABASE_URL');

}



// Validate CSRF_SECRET is not the default value in production

if (process.env.NODE_ENV === 'production') {

  const csrfSecret = process.env.CSRF_SECRET || process.env.SESSION_SECRET;

  if (!csrfSecret || csrfSecret === 'dev-secret-change-in-production') {

    logger.error('CRITICAL: CSRF_SECRET is not set or uses default value in production!');

    console.error('❌ CRITICAL: CSRF_SECRET must be set to a secure random value in production. Exiting.');

    process.exit(1);

  }

}



const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

let isConfigValid = true;

if (missingEnvVars.length > 0) {

  logger.error('Missing required environment variables', { missingVars: missingEnvVars });

  console.error('❌ Missing required environment variables:', missingEnvVars.join(', '));

  console.error('Please configure these in your Vercel environment variables or .env file');

  // DO NOT process.exit(1) in serverless environment, as it causes cold start crashes.

  // Instead, mark config as invalid and handle gracefully in routes.

  isConfigValid = false;

}



logger.info('Application starting', {

  environment: process.env.NODE_ENV || 'development',

  version: process.env.npm_package_version || '1.0.0'

});



// Initialize database connection (safe for serverless cold starts)

try {

  initDatabase();

  // Run migrations to create any missing tables

  import('./database/migrate.js').then(m => m.runMigrations()).catch(e => console.warn('Migration deferred:', e.message));

} catch (dbInitError) {

  logger.warn('Database initialization deferred (cold start)', { error: dbInitError.message });

}







// --- Helpers ---

const sendJSON = (res, status, data) => {

  if (!res.headersSent) {

    res.setHeader('Content-Type', 'application/json');

    res.status(status).json(data);

  }

};



app.use(helmet({

  contentSecurityPolicy: {

    directives: {

      defaultSrc: ["'self'"],

      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com", "https://www.paypal.com", "https://*.paypal.com", "https://*.paypalobjects.com", "https://unpkg.com", "https://apis.google.com", "https://accounts.google.com", "https://pagead2.googlesyndication.com"],

      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],

      imgSrc: ["'self'", "data:", "https:", "blob:", "https://*.paypalobjects.com"],

      connectSrc: ["'self'", "https://api.groq.com", "https://www.googleapis.com", "https://*.googleapis.com", "https://api-m.paypal.com", "https://api-m.sandbox.paypal.com", "https://*.paypal.com", "https://unpkg.com", "https://*.sentry.io", "https://*.google-analytics.com"],

      frameSrc: ["'self'", "https://js.stripe.com", "https://www.paypal.com", "https://www.sandbox.paypal.com", "https://*.paypal.com", "https://accounts.google.com", "https://googleads.g.doubleclick.net", "https://pagead2.googlesyndication.com"],

      fontSrc: ["'self'", "https://fonts.gstatic.com"],

      objectSrc: ["'none'"],

      baseUri: ["'self'"],

      formAction: ["'self'"],

    },

  },

  crossOriginEmbedderPolicy: false,

  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },

  hsts: {

    maxAge: 31536000,

    includeSubDomains: true,

    preload: true

  },

}));



app.use(cors({

  origin: (origin, callback) => {

    if (isOriginAllowed(origin)) callback(null, true);

    else callback(new Error('Origin not allowed'), false);

  },

  credentials: true,

  methods: ['GET', 'POST', 'PUT', 'DELETE'],

  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'x-channel-id', 'x-access-token'],

  maxAge: 86400,

}));



app.use(express.json({ limit: '1mb' }));



// CSRF applied per-router (credits, ai-engine, youtube-ops) to avoid double validation

// app.use(csrfMiddleware);



// Global Input Sanitization Middleware (Fortress Layer)

app.use((req, res, next) => {

  if (req.method === 'POST' && req.body) {

    // Sanitize common search and prompt fields to prevent injection

    const fieldsToSanitize = ['topic', 'q', 'query', 'seed', 'keyword', 'prompt', 'userPrompt', 'systemPrompt'];

    fieldsToSanitize.forEach(field => {

      if (req.body[field] && typeof req.body[field] === 'string') {

        req.body[field] = sanitizePromptInput(req.body[field]);

      }

    });

  }

  next();

});



// Performance monitoring middleware

app.use(performanceMiddleware);



// Enhanced request logging

app.use((req, res, next) => {

  const startTime = Date.now();

  const channelId = req.body?.channelId || req.query?.channelId || req.headers['x-channel-id'];



  logger.request(req, res, { channelId });



  // Add breadcrumb to Sentry

  addBreadcrumb({

    message: `${req.method} ${req.url}`,

    category: 'http',

    level: 'info',

    data: {

      method: req.method,

      url: req.url,

      userAgent: req.get('User-Agent'),

      ip: req.ip

    }

  });



  // Log response

  const originalSend = res.send;

  res.send = function(body) {

    const duration = Date.now() - startTime;

    const statusCode = res.statusCode;



    logger.info('API Response', {

      method: req.method,

      url: req.url,

      statusCode,

      duration: `${duration}ms`,

      channelId,

      responseSize: body ? body.length : 0

    });



    return originalSend.call(this, body);

  };



  next();

});



const limiter = rateLimit({

  windowMs: 15 * 60 * 1000,

  max: process.env.NODE_ENV === 'test' ? 100 : 500,

  message: { error: 'Too many requests, please try again later.' },

  standardHeaders: true,

  legacyHeaders: false,

});

app.use(limiter);



app.get('/', (req, res) => {

  sendJSON(res, 200, { status: 'online', service: 'YouTube SEO API' });

});



// --- Health Check Endpoints ---

app.get('/api/health', async (req, res) => {

  try {

    const channelId = req.query.channelId || 'anonymous';

    const csrfToken = generateCSRFToken(channelId);



    // Ensure database URL is configured

    if (!process.env.DATABASE_URL) {

      logger.warn('DATABASE_URL not configured');

      return sendJSON(res, 200, {

        status: 'online',

        db_connected: false,

        paypal_id: process.env.PAYPAL_CLIENT_ID || null,

        csrfToken,

        timestamp: new Date().toISOString(),

        environment: process.env.NODE_ENV || 'development',

        warning: 'DATABASE_URL not configured'

      });

    }



    // Check database health with error handling

    let dbHealth;

    try {

      dbHealth = await checkDatabaseHealth();

    } catch (dbError) {

      logger.error('Database health check threw error', { error: dbError.message });

      dbHealth = { db_connected: false, status: 'unhealthy', message: dbError.message };

    }

    

    const paypalId = process.env.PAYPAL_CLIENT_ID || null;



    const response = {

      status: 'online',

      db_connected: dbHealth.db_connected || false,

      db_status: dbHealth.status || 'unknown',

      db_message: dbHealth.message || '',

      paypal_id: paypalId,

      csrfToken,

      timestamp: new Date().toISOString(),

      environment: process.env.NODE_ENV || 'development'

    };



    sendJSON(res, 200, response);

  } catch (error) {

    logger.error('Health check failed', { error: error.message });

    captureError(error, { tags: { category: 'health' } });

    sendJSON(res, 200, {

      status: 'online',

      db_connected: false,

      paypal_id: process.env.PAYPAL_CLIENT_ID || null,

      timestamp: new Date().toISOString(),

      environment: process.env.NODE_ENV || 'development',

      error: error.message

    });

  }

});



app.get('/api/config', (req, res) => {
  const channelId = req.query.channelId || 'anonymous';
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  // In production, PayPal client ID MUST be set — never fall back to sandbox for real users
  let paypalId = process.env.PAYPAL_CLIENT_ID || null;
  if (isProduction && !paypalId) {
    console.error('[CONFIG] FATAL: PAYPAL_CLIENT_ID not set in production. Payments will not work.');
  }
  // Only use sandbox fallback in development
  if (!paypalId && !isProduction) {
    paypalId = 'sb';
  }

  const csrfToken = generateCSRFToken(channelId);
  sendJSON(res, 200, { paypal_id: paypalId, csrfToken });
});



app.get('/api/auth/csrf', (req, res) => {

  const channelId = req.query.channelId || 'anonymous';

  const token = generateCSRFToken(channelId);

  sendJSON(res, 200, { token });

});



app.get('/api/health/:check', async (req, res) => {

  try {

    const { check } = req.params;

    const health = await runHealthCheck(check);

    const statusCode = health.status === 'healthy' ? 200 :

                      health.status === 'degraded' ? 200 : 503;



    sendJSON(res, statusCode, health);

  } catch (error) {

    logger.error(`Health check ${req.params.check} failed`, { error: error.message });

    captureError(error, { tags: { category: 'health', check: req.params.check } });

    sendJSON(res, 503, { status: 'error', message: error.message });

  }

});



// --- Mount Modular Routers ---

app.use('/api/credits', creditsRouter);

app.use('/api/ai', aiRouter);

app.use('/api/youtube', youtubeRouter);

// Programmatic SEO routes permanently disabled (2026-05-27)
app.use('/api/agent', agentRouter);
app.use('/api/cron', cronOptimizerRouter);
app.use('/api/measure', measureRouter);
app.use('/api/ab-test', abTestRouter);
app.use('/api/coach-memory', coachMemoryRouter);
app.use('/api/trends', trendPulseRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/agent-core', agentCoreRouter);
app.use('/api/agent-core', learningRouter);
app.use('/api/agent-core', safetyRouter);

// Public marketing routes (no auth)
app.use('/api/marketing', marketingRouter);




// Free AI audit — no credits, no auth

app.post('/api/audit-recs', async (req, res) => {

  try {

    const { title, description, tags, titleScore, descScore, tagScore, growthIssues = [] } = req.body || {};

    if (!title) return res.status(400).json({ error: 'Missing title' });

    const issues = [];

    if (titleScore < 85) issues.push('Title (' + titleScore + '/100): ' + title.substring(0, 100));
    if (descScore < 85) issues.push('Description (' + descScore + '/100): ' + (description||'').substring(0, 200));
    if (tagScore < 85 && Array.isArray(tags)) issues.push('Tags (' + tagScore + '/100): ' + tags.slice(0,12).join(', '));

    if (!issues.length) return res.json({ recommendations: null });

    const tagsText = Array.isArray(tags) ? tags.join(', ') : (tags || '');
    const issueText = issues.join('\n\n');
    const growthIssueText = Array.isArray(growthIssues) && growthIssues.length > 0
      ? 'Growth Engine Flagged Issues:\n' + growthIssues.map(i => `- [${i.severity?.toUpperCase() || 'MEDIUM'}] ${i.issue} (${i.type || 'general'})`).join('\n')
      : '';

    const { askAI } = await import('./_lib/ai-provider.js');

    const raw = await askAI(
      'You are a world-class YouTube SEO strategist for 2026. Return ONLY valid JSON.',
      [
        'Analyze this video metadata and provide a strategic, prioritized audit for the creator.',
        `Title: ${title}`,
        `Description: ${description || '[none]'}`,
        `Tags: ${tagsText}`,
        `Title Score: ${titleScore}`,
        `Description Score: ${descScore}`,
        `Tags Score: ${tagScore}`,
        issueText,
        growthIssueText,
        'Return JSON exactly in this format:',
        '{',
        '  "strategySummary": "short summary of what matters most and why",',
        '  "priorities": [{',
        '    "area": "Title|Description|Tags|Watch Loop|Safety",',
        '    "importance": "High|Medium|Low",',
        '    "recommendation": "what to fix first",',
        '    "impact": "what metric is likely to improve",',
        '    "why": "why this change matters"',
        '  }],',
        '  "fixes": [{',
        '    "type": "title|description|tags|risk",',
        '    "issue": "exact problem",',
        '    "suggestion": "the fix",',
        '    "reason": "why it helps SEO"',
        '  }]',
        '}'
      ].filter(Boolean).join('\n\n'),
      { temperature: 0.65, maxTokens: 900, forceJson: true }
    );

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch (parseError) {
      parsed = {};
    }

    res.json({ recommendations: parsed });

  } catch (e) { res.json({ recommendations: null }); }

});



// Cron optimization routes moved to api/cron-optimizer.js


// Measurement routes moved to api/cron-measure-impact.js


app.post('/api/keywords/research', async (req, res) => {

  try {

    const { seed, niche='General' } = req.body||{};

    if (!seed||seed.length<2) return res.status(400).json({ error:'Seed required' });

    const [yt,g]=await Promise.all([

      fetch('https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q='+encodeURIComponent(seed)).then(r=>r.json()).then(d=>d[1]||[]).catch(()=>[]),

      fetch('https://suggestqueries.google.com/complete/search?client=firefox&q='+encodeURIComponent(seed)).then(r=>r.json()).then(d=>d[1]||[]).catch(()=>[])

    ]);

    const all=[...new Set([...yt,...g])];

    const score=function(kw){

      const k=kw.toLowerCase(); const w=k.split(' ').length;

      let v='Low'; if(/\b(how to|best|top|vs|review|tutorial|guide|tips|2026|free|easy|fast|for beginners)\b/i.test(k))v='High'; else if(/\b(what is|why|when|explained|ideas|examples)\b/i.test(k)||w>=4)v='Medium';

      let c='High'; if(w>=5)c='Low'; else if(w>=3)c='Medium';

      let o=(v==='High'?40:v==='Medium'?25:10)+(c==='Low'?40:c==='Medium'?20:5);

      if(seed.toLowerCase().split(' ').some(s=>k.includes(s)))o+=10;

      if(w>=4)o+=10; if(/^(how|why|what|when|where|can|do|does|is|are)/i.test(k))o+=5;

      return { volumeTier:v, competition:c, opportunityScore:Math.min(100,o) };

    };

    const kw=all.map(k=>({keyword:k,...score(k),source:yt.includes(k)?'youtube':'google'}));

    kw.sort((a,b)=>b.opportunityScore-a.opportunityScore);

    const top=kw[0]||null;

    const titles=[' (Complete Guide 2026)',': What Nobody Tells You','The Truth About ',' — Explained Simply'];

    const sugg=top?titles[Math.floor(Math.random()*4)].replace('The Truth About ','The Truth About '+top.keyword):top?.keyword+titles[0];

    if(sugg.startsWith('The Truth About The Truth About'))sugg.replace('The Truth About The Truth About','The Truth About');

    res.json({seed,niche,keywords:kw.slice(0,30),topOpportunity:top,suggestedTitle:typeof sugg==='string'&&!sugg.includes('Truth')?top?.keyword+titles[0]:sugg||''});
  } catch(e){ res.status(500).json({error:e.message}); }

});



// Analytics routes moved to api/analytics.js



// A/B Test routes moved to api/ab-test.js


// AI Coach Memory

// Coach memory routes moved to api/coach-memory.js

// Coach /remember moved to api/coach-memory.js

// Trend Pulse routes moved to api/trend-pulse.js

// Blog listing — dynamically rendered from database

// ── 410 Gone: permanently deleted trash posts (force Bing/Google to purge) ──
const TRASH_SLUGS_410 = [
  'youtube-description-templates', 'how-to-write-youtube-titles',
  'youtube-algorithm-changes-2026', 'youtube-keyword-research-tutorial',
  'how-to-mass-update-youtube-descriptions-safely', 'youtube-shorts-seo-ranking-guide',
  'youtube-tags-generator-vs-vidiq', 'youtube-seo-guide-2026',
];
TRASH_SLUGS_410.forEach(slug => {
  app.get(`/blog/${slug}`, (req, res) => res.status(410).send('Gone'));
});

// ── Blog Categories ──────────────────────────────────────────
const BLOG_CATEGORIES = {
  'monetization': { name: 'Monetization', icon: '💰', desc: 'YouTube monetization requirements, ad revenue, YPP, and income strategies', slugMatch: ['monetiz', 'partner-program', 'ad-revenue', 'ypp'] },
  'shorts': { name: 'Shorts & Vertical Video', icon: '📱', desc: 'YouTube Shorts algorithm, monetization, and growth strategies', slugMatch: ['short'] },
  'analytics': { name: 'Analytics & Metrics', icon: '📊', desc: 'CTR, retention, impressions, and analytics metrics explained', slugMatch: ['analytic', 'retention', 'ctr', 'impression', 'metric'] },
  'optimization': { name: 'SEO Optimization', icon: '🔍', desc: 'Tags, titles, descriptions, thumbnails, and metadata optimization', slugMatch: ['tag', 'title', 'description', 'thumbnail', 'metadata', 'chapter', 'caption', 'transcript', 'keyword', 'search-volume', 'keyword-difficulty'] },
  'strategy': { name: 'Strategy & Planning', icon: '📝', desc: 'Keyword research, competitor analysis, content strategy and planning', slugMatch: ['strategy', 'planning', 'research', 'competitor', 'playlist', 'checklist', 'blueprint'] },
  'growth': { name: 'Channel Growth', icon: '🚀', desc: 'Small channel growth, community building, and audience development', slugMatch: ['small-channel', 'hook', 'community', 'end-screen', 'card', 'intro'] },
  'tools': { name: 'Tool Reviews & Comparisons', icon: '🛠️', desc: 'YouTube SEO tool comparisons, reviews, and alternatives', slugMatch: ['tool', 'vs-', 'vidiq', 'tubebuddy', 'coach'] },
  'niche': { name: 'Niche Channels', icon: '🎯', desc: 'YouTube SEO for gaming, cooking, fitness, music, and business channels', slugMatch: ['gaming', 'cooking', 'fitness', 'music', 'business', 'tutorial'] },
};

function getPostCategory(slug, title) {
  const combined = (slug + ' ' + (title || '')).toLowerCase();
  for (const [key, cat] of Object.entries(BLOG_CATEGORIES)) {
    for (const m of cat.slugMatch) {
      if (combined.includes(m)) return key;
    }
  }
  return null;
}

function renderCategoryHeader(catSlug, pages) {
  const cat = BLOG_CATEGORIES[catSlug];
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link rel="icon" href="/logo.svg" type="image/svg+xml" />'
    + '<title>' + (cat ? cat.icon + ' ' + cat.name : 'All Categories') + ' — YouTube SEO Blog | YT SEO Architect</title>'
    + '<meta name="description" content="' + (cat ? cat.desc : 'Browse YouTube SEO guides by topic — monetization, analytics, strategy, Shorts, and more') + '" />'
    + '<meta name="robots" content="index, follow" />'
    + '<link rel="canonical" href="https://yt-seo-architect.vercel.app/blog' + (catSlug ? '/category/' + catSlug : '/categories') + '" />'
    + '<meta property="og:title" content="' + (cat ? cat.icon + ' ' + cat.name : 'All Categories') + ' — YouTube SEO Blog" />'
    + '<meta property="og:description" content="' + (cat ? cat.desc : 'Browse YouTube SEO guides by topic') + '" />'
    + '<meta name="twitter:card" content="summary_large_image" />'
    + '<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />'
    + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" media="print" onload="this.media=\'all\'" />'
    + '<style>'
    + ':root{--primary:#f97316;--primary-glow:rgba(249,115,22,0.5);--accent:#fb923c;--bg-oled:#000000;--bg-card:rgba(15,23,42,0.5);--text-primary:#f8fafc;--text-muted:#94a3b8;--border:rgba(249,115,22,0.2)}'
    + '*{margin:0;padding:0;box-sizing:border-box}'
    + 'body{font-family:\'Outfit\',\'Geist\',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg-oled);color:var(--text-primary);min-height:100vh;overflow-x:hidden;line-height:1.8}'
    + '.wrap{max-width:900px;margin:0 auto;padding:20px}'
    + 'header{display:flex;justify-content:space-between;align-items:center;padding:10px 0;margin-bottom:40px}'
    + '.logo{display:flex;align-items:center;gap:12px;font-size:1.5rem;font-weight:800;letter-spacing:-0.05em;text-decoration:none;color:var(--text-primary)}'
    + '.logo i{color:var(--primary);filter:drop-shadow(0 0 8px var(--primary-glow))}'
    + '.logo .text-accent{color:var(--accent)}'
    + '.header-nav{display:flex;align-items:center;gap:1.25rem}'
    + '.header-nav a{color:var(--text-muted);text-decoration:none;font-weight:600;font-size:0.9rem;transition:color .2s;display:flex;align-items:center;gap:.35rem}'
    + '.header-nav a:hover{color:var(--text-primary)}'
    + '.header-nav a.nav-cta{background:var(--primary);color:#fff;padding:.45rem 1rem;border-radius:8px;font-size:.85rem;transition:background .2s,transform .2s}'
    + '.header-nav a.nav-cta:hover{background:var(--primary-glow);transform:translateY(-1px)}'
    + '.hero{padding:3rem 1.5rem;background:linear-gradient(135deg,rgba(249,115,22,0.06),rgba(251,146,60,0.02));border:1px solid var(--border);border-radius:1rem;margin-bottom:2rem;text-align:center}'
    + '.hero h1{font-size:clamp(1.6rem,4vw,2.2rem);font-weight:800;margin:0 0 .5rem;color:#fff}'
    + '.hero p{color:var(--text-muted);font-size:1.05rem;max-width:600px;margin:0 auto;line-height:1.7}'
    + '.hero .stat{display:inline-block;margin-top:1rem;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);color:var(--primary);padding:.3rem 1rem;border-radius:9999px;font-size:.85rem;font-weight:600}'
    + '.blog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}'
    + '.blog-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1.25rem;transition:all .3s}'
    + '.blog-card:hover{border-color:var(--primary);transform:translateY(-2px);background:rgba(30,41,59,0.6)}'
    + '.blog-card a{color:var(--text-primary);text-decoration:none;font-weight:600;display:block;margin-bottom:.35rem;font-size:1rem;line-height:1.5}'
    + '.blog-card:hover a{color:var(--primary)}'
    + '.blog-card .meta{font-size:.8rem;color:var(--text-muted)}'
    + '.badge{display:inline-block;background:rgba(249,115,22,0.15);color:var(--primary);padding:.15rem .55rem;border-radius:9999px;font-size:.7rem;font-weight:600;margin-bottom:.4rem;text-transform:uppercase;letter-spacing:.03em}'
    + '.cat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1rem}'
    + '.cat-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1.25rem;text-decoration:none;color:var(--text-primary);transition:all .3s}'
    + '.cat-card:hover{border-color:var(--primary);transform:translateY(-2px)}'
    + '.cat-card .icon{font-size:2rem;margin-bottom:.5rem}'
    + '.cat-card h3{font-size:1rem;margin-bottom:.3rem}'
    + '.cat-card p{font-size:.8rem;color:var(--text-muted);line-height:1.4}'
    + '.cat-card .count{font-size:.75rem;color:var(--primary);margin-top:.5rem;font-weight:600}'
    + '.back-link{display:inline-block;color:var(--primary);text-decoration:none;font-size:.9rem;margin-bottom:1rem}'
    + '.back-link:hover{text-decoration:underline}'
    + '@media(max-width:640px){.hero{padding:2rem 1rem}.hero h1{font-size:1.5rem}header{flex-direction:column;gap:16px}}'
    + '</style></head><body><div class="wrap">'
    + '<header><a href="/" class="logo"><i data-lucide="zap"></i>YT SEO <span class="text-accent">Architect</span></a>'
    + '<nav class="header-nav"><a href="/tools/tag-generator">Free Tools</a><a href="/glossary/">Glossary</a><a href="/dashboard" class="nav-cta">Get Started Free</a></nav></header>';
  return { html, cat };
}

// Category index
app.get(['/blog/categories', '/blog/category'], async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { eq, desc } = await import('drizzle-orm');
    const { validateBlogPost } = await import('./blog-validation.js');
    var pages = await dbService.db.select({ slug: s.seoPages.slug, title: s.seoPages.title, wordCount: s.seoPages.wordCount, content: s.seoPages.content, publishedAt: s.seoPages.publishedAt }).from(s.seoPages).where(eq(s.seoPages.status,'published')).orderBy(desc(s.seoPages.publishedAt));
    pages = pages.filter(p => validateBlogPost({ slug: p.slug, title: p.title, content: p.content, wordCount: p.wordCount }).valid);

    // Count posts per category
    var catCounts = {};
    for (const p of pages) {
      const c = getPostCategory(p.slug, p.title);
      if (c) catCounts[c] = (catCounts[c] || 0) + 1;
    }

    const rendered = renderCategoryHeader(null, pages);
    var fullHtml = rendered.html
      + '<div class="hero"><h1>📚 Blog Categories</h1><p>Browse YouTube SEO guides by topic. Each category clusters related guides for deeper learning.</p>'
      + '<div class="stat">' + Object.keys(catCounts).length + ' categories · ' + pages.length + ' guides</div></div>'
      + '<div class="cat-grid">';

    for (const [slug, cat] of Object.entries(BLOG_CATEGORIES)) {
      const count = catCounts[slug] || 0;
      if (count === 0) continue;
      fullHtml += '<a href="/blog/category/' + slug + '" class="cat-card">'
        + '<div class="icon">' + cat.icon + '</div>'
        + '<h3>' + cat.name + '</h3>'
        + '<p>' + cat.desc + '</p>'
        + '<div class="count">' + count + ' guide' + (count > 1 ? 's' : '') + '</div>'
        + '</a>';
    }

    fullHtml += '</div></div></body></html>';
    res.send(fullHtml);
  } catch(e) { res.status(500).send('Error'); }
});

// Individual category page
app.get('/blog/category/:slug', async (req, res) => {
  try {
    const catSlug = req.params.slug;
    const cat = BLOG_CATEGORIES[catSlug];
    if (!cat) return res.status(404).send('Category not found');

    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { eq, desc } = await import('drizzle-orm');
    const { validateBlogPost } = await import('./blog-validation.js');
    var allPages = await dbService.db.select({ slug: s.seoPages.slug, title: s.seoPages.title, wordCount: s.seoPages.wordCount, content: s.seoPages.content, publishedAt: s.seoPages.publishedAt }).from(s.seoPages).where(eq(s.seoPages.status,'published')).orderBy(desc(s.seoPages.publishedAt));
    allPages = allPages.filter(p => validateBlogPost({ slug: p.slug, title: p.title, content: p.content, wordCount: p.wordCount }).valid);

    var catPages = allPages.filter(p => getPostCategory(p.slug, p.title) === catSlug);

    const rendered = renderCategoryHeader(catSlug, catPages);
    var fullHtml = rendered.html
      + '<div class="hero"><h1>' + cat.icon + ' ' + cat.name + '</h1><p>' + cat.desc + '</p>'
      + '<div class="stat">' + catPages.length + ' guide' + (catPages.length > 1 ? 's' : '') + '</div></div>'
      + '<a href="/blog/categories" class="back-link">← All Categories</a>'
      + '<div class="blog-grid">';

    for (var p of catPages) {
      fullHtml += '<div class="blog-card"><a href="/blog/'+p.slug+'">'+p.title+'</a><div class="meta">'+p.wordCount+' words · '+new Date(p.publishedAt).toLocaleDateString()+'</div></div>';
    }

    fullHtml += '</div></div></body></html>';
    res.send(fullHtml);
  } catch(e) { res.status(500).send('Error'); }
});


app.get('/blog', async (req, res) => {

  try {

    const { default: dbService } = await import('../src/database/services.js');

    const s = await import('../src/database/schema.js');

    const { eq, desc } = await import('drizzle-orm');

    var pages = await dbService.db.select({ slug: s.seoPages.slug, title: s.seoPages.title, wordCount: s.seoPages.wordCount, content: s.seoPages.content, publishedAt: s.seoPages.publishedAt }).from(s.seoPages).where(eq(s.seoPages.status,'published')).orderBy(desc(s.seoPages.publishedAt)).limit(50);

    // Quality gate: only list validated posts (template-compliant, 1,200+ words, no banned words)
    const { validateBlogPost } = await import('./blog-validation.js');
    pages = pages.filter(p => validateBlogPost({ slug: p.slug, title: p.title, content: p.content, wordCount: p.wordCount }).valid);

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><link rel="icon" href="/logo.svg" type="image/svg+xml" />'
      + '<title>YouTube SEO Blog — Guides &amp; Strategies | YT SEO Architect</title>'
      + '<meta name="description" content="Free YouTube SEO guides, tips, and tutorials. Learn keyword research, title optimization, thumbnail A/B testing, and analytics to grow your channel." />'
      + '<meta name="robots" content="index, follow" />'
      + '<link rel="canonical" href="https://yt-seo-architect.vercel.app/blog" />'
      + '<meta property="og:title" content="YouTube SEO Blog — Guides &amp; Strategies" />'
      + '<meta property="og:description" content="Free YouTube SEO guides, tips, and tutorials to grow your channel with AI-powered tools." />'
      + '<meta property="og:image" content="https://yt-seo-architect.vercel.app/og-image.png" />'
      + '<meta name="twitter:card" content="summary_large_image" />'
      + '<link rel="preconnect" href="https://fonts.googleapis.com" />'
      + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />'
      + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" media="print" onload="this.media=\'all\'" />'
      + '<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" /></noscript>'
      + '<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js" crossorigin="anonymous" defer></script>'
      + '<style>'
      + ':root{--primary:#f97316;--primary-glow:rgba(249,115,22,0.5);--accent:#fb923c;--bg-oled:#000000;--bg-card:rgba(15,23,42,0.5);--text-primary:#f8fafc;--text-muted:#94a3b8;--border:rgba(249,115,22,0.2)}'
      + '*{margin:0;padding:0;box-sizing:border-box}'
      + 'body{font-family:\'Outfit\',\'Geist\',-apple-system,BlinkMacSystemFont,sans-serif;background:var(--bg-oled);color:var(--text-primary);min-height:100vh;overflow-x:hidden;line-height:1.8}'
      + '.wrap{max-width:900px;margin:0 auto;padding:20px}'
      + 'header{display:flex;justify-content:space-between;align-items:center;padding:10px 0;margin-bottom:40px}'
      + '.logo{display:flex;align-items:center;gap:12px;font-size:1.5rem;font-weight:800;letter-spacing:-0.05em;text-decoration:none;color:var(--text-primary)}'
      + '.logo i{color:var(--primary);filter:drop-shadow(0 0 8px var(--primary-glow))}'
      + '.logo .text-accent{color:var(--accent)}'
      + '.header-nav{display:flex;align-items:center;gap:1.25rem}'
      + '.header-nav a{color:var(--text-muted);text-decoration:none;font-weight:600;font-size:0.9rem;transition:color .2s;display:flex;align-items:center;gap:.35rem}'
      + '.header-nav a:hover{color:var(--text-primary)}'
      + '.header-nav a.nav-cta{background:var(--primary);color:#fff;padding:.45rem 1rem;border-radius:8px;font-size:.85rem;transition:background .2s,transform .2s}'
      + '.header-nav a.nav-cta:hover{background:var(--primary-glow);transform:translateY(-1px)}'
      + '.hero{padding:3rem 1.5rem;background:linear-gradient(135deg,rgba(249,115,22,0.06),rgba(251,146,60,0.02));border:1px solid var(--border);border-radius:1rem;margin-bottom:2rem;text-align:center}'
      + '.hero h1{font-size:clamp(1.6rem,4vw,2.2rem);font-weight:800;margin:0 0 .5rem;color:#fff}'
      + '.hero p{color:var(--text-muted);font-size:1.05rem;max-width:600px;margin:0 auto;line-height:1.7}'
      + '.hero .stat{display:inline-block;margin-top:1rem;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);color:var(--primary);padding:.3rem 1rem;border-radius:9999px;font-size:.85rem;font-weight:600}'
      + '.blog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}'
      + '.blog-card{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:1.25rem;transition:all .3s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden}'
      + '.blog-card::before{content:\'\';position:absolute;inset:0;background:radial-gradient(circle at top right,rgba(249,115,22,0.1),transparent 70%);opacity:0;transition:opacity .4s ease}'
      + '.blog-card:hover{border-color:var(--primary);transform:translateY(-4px);background:rgba(30,41,59,0.6);box-shadow:0 12px 24px rgba(0,0,0,0.3)}'
      + '.blog-card:hover::before{opacity:1}'
      + '.blog-card a{color:var(--text-primary);text-decoration:none;font-weight:600;display:block;margin-bottom:.35rem;position:relative;z-index:1;transition:color .2s;font-size:1rem;line-height:1.5}'
      + '.blog-card:hover a{color:var(--primary)}'
      + '.blog-card .meta{font-size:.8rem;color:var(--text-muted);position:relative;z-index:1}'
      + '.cta-box{background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(251,146,60,0.03));border:1px solid rgba(249,115,22,0.3);border-radius:16px;padding:2rem;margin:2.5rem 0;text-align:center}'
      + '.cta-box h3{font-size:1.25rem;margin:0 0 .75rem;color:#fff;font-weight:700}'
      + '.cta-box p{color:var(--text-muted);margin:0 0 1.25rem;font-size:1rem}'
      + '.cta-box a{display:inline-flex;align-items:center;gap:8px;background:var(--primary);color:#fff;padding:.75rem 2rem;border-radius:10px;text-decoration:none;font-weight:700;transition:all .3s cubic-bezier(.16,1,.3,1)}'
      + '.cta-box a:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(249,115,22,0.4)}'
      + 'footer{border-top:1px solid var(--border);padding:60px 20px 40px;text-align:center;color:var(--text-muted)}'
      + 'footer a{color:var(--primary);text-decoration:none}'
      + '@media(max-width:640px){.hero{padding:2rem 1rem}.hero h1{font-size:1.5rem}header{flex-direction:column;gap:16px}.blog-grid{grid-template-columns:1fr}}'
      + '</style></head><body><div class="wrap">'
      + '<header><a href="/" class="logo"><i data-lucide="zap"></i>YT SEO <span class="text-accent">Architect</span></a>'
      + '<nav class="header-nav" aria-label="Main navigation">'
      + '<a href="/tools/tag-generator"><i data-lucide="tags" style="width:16px;height:16px"></i> Free Tools</a>'
      + '<a href="/glossary/"><i data-lucide="book" style="width:16px;height:16px"></i> Glossary</a>'
      + '<a href="/dashboard" class="nav-cta">Get Started Free</a>'
      + '</nav></header>'
      + '<div class="hero"><h1>📚 YouTube SEO Blog</h1><p>Expert guides, tips, and strategies to grow your YouTube channel — all free.</p>'
      + '<div class="stat">' + pages.length + ' guides · Free</div></div>'
      + '<div style="text-align:center;margin-bottom:1.5rem"><a href="/blog/categories" style="color:var(--primary);text-decoration:none;font-size:.9rem;font-weight:600;">Browse by Category →</a></div>'
      + '<div class="blog-grid">';

    for (var p of pages) {
      var pCat = getPostCategory(p.slug, p.title);
      var pBadge = pCat ? '<div class="badge">' + BLOG_CATEGORIES[pCat].icon + ' ' + BLOG_CATEGORIES[pCat].name + '</div>' : '';
      html += '<div class="blog-card">'+pBadge+'<a href="/blog/'+p.slug+'">'+p.title+'</a><div class="meta">'+p.wordCount+' words · '+new Date(p.publishedAt).toLocaleDateString()+'</div></div>';

    }

    html += '</div>'
      + '<div class="cta-box"><h3>🚀 Ready to Grow Your Channel?</h3><p>17 AI-powered YouTube SEO tools. Free to start. No credit card required.</p>'
      + '<a href="/dashboard">Start Free →</a></div>'
      + '<footer><p>&copy; 2026 YT SEO Architect &middot; <a href="/glossary/">Glossary</a> &middot; <a href="/blog">Blog</a> &middot; <a href="/tools/">Free Tools</a> &middot; <a href="/privacy-policy">Privacy</a></p></footer>'
      + '</div><script defer>lucide.createIcons();</script></body></html>';

    res.setHeader('Cache-Control', 'no-store');
    res.send(html);

  } catch(e) { res.status(500).send('Error'); }

});



app.get('/blog/:slug', async (req, res) => {

  try {

    var slug = req.params.slug;

    const { default: dbService } = await import('../src/database/services.js');

    const s = await import('../src/database/schema.js');

    const { eq } = await import('drizzle-orm');

    const pages = await dbService.db.select().from(s.seoPages).where(eq(s.seoPages.slug, slug)).limit(1);

    var page = pages[0];

    if (!page) {
      // Fallback: serve from static file if DB doesn't have it
      try {
        const { readFileSync, existsSync } = await import('fs');
        const { resolve } = await import('path');
        const staticPath = resolve(process.cwd(), 'public', 'blog', slug + '.html');
        if (existsSync(staticPath)) {
          var staticHtml = readFileSync(staticPath, 'utf-8');
          return res.send(staticHtml);
        }
      } catch (_) { /* ignore fs errors */ }
      return res.status(404).send('Page not found');
    }

    const { renderBlogTemplate } = await import('./blog-renderer.js');
    var html = renderBlogTemplate(page);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(html);

    } catch(e) { 
    console.error('[Blog Render Error]:', e.message);
    res.status(500).send('Error'); 
    }
    });


// AI Content Strategy Planner

app.post('/api/content-strategy/generate', async (req, res) => {

  try {

    var niche = req.body?.niche || 'General';

    var goal = req.body?.goal || 'growth';

    const { askAI } = await import('./_lib/ai-provider.js');

    var raw = await askAI('You are a YouTube content strategist. Return ONLY valid JSON.',

      'Plan a 5-video YouTube series for niche:"'+niche+'" goal:"'+goal+'". JSON: {"seriesName":"Series Title","videos":[{"title":"...","angle":"unique hook","targetKeyword":"keyword"}]}',

      { temperature:0.7, maxTokens:1500, forceJson:true }

    );

    var data = JSON.parse(raw.replace(/```json|```/g,'').trim());

    const { default: dbService } = await import('../src/database/services.js');

    const s = await import('../src/database/schema.js');

    var series = await dbService.db.insert(s.contentSeries).values({ seriesName:data.seriesName, niche, goal, totalVideos: data.videos?.length||5 }).returning();

    for (var i=0; i<(data.videos||[]).length; i++) {

      var v = data.videos[i];

      await dbService.db.insert(s.contentPlanItems).values({ seriesId:series[0].id, title:v.title, angle:v.angle, targetKeyword:v.targetKeyword, orderInSeries:i+1, plannedDate: new Date(Date.now()+i*7*86400000) });

    }

    res.json({ series: series[0], videos: data.videos });

  } catch(e) { res.status(500).json({ error: e.message }); }

});



app.get('/api/content-strategy/series', async (req, res) => {

  try {

    const { default: dbService } = await import('../src/database/services.js');

    const s = await import('../src/database/schema.js');

    var series = await dbService.db.select().from(s.contentSeries).limit(20);

    res.json({ series });

  } catch(e) { res.json({ series:[] }); }

});



// Phase 11C + Task 14 — Agent cron trigger & manual trigger
app.get('/api/cron/daily-growth-pulse', async (req, res) => {
  try {
    const results = await runAutonomousLoop();
    
    // ── Auto-advance A/B tests stuck in their current phase (48h window) ──
    (async function advanceAbTests() {
      try {
        const { default: dbService } = await import('../src/database/services.js');
        const tests = await dbService.getRunningAbTests();
        const cutoff = Date.now() - (48 * 60 * 60 * 1000);
        const ready = tests.filter(t => new Date(t.phaseStartedAt).getTime() < cutoff);
        if (ready.length > 0) {
          // Re-use the advance logic by calling the AB test endpoint internally
          const users = await dbService.getAllUsers(100);
          const user = users.find(u => u.metadata?.accessToken);
          if (user) {
            for (const test of ready) {
              try {
                const advRes = await fetch(`https://yt-seo-architect.vercel.app/api/ab-test/advance`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ testId: test.id, accessToken: user.metadata.accessToken })
                });
                if (advRes.ok) { /* AB-CRON test advanced */ }
              } catch(e) { /* individual test failure non-blocking */ }
            }
          }
        }
      } catch(e) { console.warn('[AB-CRON] Auto-advance failed:', e.message); }
    })();
    
    res.json(results);
  } catch (e) {
    console.error('[AGENT] Cron failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── Cron: Daily Blog Posts — auto-publishes 2 SEO-optimised blog posts per day ──
// BLOG POSTS PERMANENTLY DISABLED — route removed (2026-05-19)
// app.get('/api/cron/daily-blog-posts', dailyBlogCronHandler);

app.post('/api/agent/trigger', async (req, res) => {
  try {
    const targetChannelId = req.headers['x-channel-id'] || null;
    const results = await runAutonomousLoop(targetChannelId);
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Force database migration (legacy)
app.get('/api/agent/migrate', async (req, res) => {
  try {
    // Try main migration (may fail on multi-statement for Neon)
    try {
      const { runMigrations } = await import('../src/database/migrate.js');
      await runMigrations();
    } catch (migErr) {
      console.warn('[Agent] Main migration skipped (tables may exist):', migErr.message);
    }
    // Ensure agent tables exist individually (Neon-safe, one per call)
    try {
      const neon = await import('@neondatabase/serverless');
      const sql = neon.neon(process.env.DATABASE_URL);
      // Nuclear fix: ensure agent_settings has channel_id column
      try { await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS channel_id TEXT`; } catch(e) {}
      // If still missing, recreate with proper schema
      try {
        const check = await sql`SELECT channel_id FROM agent_settings LIMIT 1`;
      } catch(e) {
        // Column truly doesn't exist — backup settings, drop, recreate
        console.warn('[Migrate] agent_settings missing channel_id — recreating');
        const backup = await sql`SELECT * FROM agent_settings LIMIT 1`.catch(() => []);
        await sql`DROP TABLE IF EXISTS agent_settings CASCADE`;
        await sql`CREATE TABLE agent_settings (id TEXT PRIMARY KEY DEFAULT 'global', channel_id TEXT, is_autonomous BOOLEAN DEFAULT false, auto_publish_pseo BOOLEAN DEFAULT false, auto_apply_seo_score_threshold INTEGER DEFAULT 90, max_daily_optimizations INTEGER DEFAULT 10, dry_run_mode BOOLEAN DEFAULT true, confidence_threshold_auto INTEGER DEFAULT 85, enable_rollback BOOLEAN DEFAULT true, goal TEXT, persona_style TEXT DEFAULT 'architect', communication_detail TEXT DEFAULT 'structured', is_running BOOLEAN DEFAULT false, notify_email TEXT, webhook_url TEXT, max_active_branches INTEGER DEFAULT 3, memory_limit_mb INTEGER DEFAULT 512, batch_size INTEGER DEFAULT 25, reasoning_depth INTEGER DEFAULT 2, last_run_at TIMESTAMP WITH TIME ZONE, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`;
        if (backup.length > 0) {
          await sql`INSERT INTO agent_settings (id, is_autonomous, goal, is_running) VALUES ('global', ${backup[0].is_autonomous || false}, ${backup[0].goal || null}, false)`;
        } else {
          await sql`INSERT INTO agent_settings (id, is_autonomous) VALUES ('global', false)`;
        }
      }
      await sql`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT UNIQUE,
        email TEXT,
        plan TEXT DEFAULT 'free',
        credits INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS channel_id TEXT UNIQUE`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free'`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb`;
      await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
      // Emergency: ensure channel_id exists regardless of current column naming
      try { await sql`ALTER TABLE users RENAME COLUMN "channelId" TO channel_id`; } catch(e) {}
      try { await sql`ALTER TABLE users RENAME COLUMN channelid TO channel_id`; } catch(e) {}
      // Diagnostic: log users table columns
      let usersCols = [];
      try {
        usersCols = await sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`;
      } catch(e) { /* skip */ }
      // NOTE: all SQL below runs before response
      await sql`CREATE TABLE IF NOT EXISTS agent_activity_logs (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, channel_id TEXT, agent_name TEXT NOT NULL, action_taken TEXT NOT NULL, impact_description TEXT, status TEXT DEFAULT 'success', created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW())`;
      await sql`ALTER TABLE agent_activity_logs ADD COLUMN IF NOT EXISTS channel_id TEXT`;
      await sql`ALTER TABLE agent_activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`;
      // Populate optimization_queue schema columns (queue insert fix — action_type/confidence/ev_score/rationale)
      await sql`ALTER TABLE optimization_queue ADD COLUMN IF NOT EXISTS action_type TEXT`;
      await sql`ALTER TABLE optimization_queue ADD COLUMN IF NOT EXISTS confidence INTEGER`;
      await sql`ALTER TABLE optimization_queue ADD COLUMN IF NOT EXISTS ev_score REAL`;
      await sql`ALTER TABLE optimization_queue ADD COLUMN IF NOT EXISTS rationale TEXT`;
      await sql`INSERT INTO agent_settings (id, is_autonomous) VALUES ('global', false) ON CONFLICT (id) DO NOTHING`;
      // Coach memory table (Task 07) — use Drizzle connection for consistency
      try {
        const { default: dbService2 } = await import('../src/database/services.js');
        const s2 = await import('../src/database/schema.js');
        const { sql: dsql } = await import('drizzle-orm');
        await dbService2.db.run(dsql`CREATE TABLE IF NOT EXISTS coach_memory (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          channel_id TEXT NOT NULL UNIQUE,
          niche TEXT,
          content_goals JSONB DEFAULT '[]'::jsonb,
          problem_videos JSONB DEFAULT '[]'::jsonb,
          focus_keywords JSONB DEFAULT '[]'::jsonb,
          upload_frequency TEXT,
          pain_points JSONB DEFAULT '[]'::jsonb,
          wins JSONB DEFAULT '[]'::jsonb,
          last_conversation TEXT,
          conversation_count INTEGER DEFAULT 0,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`);
      } catch (cErr) { console.warn('[Agent] coach_memory creation:', cErr.message); }
      // Agent learning + safety tables (Phases 4-5)
      try {
        await sql`CREATE TABLE IF NOT EXISTS agent_learning (id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text, action_type TEXT NOT NULL, niche TEXT DEFAULT 'General', success_rate REAL DEFAULT 0.5, avg_lift REAL DEFAULT 0, sample_size INTEGER DEFAULT 0, recent_skips INTEGER DEFAULT 0, recent_successes INTEGER DEFAULT 0, last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW())`;

      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS dry_run_mode BOOLEAN DEFAULT true`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS confidence_threshold_auto INTEGER DEFAULT 85`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS enable_rollback BOOLEAN DEFAULT true`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS channel_id TEXT`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS goal TEXT`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS persona_style TEXT DEFAULT 'architect'`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS communication_detail TEXT DEFAULT 'structured'`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS is_running BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS notify_email TEXT`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS webhook_url TEXT`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS max_active_branches INTEGER DEFAULT 3`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS memory_limit_mb INTEGER DEFAULT 512`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 25`;
      await sql`ALTER TABLE agent_settings ADD COLUMN IF NOT EXISTS reasoning_depth INTEGER DEFAULT 2`;
      // ── Scan results + agent recommendations tables (Phronesis 3-column UI) ──
      await sql`CREATE TABLE IF NOT EXISTS scan_results (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT NOT NULL,
        video_id TEXT NOT NULL,
        video_title TEXT,
        title_score INTEGER DEFAULT 0,
        desc_score INTEGER DEFAULT 0,
        tag_score INTEGER DEFAULT 0,
        overall_score INTEGER DEFAULT 0,
        ctr_signal INTEGER DEFAULT 0,
        retention_score INTEGER DEFAULT 0,
        niche_alignment INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        engagement REAL DEFAULT 0,
        issues JSONB DEFAULT '[]'::jsonb,
        scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;
      await sql`ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS current_description TEXT`;
      await sql`ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS current_tags JSONB DEFAULT '[]'::jsonb`;
      await sql`CREATE TABLE IF NOT EXISTS agent_recommendations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT DEFAULT 'unknown',
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        read_status BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;
      await sql`CREATE INDEX IF NOT EXISTS idx_scan_results_channel ON scan_results(channel_id)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_scan_results_scanned ON scan_results(scanned_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS idx_agent_recs_channel ON agent_recommendations(channel_id)`;

      // ── Goals table (DB-persisted, replaces in-memory goalStore) ──
      await sql`CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        target INTEGER NOT NULL,
        current INTEGER DEFAULT 0,
        initial_current INTEGER DEFAULT 0,
        deadline TEXT,
        status TEXT DEFAULT 'active',
        phases JSONB DEFAULT '[]'::jsonb,
        progress JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )`;
      await sql`ALTER TABLE goals ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}'::jsonb`;

      // Migrate existing goals from agent_settings.goal column
      try {
        await sql`
          INSERT INTO goals (channel_id, type, target, status)
          SELECT COALESCE(channel_id, 'global'), 'subscribers',
            CASE WHEN goal ~ '^\d+$' THEN goal::integer ELSE 1000 END,
            'active'
          FROM agent_settings WHERE goal IS NOT NULL AND goal != '' AND channel_id IS NOT NULL
          ON CONFLICT (channel_id) DO NOTHING
        `;
      } catch (migErr) { console.warn('[Migration] goal migration:', migErr.message); }

      // ── Agent Jobs table (async job tracking) ──
      await sql`CREATE TABLE IF NOT EXISTS agent_jobs (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        channel_id TEXT NOT NULL,
        tool TEXT NOT NULL,
        status TEXT DEFAULT 'queued',
        progress INTEGER DEFAULT 0,
        result JSONB DEFAULT '{}'::jsonb,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        completed_at TIMESTAMP WITH TIME ZONE
      )`;

      } catch (sErr) { console.warn('[Agent] Safety migration:', sErr.message); }
      res.json({ success: true, message: 'Agent tables created' });
    } catch (tableErr) {
      console.error('[Agent] Table creation failed:', tableErr.message);
      res.json({ success: false, error: tableErr.message });
    }
  } catch(e) { res.json({ success: false, error: e.message }); }
});

// --- Dev: Refill credits

app.post('/api/dev/refill', requireAdmin, async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId || 'anonymous';
    try {
      const { default: dbService } = await import('../src/database/services.js');
      const s = await import('../src/database/schema.js');
      // Ensure user exists first (upsert)
      try {
        await dbService.db.insert(s.users).values({
          channelId, credits: 999, plan: 'agency', metadata: {}
        }).onConflictDoUpdate({
          target: s.users.channelId,
          set: { credits: 999, plan: 'agency', updatedAt: new Date() }
        });
      } catch(insertErr) {
        // Fallback: try update
        if (dbService && typeof dbService.updateUserCredits === 'function') {
          await dbService.updateUserCredits(channelId, 999);
        }
      }
      // Also sync plan to agent_settings
      try {
        await dbService.db.insert(s.agentSettings).values({
          channelId, isAutonomous: false, updatedAt: new Date()
        }).onConflictDoUpdate({
          target: s.agentSettings.channelId,
          set: { updatedAt: new Date() }
        }).catch(() => {});
      } catch(e) {}
    } catch (dbErr) {
      console.warn('[Dev Refill] DB unavailable:', dbErr.message);
    }
    res.json({ success: true, credits: 999, plan: 'agency', message: 'Credits refilled + plan set to agency' });

  } catch (e) {

    res.status(500).json({ error: e.message });

  }

});



// --- PayPal Webhook Proxy (Fortress Layer) ---

app.post('/api/paypal/webhook', (req, res) => {

  // Delegate to credits router logic

  req.url = '/paypal/webhook';

  creditsRouter(req, res);

});



// --- Legacy / Root API Routes ---

app.get('/api/quota/status', (req, res) => {

  res.status(200).json({ usedToday: 1500, limit: 10000 });

});



app.post('/api/save-state', (req, res) => {

  const { channelId, state } = req.body;

  if (!channelId) return res.status(400).json({ error: 'Missing channelId' });

  res.status(200).json({ success: true });

});



// ── Pillar Page: Ultimate Guide to YouTube SEO ──────────────────────────

function renderPillarPage() {
  const guides = [
    { slug: 'youtube-algorithm-checklist-2026', title: 'YouTube Algorithm Checklist 2026' },
    { slug: 'youtube-seo-checklist-beginners-2026', title: 'YouTube SEO Checklist for Beginners 2026' },
    { slug: 'youtube-tags-2026', title: 'YouTube Tags 2026' },
    { slug: 'youtube-title-examples-2026', title: 'YouTube Title Examples That Get Clicks' },
    { slug: 'how-to-keywords-youtube', title: 'How to Find YouTube Keywords' },
    { slug: 'how-to-metadata-youtube', title: 'How to Optimize YouTube Metadata' },
    { slug: 'youtube-description-templates-2026', title: 'YouTube Description Templates' },
    { slug: 'youtube-thumbnail-ab-testing-guide', title: 'Thumbnail A/B Testing Guide' },
    { slug: 'youtube-analytics-explained-2026', title: 'YouTube Analytics Explained' },
    { slug: 'youtube-retention-graph-explained-2026', title: 'Retention Graph Explained' },
    { slug: 'youtube-impressions-guide-2026', title: 'YouTube Impressions Guide' },
    { slug: 'youtube-competitor-analysis-reverse-engineer', title: 'Competitor Analysis' },
    { slug: 'youtube-playlist-optimization-strategy', title: 'Playlist Optimization Strategy' },
    { slug: 'youtube-monetization-2026', title: 'YouTube Monetization 2026' },
    { slug: 'youtube-shorts-algorithm-2026', title: 'YouTube Shorts Algorithm 2026' },
    { slug: 'youtube-for-small-channels-2026', title: 'YouTube for Small Channels' },
    { slug: 'youtube-end-screens-cards-guide-2026', title: 'End Screens & Cards Guide' },
    { slug: 'best-youtube-seo-tools-2026', title: 'Best YouTube SEO Tools 2026' },
    { slug: 'github-seo-backlinks-guide', title: 'GitHub SEO Backlinks Guide' },
  ];

  let guideLinks = guides.map((g, i) =>
    `<li><a href="/blog/${g.slug}" class="guide-link">${g.title}</a></li>`
  ).join('\n      ');

  const glossarySections = [
    { name: 'Analytics', icon: '📊', terms: ['Click-Through Rate', 'Average View Duration', 'Audience Retention', 'Watch Time', 'Impressions', 'YouTube Analytics', 'Traffic Sources'] },
    { name: 'Algorithm', icon: '🤖', terms: ['YouTube Algorithm', 'Session Time', 'Search Ranking Factors', 'Dwell Time', 'Topic Authority', 'Shorts Algorithm', 'Browse Features'] },
    { name: 'SEO & Optimization', icon: '🔍', terms: ['Keyword Research', 'Long-Tail Keywords', 'Search Volume', 'Keyword Difficulty', 'Title Optimization', 'YouTube Tags', 'Description Optimization', 'Thumbnail Optimization', 'Video Chapters', 'Transcript SEO'] },
    { name: 'Monetization', icon: '💰', terms: ['YouTube Partner Program', 'Ad Revenue', 'Demonetization', 'Shorts Monetization', 'RPM', 'CPM', 'Mid-Roll Ads'] },
    { name: 'Content Strategy', icon: '📝', terms: ['Video Hook', 'Content Pillar', 'Evergreen Content', 'Content Calendar', 'Content Gap Analysis', 'Content Repurposing'] },
  ];

  let glossaryHTML = glossarySections.map(s =>
    `<div style="margin-bottom:2rem"><h3 style="color:#fb923c;margin-bottom:.75rem">${s.icon} ${s.name}</h3><div style="display:flex;flex-wrap:wrap;gap:.5rem">${
      s.terms.map(t => `<a href="/glossary/${t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}" class="glossary-pill" style="display:inline-block;background:rgba(249,115,22,0.1);color:#fb923c;padding:.3rem .8rem;border-radius:9999px;font-size:.85rem;text-decoration:none;border:1px solid rgba(249,115,22,0.2);transition:all .2s">${t}</a>`).join('')
    }</div></div>`
  ).join('\n      ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="icon" href="/favicon.ico" />
  <title>The Ultimate Guide to YouTube SEO (2026) — Complete Resource | YT SEO Architect</title>
  <meta name="description" content="The complete YouTube SEO resource covering keyword research, title optimization, tags, descriptions, thumbnails, algorithm updates, analytics, and monetization. 33+ guides, 75+ glossary terms, 17 free tools." />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://yt-seo-architect.vercel.app/guide/youtube-seo" />
  <meta property="og:type" content="article" />
  <meta property="og:title" content="The Ultimate Guide to YouTube SEO (2026) — Complete Resource" />
  <meta property="og:description" content="Everything you need to rank on YouTube in 2026. 33 guides, 75 glossary terms, 17 free tools — all in one place." />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "The Ultimate Guide to YouTube SEO (2026)",
    "description": "Complete YouTube SEO resource covering all aspects of ranking on YouTube in 2026.",
    "datePublished": "2026-07-24",
    "dateModified": "2026-07-24",
    "author": { "@type": "Person", "name": "Patrick" },
    "publisher": { "@type": "Organization", "name": "YT SEO Architect" },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "https://yt-seo-architect.vercel.app/guide/youtube-seo" }
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <style>
    :root{--primary:#f97316;--accent:#fb923c;--bg:#000;--surface:rgba(15,23,42,0.5);--text:#f8fafc;--muted:#94a3b8;--border:rgba(249,115,22,0.2)}
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Outfit','Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.8;overflow-x:hidden}
    .wrap{max-width:800px;margin:0 auto;padding:20px}
    header{display:flex;justify-content:space-between;align-items:center;padding:1rem 0;margin-bottom:2rem;border-bottom:1px solid var(--border)}
    .logo{font-size:1.3rem;font-weight:800;text-decoration:none;color:var(--text)}
    .logo span{color:var(--accent)}
    .nav-cta{background:var(--primary);color:#fff;padding:.45rem 1.1rem;border-radius:8px;text-decoration:none;font-weight:600;font-size:.85rem}
    h1{font-size:2.2rem;font-weight:800;line-height:1.3;margin-bottom:1rem;background:linear-gradient(135deg,#fff,var(--accent));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
    h2{font-size:1.5rem;margin:3rem 0 1rem;color:var(--primary);padding-bottom:.5rem;border-bottom:1px solid var(--border)}
    h3{font-size:1.15rem;margin:1.5rem 0 .75rem;color:var(--text)}
    p{margin-bottom:1.25rem;color:var(--muted)}
    .section-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;transition:border-color .2s}
    .section-card:hover{border-color:var(--primary)}
    .section-card h3{margin-top:0;color:var(--accent)}
    .section-card p{font-size:.95rem;margin-bottom:.5rem}
    .section-card a{color:var(--primary);text-decoration:none;font-weight:600}
    .section-card a:hover{text-decoration:underline}
    .pill{display:inline-block;background:rgba(249,115,22,0.1);color:var(--primary);padding:.25rem .7rem;border-radius:9999px;font-size:.8rem;text-decoration:none;margin:.2rem;border:1px solid rgba(249,115,22,0.2)}
    .pill:hover{background:rgba(249,115,22,0.2)}
    ul{margin:1rem 0 1.5rem 1.5rem;color:var(--muted)}
    li{margin-bottom:.4rem}
    a{color:var(--primary)}
    .guide-link{color:var(--muted);text-decoration:none;transition:color .2s}
    .guide-link:hover{color:var(--primary)}
    .cta-box{background:linear-gradient(135deg,rgba(249,115,22,0.08),rgba(251,146,60,0.03));border:1px solid rgba(249,115,22,0.3);border-radius:16px;padding:2rem;margin:2.5rem 0;text-align:center}
    .cta-box h3{color:#fff;margin-bottom:.5rem;font-size:1.25rem}
    .cta-box p{color:var(--muted);margin-bottom:1.25rem}
    .cta-box a{display:inline-block;background:var(--primary);color:#fff;padding:.75rem 2rem;border-radius:10px;text-decoration:none;font-weight:700}
    .cta-box a:hover{transform:translateY(-2px)}
    footer{text-align:center;padding:2rem 0;border-top:1px solid var(--border);color:var(--muted);font-size:.85rem}
    @media(max-width:640px){h1{font-size:1.6rem}header{flex-direction:column;gap:12px}}
    .pill-grid{display:flex;flex-wrap:wrap;gap:.4rem}
    .glossary-pill:hover{background:rgba(249,115,22,0.25)!important;transform:translateY(-1px)}
  </style>
</head>
<body>
<div class="wrap">
  <header>
    <a href="/" class="logo">⚡ YT SEO <span>Architect</span></a>
    <a href="/dashboard" class="nav-cta">Start Free →</a>
  </header>

  <h1>The Ultimate Guide to YouTube SEO (2026)</h1>
  <p style="font-size:1.05rem;color:#d1d5db">Everything you need to rank higher, get more views, and grow your channel — all from one place. 33 guides, 75+ glossary terms, 17 free tools, and AI-powered automation.</p>

  <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:2rem">
    <span style="color:var(--muted);font-size:.9rem">📚 33 guides</span>
    <span style="color:var(--muted);font-size:.9rem">📖 75+ glossary terms</span>
    <span style="color:var(--muted);font-size:.9rem">🛠️ 17 free tools</span>
    <span style="color:var(--muted);font-size:.9rem">🤖 AI-powered</span>
  </div>

  <h2>1. 🎯 Quick Start — Where to Begin</h2>
  <p>YouTube SEO starts with understanding what the algorithm wants. The single highest-impact change you can make today is <strong>title optimization</strong> — it directly increases click-through rate, which signals YouTube to promote your video to more viewers.</p>
  <p>Use our <a href="/tools/tag-generator">Free Tag Generator</a> to see how it works, then read the <a href="/blog/youtube-title-examples-2026">Title Examples Guide</a> for formulas that work.</p>

  <div class="cta-box">
    <h3>🚀 Start Here: Free Channel Audit</h3>
    <p>AI analyzes your titles, tags, descriptions, and thumbnails. Get actionable fixes in 60 seconds.</p>
    <a href="/dashboard">Run My Free Audit →</a>
  </div>

  <h2>2. 📖 YouTube SEO Guides (33 Articles)</h2>
  <div class="section-card">
    <p>Every guide we've written — organized by topic. Click any to dive deep.</p>
    <ul>
      ${guideLinks}
    </ul>
  </div>

  <h2>3. 🛠️ Free YouTube SEO Tools</h2>
  <div class="section-card">
    <p>All 17 tools are 100% free. No login required for most tools.</p>
    <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-top:1rem">
      <a href="/tools/tag-generator" class="pill">🏷️ Tag Generator</a>
      <a href="/tools/title-optimizer" class="pill">📝 Title Optimizer</a>
      <a href="/tools/description-writer" class="pill">📄 Description Writer</a>
      <a href="/dashboard" class="pill">🔍 Channel Audit</a>
      <a href="/dashboard" class="pill">🎯 Keyword Research</a>
      <a href="/dashboard" class="pill">🤖 AI Coach</a>
      <a href="/dashboard" class="pill">👁️ Thumbnail Analyzer</a>
      <a href="/dashboard" class="pill">📊 Retention Analyzer</a>
      <a href="/dashboard" class="pill">🔄 A/B Title Tester</a>
      <a href="/dashboard" class="pill">📈 Trend Pulse</a>
      <a href="/dashboard" class="pill">🎬 Script Generator</a>
      <a href="/dashboard" class="pill">💬 Comment Auto-Reply</a>
      <a href="/dashboard" class="pill">📋 Playlist Strategy</a>
      <a href="/dashboard" class="pill">🏁 End Screen Planner</a>
      <a href="/dashboard" class="pill">📑 Metadata Auditor</a>
      <a href="/dashboard" class="pill">🎯 Competitor Sniper</a>
      <a href="/dashboard" class="pill">⚡ Bulk Injector</a>
    </div>
  </div>

  <h2>4. 📖 YouTube SEO Glossary (75+ Terms)</h2>
  <p>Every term defined, explained, and linked to relevant guides. Click any term to learn more.</p>
  ${glossaryHTML}

  <div class="cta-box">
    <h3>🎯 Compare YT SEO Architect vs The Competition</h3>
    <p>See how 17 free AI tools stack up against paid alternatives.</p>
    <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
      <a href="/vs/vidiq" style="background:rgba(249,115,22,0.15);color:#fff;padding:.6rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600">vs vidIQ →</a>
      <a href="/vs/tubebuddy" style="background:rgba(249,115,22,0.15);color:#fff;padding:.6rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:600">vs TubeBuddy →</a>
    </div>
  </div>

  <h2>5. 💰 Monetization & Growth</h2>
  <div class="section-card">
    <p>Learn how to monetize your channel and grow sustainably. From YPP requirements to ad revenue optimization.</p>
    <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem">
      <a href="/blog/youtube-monetization-2026" class="pill">💰 Monetization 2026</a>
      <a href="/blog/youtube-monetization-tips-2026" class="pill">💡 Monetization Tips</a>
      <a href="/blog/youtube-shorts-monetization-requirements-2026" class="pill">📱 Shorts Monetization</a>
      <a href="/blog/youtube-for-small-channels-2026" class="pill">🚀 Small Channels</a>
    </div>
  </div>

  <h2>6. 📊 Analytics & Algorithm</h2>
  <div class="section-card">
    <p>Understand the data behind your channel's performance and how the algorithm decides what to recommend.</p>
    <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.75rem">
      <a href="/blog/youtube-analytics-explained-2026" class="pill">📊 Analytics Guide</a>
      <a href="/blog/youtube-analytics-4-metrics-that-matter" class="pill">🎯 4 Key Metrics</a>
      <a href="/blog/youtube-retention-graph-explained-2026" class="pill">📈 Retention Graph</a>
      <a href="/blog/youtube-impressions-guide-2026" class="pill">👁️ Impressions</a>
      <a href="/blog/what-does-youtube-ctr-actually-mean" class="pill">🎯 CTR Explained</a>
    </div>
  </div>

  <div class="cta-box">
    <h3>⚡ Ready to Optimize Your Channel?</h3>
    <p>Join thousands of creators using YT SEO Architect. 100% free. No credit card required.</p>
    <a href="/dashboard">Get Started Free →</a>
  </div>

  <footer>
    <p>© 2026 YT SEO Architect &middot; <a href="/blog">Blog</a> &middot; <a href="/glossary/">Glossary</a> &middot; <a href="/tools/">Free Tools</a> &middot; <a href="/privacy-policy">Privacy</a></p>
  </footer>
</div>
</body>
</html>`;
}

app.get('/guide/youtube-seo', (req, res) => {
  res.send(renderPillarPage());
});

// ── Admin: Cleanup programmatic SEO posts (delete everything not in approved list) ──
// Whitelist: only hand-crafted posts with 8+ min read time following _TEMPLATE.html.
// Quality gate: word count ≥ 1600 (≈ 8 min read). Shorter posts are excluded.
// Protected by CRON_SECRET.
// Approved hand-crafted blog posts (template-compliant, 1,200+ words, 5 FAQs, author box, breadcrumb)
const APPROVED_BLOG_SLUGS = [
  'best-youtube-seo-tools-2026', 'github-seo-backlinks-guide',
  'how-to-fix-youtube-shadow-ban-2026', 'what-does-youtube-ctr-actually-mean',
  'youtube-ai-seo-coach-phronesis-2026', 'youtube-analytics-4-metrics-that-matter',
  'youtube-analytics-explained-2026', 'youtube-competitor-analysis-reverse-engineer',
  'youtube-description-templates-2026', 'youtube-end-screens-cards-guide-2026',
  'youtube-metadata-auditor-vs-vidiq-shadow-ban', 'youtube-retention-graph-explained-2026',
  'youtube-seo-audit-diagnostic-fix-2026', 'youtube-thumbnail-ab-testing-guide',
  'youtube-video-not-getting-views-diagnostic-fix-2026',
  'youtube-shorts-seo-ranking-guide-2026',
  'how-to-increase-youtube-retention-2026',
  'youtube-shorts-vs-long-form-2026',
  'youtube-algorithm-checklist-2026',
  'youtube-community-posts-strategy-2026',
  'youtube-chapter-timestamps-seo-guide'
];

app.get('/api/admin/trash-posts', async (req, res) => {
  try {
    if (req.query.secret !== process.env.CRON_SECRET) return res.status(403).json({ error: 'Forbidden' });
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { notInArray, eq } = await import('drizzle-orm');
    const pages = await dbService.db.select({
      slug: s.seoPages.slug, title: s.seoPages.title,
      wordCount: s.seoPages.wordCount, status: s.seoPages.status,
      publishedAt: s.seoPages.publishedAt
    }).from(s.seoPages).where(eq(s.seoPages.status, 'published'))
      .orderBy(s.seoPages.publishedAt).limit(100);
    const trash = pages.filter(p => !APPROVED_BLOG_SLUGS.includes(p.slug));
    res.json({ 
      total: pages.length, 
      trash: trash.length, 
      all: pages.map(p => ({ slug: p.slug, wordCount: p.wordCount, title: p.title?.substring(0,60) })),
      trashPosts: trash 
    });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/admin/trash-posts', async (req, res) => {
  try {
    if ((req.body?.secret || req.query.secret) !== process.env.CRON_SECRET) return res.status(403).json({ error: 'Forbidden' });
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { notInArray } = await import('drizzle-orm');
    const result = await dbService.db.delete(s.seoPages).where(
      notInArray(s.seoPages.slug, APPROVED_BLOG_SLUGS)
    ).returning({ slug: s.seoPages.slug, title: s.seoPages.title });
    res.json({ deleted: result.length, posts: result });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Dynamic Sitemap (quality-gated) ──────────────────────────────────
app.get('/sitemap.xml', async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { eq, desc } = await import('drizzle-orm');
    const { validateBlogPost } = await import('./blog-validation.js');
    const { readFileSync } = await import('fs');
    const { resolve, dirname } = await import('path');
    const { fileURLToPath } = await import('url');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const allPages = await dbService.db.select()
      .from(s.seoPages)
      .where(eq(s.seoPages.status, 'published'))
      .orderBy(desc(s.seoPages.publishedAt))
      .limit(500);

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    // Core static pages (always included)
    const corePages = [
      { loc: '/', priority: '1.0', changefreq: 'weekly' },
      { loc: '/dashboard', priority: '0.9', changefreq: 'weekly' },
      { loc: '/blog', priority: '0.9', changefreq: 'daily' },
      { loc: '/about', priority: '0.5', changefreq: 'monthly' },
      { loc: '/tools', priority: '0.9', changefreq: 'weekly' },
      { loc: '/changelog', priority: '0.6', changefreq: 'monthly' },
      { loc: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
      { loc: '/terms-of-service', priority: '0.3', changefreq: 'yearly' },
    ];
    for (const p of corePages) {
      xml += `  <url><loc>https://yt-seo-architect.vercel.app${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>\n`;
    }

    // Free tool pages (dynamic list synced with blog posts)
    const TOOL_SLUGS = [
      "tag-generator", "title-optimizer", "description-writer",
      "best-youtube-seo-tools-2026", "fix-youtube-shadow-ban-2026",
      "keywords-youtube", "metadata-youtube", "rank-on-youtube-2026",
      "youtube-ctr-actually-mean", "youtube-ai-seo-coach-phronesis-2026",
      "youtube-algorithm-changes-2026", "youtube-analytics-4-metrics-that-matter",
      "youtube-analytics-explained-2026", "youtube-chapter-timestamps-seo-guide",
      "youtube-community-posts-strategy-2026", "youtube-competitor-analysis-reverse-engineer",
      "youtube-description-templates-2026", "youtube-end-screens-cards-guide-2026",
      "youtube-for-small-channels-2026", "youtube-for-tutorials-2026",
      "youtube-impressions-guide-2026", "youtube-intro-hook-first-3-seconds",
      "youtube-metadata-auditor-vs-vidiq-shadow-ban", "youtube-monetization-tips-2026",
      "youtube-playlist-optimization-strategy", "youtube-retention-graph-explained-2026",
      "youtube-seo-audit-diagnostic-fix-2026", "youtube-seo-checklist-beginners-2026",
      "youtube-seo-examples-2026", "youtube-seo-for-business-channels-2026",
      "youtube-seo-for-gaming-channels-2026", "youtube-seo-template-2026",
      "youtube-shorts-seo-ranking-guide-2026", "youtube-tags-2026",
      "youtube-thumbnail-ab-testing-guide", "youtube-title-examples-2026",
      "youtube-video-not-getting-views-diagnostic-fix-2026",
    ];
    for (const slug of TOOL_SLUGS) {
      xml += `  <url><loc>https://yt-seo-architect.vercel.app/tools/${slug}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n`;
    }

    // Glossary term pages (scan filesystem — always accurate)
    const { readdirSync } = await import('fs');
    const GLOSSARY_DIR = resolve(__dirname, '../public/glossary');

    let glossaryFiles = [];
    try {
      glossaryFiles = readdirSync(GLOSSARY_DIR).filter(
        f => f.endsWith('.html') && f !== '_template.html' && f !== 'index.html'
      );
    } catch (e) {
      console.error('[Sitemap] Glossary dir error:', e.message);
    }

    // Term pages (no -vs- in filename)
    const termFiles = glossaryFiles.filter(f => !f.includes('-vs-'));
    for (const file of termFiles) {
      const slug = file.replace('.html', '');
      xml += `  <url><loc>https://yt-seo-architect.vercel.app/glossary/${slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
    }

    // Comparison pages (contain -vs- in filename) — up to 10k per sitemap limits
    const comparisonFiles = glossaryFiles.filter(f => f.includes('-vs-'));
    const MAX_SITEMAP_URLS = 20000;
    let cmpCount = 0;
    for (const file of comparisonFiles) {
      if (cmpCount >= MAX_SITEMAP_URLS) break;
      const slug = file.replace('.html', '');
      xml += `  <url><loc>https://yt-seo-architect.vercel.app/glossary/${slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
      cmpCount++;
    }

    // Spanish glossary pages
    const GLOSSARY_ES_DIR = resolve(__dirname, '../public/glossary/es');
    try {
      const esFiles = readdirSync(GLOSSARY_ES_DIR).filter(
        f => f.endsWith('.html') && f !== '_template.html' && f !== 'index.html'
      );
      for (const file of esFiles) {
        const slug = file.replace('.html', '');
        xml += `  <url><loc>https://yt-seo-architect.vercel.app/glossary/es/${slug}</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n`;
      }
    } catch (e) {
      console.error('[Sitemap] Spanish glossary dir error:', e.message);
    }

    // Blog category pages
    for (const [catSlug, cat] of Object.entries(BLOG_CATEGORIES)) {
      xml += `  <url><loc>https://yt-seo-architect.vercel.app/blog/category/${catSlug}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
    }
    xml += `  <url><loc>https://yt-seo-architect.vercel.app/blog/categories</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>\n`;
    xml += `  <url><loc>https://yt-seo-architect.vercel.app/guide/youtube-seo</loc><changefreq>monthly</changefreq><priority>0.9</priority></url>\n`;

    // Comparison pages (vs/ tool comparisons)
    const vsSlugs = ['vidiq', 'tubebuddy', 'morningfame', 'tubics', 'keywordtool', 'canva'];
    for (const vs of vsSlugs) {
      xml += `  <url><loc>https://yt-seo-architect.vercel.app/vs/${vs}</loc><changefreq>monthly</changefreq><priority>0.8</priority></url>\n`;
    }

    // Validated blog posts only
    for (const page of allPages) {
      const validation = validateBlogPost({
        slug: page.slug,
        title: page.title,
        content: page.content,
        wordCount: page.wordCount,
      });
      if (!validation.valid) continue;

      const date = page.publishedAt
        ? new Date(page.publishedAt).toISOString().split('T')[0]
        : '2026-05-27';
      xml += `  <url><loc>https://yt-seo-architect.vercel.app/blog/${page.slug}</loc><lastmod>${date}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>\n`;
    }

    xml += '</urlset>';
    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (e) {
    console.error('[Sitemap] Error:', e.message);
    res.status(500).send('Error generating sitemap');
  }
});

// ── Robots.txt ───────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.header('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /

# Block internal/dev pages
Disallow: /blog/_TEMPLATE
Disallow: /api/
Disallow: /admin/
Disallow: /_next/
Disallow: /node_modules/

# Allow AI search crawlers
User-agent: ChatGPT-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bytespider
Allow: /

# Block training-only crawlers
User-agent: GPTBot
Disallow: /

User-agent: CCBot
Disallow: /

Sitemap: https://yt-seo-architect.vercel.app/sitemap.xml`);
});

// Sitemap and robots served by validation-gated endpoints (see blog-validation.js)

// ── Phronesis Agent — Goal & Coach API ──
app.post('/api/agent/goal/set', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { type, target, deadline } = req.body || {};
    if (!type || !target) return res.status(400).json({ error: 'type and target required' });
    const { setGoal } = await import('./agent-core/goal-engine.js');
    const goal = await setGoal({ channelId, type, target: parseInt(target), deadline });
    res.json({ success: true, goal });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agent/goal/status', async (req, res) => {
  try {
    const channelId = req.query.channelId || req.headers['x-channel-id'];
    const { getGoalStatus } = await import('./agent-core/goal-engine.js');
    const goal = await getGoalStatus(channelId);
    res.json({ goal });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agent/coach/inbox', (req, res) => {
  const channelId = req.query.channelId || req.headers['x-channel-id'];
  import('./agent-core/coach.js').then(({ getCoachInbox }) => {
    res.json({ messages: getCoachInbox(channelId) });
  }).catch(e => res.status(500).json({ error: e.message }));
});

app.post('/api/agent/coach/respond', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { messageId, action, proposalId } = req.body || {};
    const { markRead } = await import('./agent-core/coach.js');
    markRead(channelId, messageId);
    res.json({ success: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/agent/coach/ask', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { question } = req.body || {};
    const { handleQuestion } = await import('./agent-core/coach.js');
    const response = await handleQuestion(channelId, question);
    res.json({ response });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agent/coach/job/:id', async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const job = await dbService.getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json({ job: {
      id: job.id, tool: job.tool, status: job.status,
      progress: job.progress, result: job.result, error: job.error
    }});
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Direct tool execution — bypasses AI, called by quick action chips
app.post('/api/agent/coach/tool', async (req, res) => {
  // ── Ask Phronesis is now FREE for all users ──

  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const { tool, args } = req.body || {};
    if (!tool) return res.status(400).json({ error: 'tool required' });
    const { executeTool } = await import('./agent-core/tool-executor.js');
    const result = await executeTool(tool, args || {}, channelId);
    res.json(result);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Clear stuck/stale jobs
app.post('/api/agent/coach/clear-jobs', async (req, res) => {
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { eq, inArray } = await import('drizzle-orm');
    await dbService.db.update(s.agentJobs).set({ status: 'failed', error: 'Cleared by user', completedAt: new Date() })
      .where(inArray(s.agentJobs.status, ['queued', 'running']));
    res.json({ success: true, message: 'All pending/running jobs cleared' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/agent/status', async (req, res) => {
  try {
    const channelId = req.query.channelId || req.headers['x-channel-id'];
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const logs = await dbService.db.select().from(s.agentActivityLogs)
      .where({ channelId })
      .orderBy(s.agentActivityLogs.createdAt, 'desc')
      .limit(20);
    res.json({ recentActivity: logs || [] });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// ── Glossary Comparison Pages (dynamic, replaces 2,776 static files) ──
// Matches /glossary/{a}-vs-{b} and /glossary/es/{a}-vs-{b}
// Each term has: slug, nameEN, nameES, defEN, defES, cat (category)

const CATS = {
  analytics: { en: '📊 Analytics', es: '📊 Analíticas' },
  algorithm: { en: '🤖 Algorithm', es: '🤖 Algoritmo' },
  seo: { en: '🔍 SEO', es: '🔍 SEO' },
  monetization: { en: '💰 Monetization', es: '💰 Monetización' },
  content: { en: '📝 Content Strategy', es: '📝 Estrategia de Contenido' },
  features: { en: '⚙️ Features', es: '⚙️ Funciones' },
  engagement: { en: '💬 Engagement', es: '💬 Participación' },
  production: { en: '🎬 Production', es: '🎬 Producción' },
};

const GLOSSARY_TERMS = [
  { slug: 'ab-testing', cat: 'seo', nameEN: 'A/B Testing', nameES: 'Pruebas A/B', defEN: 'A/B Testing on YouTube is the practice of comparing two versions of a video element to determine which performs better.', defES: 'Las Pruebas A/B en YouTube comparan dos versiones de un elemento del video para determinar cuál funciona mejor.' },
  { slug: 'click-through-rate', cat: 'analytics', nameEN: 'Click-Through Rate (CTR)', nameES: 'Tasa de Clics (CTR)', defEN: 'Click-Through Rate (CTR) is the percentage of users who click on your YouTube video after seeing an impression.', defES: 'La Tasa de Clics (CTR) es el porcentaje de usuarios que hacen clic en tu video después de ver una impresión.' },
  { slug: 'youtube-algorithm', cat: 'algorithm', nameEN: 'YouTube Algorithm', nameES: 'Algoritmo de YouTube', defEN: 'The YouTube Algorithm is a recommendation system that suggests videos based on viewing behavior and preferences.', defES: 'El Algoritmo de YouTube es un sistema de recomendación que sugiere videos basados en el comportamiento de visualización.' },
  { slug: 'watch-time', cat: 'analytics', nameEN: 'Watch Time', nameES: 'Tiempo de Visualización', defEN: 'Watch Time is the total number of minutes viewers have spent watching your videos.', defES: 'El Tiempo de Visualización son los minutos totales que los espectadores pasan viendo tus videos.' },
  { slug: 'impressions', cat: 'analytics', nameEN: 'Impressions', nameES: 'Impresiones', defEN: 'Impressions represent how many times your video thumbnail is shown to users.', defES: 'Las Impresiones representan cuántas veces se muestra la miniatura de tu video a los usuarios.' },
  { slug: 'audience-retention', cat: 'analytics', nameEN: 'Audience Retention', nameES: 'Retención de Audiencia', defEN: 'Audience Retention measures how well your video holds viewers\' attention over time.', defES: 'La Retención de Audiencia mide qué tan bien tu video mantiene la atención de los espectadores.' },
  { slug: 'average-view-duration', cat: 'analytics', nameEN: 'Average View Duration (AVD)', nameES: 'Duración Media de Visualización', defEN: 'AVD is the average time viewers spend watching a single video.', defES: 'La Duración Media de Visualización es el tiempo promedio que los espectadores pasan viendo un video.' },
  { slug: 'dwell-time', cat: 'analytics', nameEN: 'Dwell Time', nameES: 'Tiempo de Permanencia', defEN: 'Dwell Time is the time a user spends on YouTube after clicking a video.', defES: 'El Tiempo de Permanencia es el tiempo que un usuario pasa en YouTube después de hacer clic en un video.' },
  { slug: 'session-time', cat: 'analytics', nameEN: 'Session Time', nameES: 'Tiempo de Sesión', defEN: 'Session Time measures total continuous time a viewer spends on YouTube.', defES: 'El Tiempo de Sesión mide el tiempo continuo total que un espectador pasa en YouTube.' },
  { slug: 'search-volume', cat: 'seo', nameEN: 'Search Volume', nameES: 'Volumen de Búsqueda', defEN: 'Search Volume is the number of times a keyword is searched on YouTube monthly.', defES: 'El Volumen de Búsqueda es el número de veces que se busca una palabra clave en YouTube mensualmente.' },
  { slug: 'keyword-difficulty', cat: 'seo', nameEN: 'Keyword Difficulty', nameES: 'Dificultad de Palabra Clave', defEN: 'Keyword Difficulty estimates how hard it is to rank for a search term.', defES: 'La Dificultad de Palabra Clave estima qué tan difícil es posicionarse para un término de búsqueda.' },
  { slug: 'revenue-per-mille', cat: 'monetization', nameEN: 'Revenue Per Mille (RPM)', nameES: 'Ingresos Por Mil (RPM)', defEN: 'RPM is the amount a creator earns per thousand video views.', defES: 'RPM es la cantidad que un creador gana por cada mil visitas al video.' },
  { slug: 'cost-per-mille', cat: 'monetization', nameEN: 'Cost Per Mille (CPM)', nameES: 'Costo Por Mil (CPM)', defEN: 'CPM is the amount advertisers pay per thousand ad impressions.', defES: 'CPM es la cantidad que los anunciantes pagan por cada mil impresiones de anuncios.' },
  { slug: 'ad-revenue', cat: 'monetization', nameEN: 'Ad Revenue', nameES: 'Ingresos por Anuncios', defEN: 'Ad Revenue is income earned from advertisements displayed on your videos.', defES: 'Los Ingresos por Anuncios son las ganancias obtenidas de los anuncios mostrados en tus videos.' },
  { slug: 'channel-memberships', cat: 'monetization', nameEN: 'Channel Memberships', nameES: 'Membresías del Canal', defEN: 'Channel Memberships let viewers pay a monthly fee for exclusive perks.', defES: 'Las Membresías del Canal permiten a los espectadores pagar una tarifa mensual por beneficios exclusivos.' },
  { slug: 'super-chat', cat: 'monetization', nameEN: 'Super Chat', nameES: 'Super Chat', defEN: 'Super Chat allows viewers to pay for highlighted messages during live streams.', defES: 'Super Chat permite a los espectadores pagar por mensajes destacados durante transmisiones en vivo.' },
  { slug: 'youtube-premium', cat: 'monetization', nameEN: 'YouTube Premium', nameES: 'YouTube Premium', defEN: 'YouTube Premium is a paid subscription for ad-free viewing and background play.', defES: 'YouTube Premium es una suscripción paga para visualización sin anuncios y reproducción en segundo plano.' },
  { slug: 'youtube-partner-program', cat: 'monetization', nameEN: 'YouTube Partner Program (YPP)', nameES: 'Programa de Socios de YouTube', defEN: 'YPP is the monetization program for creators to earn from their content.', defES: 'YPP es el programa de monetización para que los creadores ganen dinero con su contenido.' },
  { slug: 'shorts-monetization', cat: 'monetization', nameEN: 'Shorts Monetization', nameES: 'Monetización de Shorts', defEN: 'Shorts Monetization allows creators to earn revenue from YouTube Shorts.', defES: 'La Monetización de Shorts permite a los creadores ganar ingresos con los Shorts de YouTube.' },
  { slug: 'video-editing', cat: 'production', nameEN: 'Video Editing', nameES: 'Edición de Video', defEN: 'Video Editing is the process of arranging and modifying video clips to create a final product.', defES: 'La Edición de Video es el proceso de organizar y modificar clips de video para crear un producto final.' },
  { slug: 'thumbnail', cat: 'seo', nameEN: 'Thumbnail', nameES: 'Miniatura', defEN: 'A Thumbnail is a clickable preview image that represents a YouTube video.', defES: 'Una Miniatura es una imagen de vista previa que representa un video de YouTube.' },
  { slug: 'description', cat: 'seo', nameEN: 'Video Description', nameES: 'Descripción del Video', defEN: 'The Video Description is a text field below your video that provides context, links, and keywords.', defES: 'La Descripción del Video es un campo de texto debajo de tu video que proporciona contexto, enlaces y palabras clave.' },
  { slug: 'tags', cat: 'seo', nameEN: 'Tags', nameES: 'Etiquetas', defEN: 'Tags are keywords that help YouTube understand the content and context of your video.', defES: 'Las Etiquetas son palabras clave que ayudan a YouTube a entender el contenido y contexto de tu video.' },
  { slug: 'engagement', cat: 'engagement', nameEN: 'Engagement', nameES: 'Participación', defEN: 'Engagement measures how users interact with your content through likes, comments, and shares.', defES: 'La Participación mide cómo los usuarios interactúan con tu contenido a través de Me gusta, comentarios y compartidos.' },
  { slug: 'retention', cat: 'analytics', nameEN: 'Retention', nameES: 'Retención', defEN: 'Retention is the percentage of a video that viewers watch, indicating content quality.', defES: 'La Retención es el porcentaje de un video que los espectadores ven, indicando la calidad del contenido.' },
  { slug: 'playlist', cat: 'content', nameEN: 'Playlist', nameES: 'Lista de Reproducción', defEN: 'A Playlist is a curated collection of videos organized around a theme or topic.', defES: 'Una Lista de Reproducción es una colección curada de videos organizados alrededor de un tema.' },
  { slug: 'cards', cat: 'features', nameEN: 'Cards', nameES: 'Tarjetas', defEN: 'Cards are interactive elements that appear as teasers within a video, linking to other content.', defES: 'Las Tarjetas son elementos interactivos que aparecen como avances dentro de un video.' },
  { slug: 'end-screen', cat: 'features', nameEN: 'End Screen', nameES: 'Pantalla Final', defEN: 'An End Screen displays recommended videos and subscribe buttons in the last 20 seconds of a video.', defES: 'Una Pantalla Final muestra videos recomendados y botones de suscripción en los últimos 20 segundos de un video.' },
  { slug: 'closed-captions', cat: 'features', nameEN: 'Closed Captions', nameES: 'Subtítulos', defEN: 'Closed Captions display spoken dialogue and audio cues as text on screen.', defES: 'Los Subtítulos muestran el diálogo hablado y señales de audio como texto en pantalla.' },
  { slug: 'chapter', cat: 'features', nameEN: 'Chapters', nameES: 'Capítulos', defEN: 'Chapters divide a video into timed segments with descriptive titles for easier navigation.', defES: 'Los Capítulos dividen un video en segmentos temporizados con títulos descriptivos para una navegación más fácil.' },
  { slug: 'community', cat: 'engagement', nameEN: 'Community Tab', nameES: 'Pestaña Comunidad', defEN: 'The Community Tab lets creators post text, images, and polls to engage their audience.', defES: 'La Pestaña Comunidad permite a los creadores publicar texto, imágenes y encuestas para interactuar con su audiencia.' },
  { slug: 'brand', cat: 'content', nameEN: 'Brand Channel', nameES: 'Canal de Marca', defEN: 'A Brand Channel is a YouTube channel specifically for businesses or brands.', defES: 'Un Canal de Marca es un canal de YouTube específicamente para negocios o marcas.' },
  { slug: 'distribution', cat: 'content', nameEN: 'Content Distribution', nameES: 'Distribución de Contenido', defEN: 'Content Distribution is the process of sharing your video across multiple platforms to maximize reach.', defES: 'La Distribución de Contenido es el proceso de compartir tu video en múltiples plataformas para maximizar el alcance.' },
  { slug: 'copyright', cat: 'content', nameEN: 'Copyright', nameES: 'Derechos de Autor', defEN: 'Copyright is legal protection of original creative works, enforced by YouTube\'s Content ID system.', defES: 'Los Derechos de Autor son la protección legal de obras creativas originales, aplicada por el sistema Content ID de YouTube.' },
  { slug: 'fair-use', cat: 'content', nameEN: 'Fair Use', nameES: 'Uso Justo', defEN: 'Fair Use allows limited use of copyrighted material without permission for purposes like commentary.', defES: 'El Uso Justo permite el uso limitado de material protegido sin permiso para fines como comentarios.' },
  { slug: 'hashtag', cat: 'seo', nameEN: 'Hashtags', nameES: 'Hashtags', defEN: 'Hashtags are clickable keywords preceded by # that help categorize content by topic.', defES: 'Los Hashtags son palabras clave precedidas por # que ayudan a categorizar el contenido por tema.' },
  { slug: 'live-stream', cat: 'features', nameEN: 'Live Stream', nameES: 'Transmisión en Vivo', defEN: 'A Live Stream is a real-time video broadcast that allows viewer interaction.', defES: 'Una Transmisión en Vivo es una emisión de video en tiempo real que permite la interacción con los espectadores.' },
  { slug: 'premiere', cat: 'features', nameEN: 'Premiere', nameES: 'Estreno', defEN: 'A Premiere is a scheduled first showing of a pre-recorded video with live chat.', defES: 'Un Estreno es una primera proyección programada de un video pregrabado con chat en vivo.' },
  { slug: 'pinned-comment', cat: 'engagement', nameEN: 'Pinned Comment', nameES: 'Comentario Fijado', defEN: 'A Pinned Comment is highlighted at the top of the comments section for visibility.', defES: 'Un Comentario Fijado se destaca en la parte superior de la sección de comentarios para mayor visibilidad.' },
  { slug: 'comment', cat: 'engagement', nameEN: 'Comments', nameES: 'Comentarios', defEN: 'Comments are viewer responses to a video that drive engagement and community.', defES: 'Los Comentarios son respuestas de los espectadores a un video que impulsan la participación y la comunidad.' },
  { slug: 'calls-to-action', cat: 'content', nameEN: 'Calls-to-Action (CTA)', nameES: 'Llamadas a la Acción (CTA)', defEN: 'CTAs prompt viewers to take a specific action like subscribing or clicking a link.', defES: 'Las CTA invitan a los espectadores a realizar una acción específica como suscribirse o hacer clic en un enlace.' },
  { slug: 'hook', cat: 'production', nameEN: 'Hook', nameES: 'Gancho', defEN: 'A Hook is the first few seconds of a video designed to grab viewer attention.', defES: 'Un Gancho son los primeros segundos de un video diseñados para captar la atención del espectador.' },
  { slug: 'intro', cat: 'production', nameEN: 'Intro', nameES: 'Introducción', defEN: 'An Intro is the opening segment of a video that sets expectations and branding.', defES: 'Una Introducción es el segmento de apertura de un video que establece expectativas y marca.' },
  { slug: 'outro', cat: 'production', nameEN: 'Outro', nameES: 'Cierre', defEN: 'An Outro is the closing segment that summarizes and encourages viewer action.', defES: 'Un Cierre es el segmento final que resume y fomenta la acción del espectador.' },
  { slug: 'branding', cat: 'content', nameEN: 'Channel Branding', nameES: 'Identidad de Marca', defEN: 'Channel Branding includes your profile picture, banner, and visual identity across YouTube.', defES: 'La Identidad de Marca incluye tu foto de perfil, banner e identidad visual en YouTube.' },
  { slug: 'vanity-url', cat: 'features', nameEN: 'Vanity URL', nameES: 'URL Personalizada', defEN: 'A Vanity URL is a custom YouTube channel URL (e.g., youtube.com/@handle).', defES: 'Una URL Personalizada es una URL personalizada del canal de YouTube (ej., youtube.com/@handle).' },
  { slug: 'handle', cat: 'features', nameEN: 'YouTube Handle', nameES: 'Identificador de YouTube', defEN: 'A YouTube Handle (@handle) is a unique identifier for your channel used in mentions.', defES: 'Un Identificador de YouTube (@handle) es un identificador único para tu canal usado en menciones.' },
  { slug: 'analytics', cat: 'analytics', nameEN: 'YouTube Analytics', nameES: 'Analíticas de YouTube', defEN: 'YouTube Analytics provides data on video performance, audience, and revenue.', defES: 'Las Analíticas de YouTube proporcionan datos sobre el rendimiento del video, la audiencia y los ingresos.' },
  { slug: 'real-time', cat: 'analytics', nameEN: 'Real-Time Analytics', nameES: 'Analíticas en Tiempo Real', defEN: 'Real-Time Analytics shows immediate viewer activity data on your content.', defES: 'Las Analíticas en Tiempo Real muestran datos de actividad inmediata de los espectadores en tu contenido.' },
  { slug: 'traffic-source', cat: 'analytics', nameEN: 'Traffic Source', nameES: 'Fuente de Tráfico', defEN: 'Traffic Source indicates where viewers found your video (search, suggested, external).', defES: 'La Fuente de Tráfico indica dónde encontraron los espectadores tu video (búsqueda, sugerido, externo).' },
  { slug: 'demographics', cat: 'analytics', nameEN: 'Audience Demographics', nameES: 'Demografía de Audiencia', defEN: 'Audience Demographics shows the age, gender, and location of your viewers.', defES: 'La Demografía de Audiencia muestra la edad, género y ubicación de tus espectadores.' },
  { slug: 'reach', cat: 'analytics', nameEN: 'Reach', nameES: 'Alcance', defEN: 'Reach is the total number of unique users who see your content.', defES: 'El Alcance es el número total de usuarios únicos que ven tu contenido.' },
  { slug: 'views', cat: 'analytics', nameEN: 'Views', nameES: 'Vistas', defEN: 'Views count the number of times your video has been watched.', defES: 'Las Vistas cuentan el número de veces que se ha visto tu video.' },
  { slug: 'subscriber', cat: 'engagement', nameEN: 'Subscribers', nameES: 'Suscriptores', defEN: 'Subscribers are users who follow your channel to receive updates.', defES: 'Los Suscriptores son usuarios que siguen tu canal para recibir actualizaciones.' },
];

const GLOSSARY_CSS = '*{margin:0;padding:0;box-sizing:border-box}body{font-family:Outfit,Geist,sans-serif;background:#0a0a0f;color:#e2e8f0;line-height:1.6}.header{display:flex;justify-content:space-between;align-items:center;padding:.75rem 1.5rem;background:#0f0c29;border-bottom:1px solid rgba(255,255,255,.05)}.header a{color:#e2e8f0;text-decoration:none;font-weight:600}.header .cta{background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.4rem 1rem;border-radius:9999px;font-size:.85rem}main{max-width:820px;margin:0 auto;padding:2rem 1.5rem}h1{font-size:1.8rem;margin-bottom:.5rem;background:linear-gradient(135deg,#f97316,#fb923c);-webkit-background-clip:text;-webkit-text-fill-color:transparent}.h1-sub{color:#8b8b9e;font-size:.95rem;margin-bottom:2rem}.card{background:#1e1b4b;border:1px solid #2d2a5e;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem}.card h2{color:#a5b4fc;font-size:1.1rem;margin-bottom:.75rem}.card p{color:#94a3b8;line-height:1.7;margin:.5rem 0}.vs{text-align:center;font-size:1.5rem;font-weight:800;color:#f97316;padding:.5rem 0}.cmp-table{width:100%;border-collapse:collapse;margin:1rem 0;font-size:.88rem}.cmp-table th,.cmp-table td{padding:.7rem .8rem;text-align:left;border-bottom:1px solid rgba(255,255,255,.06)}.cmp-table th{background:rgba(79,70,229,.15);color:#a5b4fc;font-weight:600;font-size:.8rem;text-transform:uppercase;letter-spacing:.5px}.cmp-table .dim{color:#8b8b9e;font-weight:500;white-space:nowrap}.cmp-table .va{color:#fb923c;font-weight:600}.cmp-table .vb{color:#a5b4fc;font-weight:600}.cmp-table tr:hover td{background:rgba(255,255,255,.02)}.rc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:1rem 0}.rc-grid a{display:block;background:#1e1b4b;border:1px solid #2d2a5e;border-radius:8px;padding:.6rem .8rem;color:#94a3b8;text-decoration:none;font-size:.82rem;transition:all .2s}.rc-grid a:hover{border-color:#f97316;color:#fff;transform:translateY(-2px)}.ln{text-align:center;font-size:.8rem;color:#8b8b9e;margin:0 0 1.5rem}.ln a{color:#a5b4fc}.cta-box{border:1px solid #4f46e5;border-radius:12px;padding:1.5rem;text-align:center;margin:2rem 0}.cta-box a{display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);color:#fff;padding:.6rem 1.5rem;border-radius:9999px;text-decoration:none;font-weight:600}footer{text-align:center;padding:2rem;color:#6b7280;font-size:.8rem}footer a{color:#8b8b9e;text-decoration:none}.fs-box{border:1px solid rgba(34,197,94,.2);background:rgba(34,197,94,.04);border-radius:10px;padding:1rem 1.25rem;margin:1rem 0 .5rem;position:relative}.fs-box .fs-label{font-size:.65rem;text-transform:uppercase;letter-spacing:.5px;color:#22c55e;font-weight:600;margin-bottom:.4rem}.fs-box p{margin:0;color:#e2e8f0;line-height:1.6}';

function getComparisonDims(termA, termB, isES) {
  const catA = CATS[termA.cat] || { en: termA.cat, es: termA.cat };
  const catB = CATS[termB.cat] || { en: termB.cat, es: termB.cat };
  const sameCat = termA.cat === termB.cat;
  return [
    { label: isES ? 'Categoría' : 'Category', valA: catA.es || catA.en, valB: catB.es || catB.en },
    { label: isES ? 'Enfoque Principal' : 'Primary Focus', valA: termA.nameES || termA.nameEN, valB: termB.nameES || termB.nameEN },
    { label: isES ? 'Impacto en Ranking' : 'Ranking Impact', valA: sameCat ? (isES ? 'Similar' : 'Similar') : (isES ? 'Alto' : 'High'), valB: sameCat ? (isES ? 'Similar' : 'Similar') : (isES ? 'Alto' : 'High') },
    { label: isES ? 'Dificultad de Optimización' : 'Optimization Difficulty', valA: isES ? 'Media' : 'Medium', valB: isES ? 'Media' : 'Medium' },
    { label: isES ? 'Mejor para' : 'Best For', valA: `${isES ? 'Entender y medir' : 'Understanding & measuring'} ${(isES ? termA.nameES : termA.nameEN).toLowerCase()}`, valB: `${isES ? 'Entender y medir' : 'Understanding & measuring'} ${(isES ? termB.nameES : termB.nameEN).toLowerCase()}` },
  ];
}

function getRelatedComparisons(slugA, isES) {
  const termA = GLOSSARY_TERMS.find(t => t.slug === slugA);
  if (!termA) return [];
  return GLOSSARY_TERMS.filter(t => t.slug !== slugA && t.cat === termA.cat)
    .map(t => ({ t, r: Math.random() })).sort((a, b) => a.r - b.r).map(x => x.t)
    .slice(0, 6)
    .map(t => ({
      name: isES ? t.nameES : t.nameEN,
      url: `/glossary${isES ? '/es' : ''}/${slugA}-vs-${t.slug}`,
    }));
}

function renderGlossaryComparison(slugA, slugB, isES) {
  const termA = GLOSSARY_TERMS.find(t => t.slug === slugA);
  const termB = GLOSSARY_TERMS.find(t => t.slug === slugB);
  if (!termA || !termB) return null;
  const aName = isES ? termA.nameES : termA.nameEN;
  const bName = isES ? termB.nameES : termB.nameEN;
  const aDef = isES ? termA.defES : termA.defEN;
  const bDef = isES ? termB.defES : termB.defEN;
  const lang = isES ? 'es' : 'en';
  const site = 'https://yt-seo-architect.vercel.app';
  const enUrl = `/glossary/${slugA}-vs-${slugB}`;
  const esUrl = `/glossary/es/${slugA}-vs-${slugB}`;
  const currentUrl = isES ? esUrl : enUrl;
  const title = `${aName} vs ${bName} | YT SEO Architect`;
  const desc = `${isES ? 'Compara' : 'Compare'} ${aName} ${isES ? 'y' : 'and'} ${bName}: categoría, enfoque, ranking impact y dificultad de optimización para SEO en YouTube.`;

  // Comparison table
  const dims = getComparisonDims(termA, termB, isES);
  const dimRows = dims.map(d =>
    `<tr><td class="dim">${d.label}</td><td class="va">${d.valA}</td><td class="vb">${d.valB}</td></tr>`
  ).join('\n');

  // Quick answer for featured snippet
  const snippetAnswer = isES
    ? `${aName} se enfoca en ${aDef.split('.')[0].toLowerCase()}, mientras que ${bName} se centra en ${bDef.split('.')[0].toLowerCase()}. Ambos son importantes para YouTube SEO.`
    : `${aName} focuses on ${aDef.split('.')[0].toLowerCase()}, while ${bName} focuses on ${bDef.split('.')[0].toLowerCase()}. Both are important for YouTube SEO.`;

  // Related comparisons
  const related = getRelatedComparisons(slugA, isES);
  const relatedHtml = related.length > 0
    ? `<div class="card"><h2>🔗 ${isES ? 'Comparaciones Relacionadas' : 'Related Comparisons'}</h2><div class="rc-grid">${related.map(r => `<a href="${r.url}">⚡ ${r.name}</a>`).join('')}</div></div>`
    : '';

  const aGlossaryUrl = `/glossary${isES ? '/es' : ''}/${slugA}`;
  const bGlossaryUrl = `/glossary${isES ? '/es' : ''}/${slugB}`;
  const catName = isES ? (CATS[termA.cat]?.es || termA.cat) : (CATS[termA.cat]?.en || termA.cat);

  return `<!DOCTYPE html>\n<html lang="${lang}">\n<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>\n<title>${title}</title>\n<link rel="canonical" href="${site}${currentUrl}"/>\n<link rel="alternate" hreflang="en" href="${site}${enUrl}"/>\n<link rel="alternate" hreflang="es" href="${site}${esUrl}"/>\n<link rel="alternate" hreflang="x-default" href="${site}${enUrl}"/>\n<meta name="description" content="${desc}"/>\n<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","headline":"${title}","description":"${desc.replace(/"/g,'\\\\"')}","inLanguage":"${lang}","mainEntityOfPage":{"@type":"WebPage","@id":"${site}${currentUrl}"}}</script>\n<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" media="print" onload="this.media=\\'all\\'">\n<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap"></noscript>\n<style>${GLOSSARY_CSS}</style>\n</head>\n<body>\n<header class="header"><a href="/">⚡ YT SEO Architect</a><a href="/tools/" class="cta">${isES ? 'Herramientas Gratis' : 'Free Tools'}</a></header>\n<main>\n<div class="ln">${isES ? '🇪🇸 Español · <a href="' + enUrl + '" hreflang="en">🇺🇸 English</a>' : '🇺🇸 English · <a href="' + esUrl + '" hreflang="es">🇪🇸 Español</a>'}</div>\n<h1>${aName} vs ${bName}</h1>\n<p class="h1-sub">${catName} · ${isES ? 'Comparación detallada' : 'Detailed comparison'}</p>\n<div class="fs-box"><div class="fs-label">✨ ${isES ? 'Respuesta Rápida' : 'Quick Answer'}</div><p>${snippetAnswer}</p></div>\n<div class="card"><h2>📖 ${aName}</h2><p>${aDef}</p><p style="margin-top:.5rem"><a href="${aGlossaryUrl}" style="color:#a5b4fc;font-size:.85rem">${isES ? 'Leer guía completa →' : 'Read full guide →'}</a></p></div>\n<div class="vs">⚡ VS ⚡</div>\n<div class="card"><h2>📖 ${bName}</h2><p>${bDef}</p><p style="margin-top:.5rem"><a href="${bGlossaryUrl}" style="color:#a5b4fc;font-size:.85rem">${isES ? 'Leer guía completa →' : 'Read full guide →'}</a></p></div>\n<div class="card"><h2>⚖️ ${isES ? 'Comparación Directa' : 'Side-by-Side Comparison'}</h2>\n<table class="cmp-table"><thead><tr><th>${isES ? 'Dimensión' : 'Dimension'}</th><th style="color:#fb923c">${aName}</th><th style="color:#a5b4fc">${bName}</th></tr></thead><tbody>\n${dimRows}\n</tbody></table></div>\n${relatedHtml}\n<div class="cta-box"><h3>🚀 ${isES ? 'Domina el SEO de YouTube' : 'Master YouTube SEO'}</h3><p style="color:#8b8b9e;margin:.5rem 0 1rem;font-size:.9rem">${isES ? 'Prueba nuestras herramientas gratuitas para optimizar tu canal.' : 'Try our free tools to optimize your channel.'}</p><a href="/tools/">${isES ? 'Prueba las Herramientas Gratis →' : 'Try Free Tools →'}</a></div>\n</main>\n<footer><p>&copy; 2026 YT SEO Architect · <a href="/glossary/">${isES ? 'Glosario' : 'Glossary'}</a> · <a href="/tools/">${isES ? 'Herramientas' : 'Tools'}</a></p></footer>\n</body>\n</html>`;
}

app.get(/^\/glossary\/(es\/)?(.+)-vs-(.+)$/, async (req, res) => {
  try {
    const isES = req.params[0] === 'es/';
    const slugA = req.params[1];
    const slugB = req.params[2];
    const html = renderGlossaryComparison(slugA, slugB, isES);
    if (!html) {
      return sendJSON(res, 404, { error: 'Terms not found' });
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.status(200).send(html);
  } catch (e) {
    return sendJSON(res, 500, { error: e.message });
  }
});

// Sentry Error Handler (MUST BE AFTER ROUTES, BEFORE 404)

if (Sentry && Sentry.Handlers) {

  app.use(Sentry.Handlers.errorHandler());

}



// Fallback 404 handler

app.use((req, res) => {

  sendJSON(res, 404, { error: 'Not found', path: req.path });

});



// Start the server locally if not in Vercel

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {

  const PORT = process.env.PORT || 5175;


  try {

    app.listen(PORT, () => {


    }).on('error', (err) => {

      console.error(`❌ Server failed to start on port ${PORT}:`, err.message);

      process.exit(1);

    });

  } catch (listenError) {

    console.error('❌ Synchronous error during app.listen:', listenError);

    process.exit(1);

  }

} else {

}

export default app;
