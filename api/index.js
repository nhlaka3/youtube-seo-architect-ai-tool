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

    const { title, description, tags, titleScore, descScore, tagScore } = req.body || {};

    if (!title) return res.status(400).json({ error: 'Missing title' });

    const issues = [];

    if (titleScore < 85) issues.push('Title (' + titleScore + '/100): ' + title.substring(0, 100));

    if (descScore < 85) issues.push('Description (' + descScore + '/100): ' + (description||'').substring(0, 200));

    if (tagScore < 85 && Array.isArray(tags)) issues.push('Tags (' + tagScore + '/100): ' + tags.slice(0,12).join(', '));

    if (!issues.length) return res.json({ recommendations: null });

    const { askAI } = await import('./_lib/ai-provider.js');

    const raw = await askAI('You are a YouTube SEO expert. Return ONLY valid JSON.',

      'Analyze this video metadata and give 2-3 specific fixes.\n\n' + issues.join('\n\n') + '\n\nJSON: { "fixes": [{ "type": "title|description|tags", "issue": "exact problem", "suggestion": "the fix", "reason": "why it helps SEO" }] }',

      { temperature: 0.7, maxTokens: 800, forceJson: true }

    );

    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

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

app.get('/blog', async (req, res) => {

  try {

    const { default: dbService } = await import('../src/database/services.js');

    const s = await import('../src/database/schema.js');

    const { eq, desc } = await import('drizzle-orm');

    var pages = await dbService.db.select({ slug: s.seoPages.slug, title: s.seoPages.title, wordCount: s.seoPages.wordCount, content: s.seoPages.content, publishedAt: s.seoPages.publishedAt }).from(s.seoPages).where(eq(s.seoPages.status,'published')).orderBy(desc(s.seoPages.publishedAt)).limit(50);

    // Quality gate: only list validated posts (template-compliant, 1,200+ words, no banned words)
    const { validateBlogPost } = await import('./blog-validation.js');
    pages = pages.filter(p => validateBlogPost({ slug: p.slug, title: p.title, content: p.content, wordCount: p.wordCount }).valid);

    var html = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>YouTube SEO Guides & Tips | YT SEO Architect</title><meta name="description" content="Free YouTube SEO guides, tips, and tutorials. Learn how to grow your channel with AI-powered tools."><link rel="stylesheet" href="/style.css"><style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:2rem;background:#0a0a0f;color:#eee;line-height:1.7}h1{color:#f97316}.card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:16px 20px;margin-bottom:10px}.card a{color:#f97316;text-decoration:none;font-weight:600;font-size:1.1rem}.card a:hover{text-decoration:underline}.card .meta{color:#888;font-size:.8rem;margin-top:4px}nav a{color:#f97316}</style></head><body><nav><a href="/">← YT SEO Architect</a></nav><h1>📚 YouTube SEO Guides</h1><p style="color:#888;">Free guides to help you grow your YouTube channel with AI-powered tools.</p>';

    for (var p of pages) {

      html += '<div class="card"><a href="/blog/'+p.slug+'">'+p.title+'</a><div class="meta">'+p.wordCount+' words · '+new Date(p.publishedAt).toLocaleDateString()+'</div></div>';

    }

    html += '<div style="text-align:center;margin-top:2rem;padding:20px;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:12px;"><h3>🚀 Want to optimize your own channel?</h3><p style="color:#888;">17 AI tools. 100 free credits/month.</p><a href="/dashboard" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Start Free →</a></div></body></html>';

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

    if (!page) return res.status(404).send('Page not found');

    const { renderBlogTemplate } = await import('./blog-renderer.js');
    res.send(renderBlogTemplate(page));

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
  'youtube-shorts-seo-ranking-guide-2026'
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

      { loc: '/changelog', priority: '0.6', changefreq: 'monthly' },
      { loc: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
      { loc: '/terms-of-service', priority: '0.3', changefreq: 'yearly' },
    ];
    for (const p of corePages) {
      xml += `  <url><loc>https://yt-seo-architect.vercel.app${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>\n`;
    }

    // Free tool pages
    const toolPages = [
      { loc: '/tools/tag-generator', priority: '0.9', changefreq: 'weekly' },
      { loc: '/tools/title-optimizer', priority: '0.9', changefreq: 'weekly' },
      { loc: '/tools/description-writer', priority: '0.9', changefreq: 'weekly' },
    ];
    for (const p of toolPages) {
      xml += `  <url><loc>https://yt-seo-architect.vercel.app${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>\n`;
    }

    // PSEO disabled as per user request


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
  // ── Admin gate: only agency plan or admin channel IDs ──
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    const adminIds = ['UC-vVYFQC_MNjVP03YRZ56Wg', 'UCmcNApL2w7kk7NG14tXinRg'];
    if (!adminIds.includes(channelId)) {
      const { getPlan } = await import('./credits.js');
      const plan = await getPlan(channelId);
      if (plan !== 'agency' && plan !== 'pro') return res.status(403).json({ error: 'Ask Phronesis is available on Pro and Agency plans.' });
    }
  } catch(e) { /* continue if credit check fails */ }

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