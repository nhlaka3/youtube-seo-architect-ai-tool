import express from 'express';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../src/database/schema.js';
import dbService from '../src/database/services.js';
import { validateBody } from './middleware/validate.js';
import { csrfMiddleware } from './middleware/csrf.js';
import { captureError } from '../src/monitoring/sentry.js';
import winston from 'winston';

export const router = express.Router();

router.use(csrfMiddleware);

let kv;
export let kvAvailable = false;

const memoryStore = {};
const IDEMPOTENCY_TTL_SECONDS = 300; 

const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const logAudit = (action, details) => {
  auditLogger.info('AUDIT', {
    action,
    timestamp: new Date().toISOString(),
    ...details
  });
};

try {
  const kvModule = await import('@vercel/kv');
  kv = kvModule.kv;
  kvAvailable = true;
} catch (e) {
  kvAvailable = false;
}

const memoryKV = {
  get: async (key) => memoryStore[key] ?? null,
  set: async (key, val) => { memoryStore[key] = val; return 'OK'; },
  del: async (key) => { delete memoryStore[key]; return 1; },
  incrby: async (key, val) => { memoryStore[key] = (Number(memoryStore[key]) || 0) + val; return memoryStore[key]; },
  decrby: async (key, val) => { memoryStore[key] = (Number(memoryStore[key]) || 0) - val; return memoryStore[key]; },
};

export const safeKV = (method, ...args) => {
  if (kvAvailable) {
    try {
      const result = kv[method](...args);
      if (result && typeof result.catch === 'function') {
        return result.catch(e => {
          if (!isProduction && ['get', 'set', 'incrby', 'decrby', 'del'].includes(method)) return memoryKV[method](...args);
          throw e;
        });
      }
      return result;
    } catch (e) {
      if (!isProduction && ['get', 'set', 'incrby', 'decrby', 'del'].includes(method)) return memoryKV[method](...args);
      throw e;
    }
  }
  return memoryKV[method](...args);
};

const sendRes = (res, status, data) => {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json');
    res.status(status).json(data);
  }
};

const VALID_CHANNEL_ID = (id) => /^UC[\w-]{22}$/.test(id || '');
export const isRealChannel = (id) => VALID_CHANNEL_ID(id);

export const CREDIT_COSTS = {
  'deep-research': 0, 'video-factory': 0, 'channel-audit': 0,
  'keyword-discovery': 0, 'title-generation': 0, 'description-generation': 0,
  'thumbnail': 0, 'thumbnail-analysis': 0, 'metadata-weave': 0,
  'weaver-apply': 0, 'collusion-inject': 0, 'competitor-scan': 0,
  'sidebar-sniper': 0, 'auto-responder': 0, 'pipeline': 0,
  'magic-fix': 0, 'seo-bundle': 0, 'smart-overhaul': 0,
  'proposal-generate': 0, 'proposal-apply': 0, 'retention-reorder': 0,
  'ai-assistant': 0, 'video-schedule': 0, 'bulk-inject': 0,
  'auto-mgmt': 0, 'ai-generate': 0, 'classify-niche': 0, 'niche-relevance-guard': 0,
  'evergreen-revival': 0, 'collusion-tags': 0, 'session-linker': 0,
  'growth-engine': 0, 'ab-test': 0, 'queue-scan': 0
};

export const getCredits = async (channelId) => 999999;
export const getPlan = async (channelId) => 'agency';
export const refreshCredits = async (channelId) => {};
export const deductCredits = async (channelId, cost) => ({ success: true, balance: 999999 });
export const refundCredits = async (channelId, cost) => 999999;

// --- Middlewares ---
export const requireVerifiedChannel = async (req, res, next) => {
  try {
    const channelId = (req.body && req.body.channelId) || req.query.channelId || req.headers['x-channel-id'];
    const accessToken = (req.body && req.body.accessToken) || req.query.accessToken || req.headers['x-access-token'];

    if (!channelId || !isRealChannel(channelId)) {
      return next(); // In free mode, we're less strict about auth for read-only ops
    }

    req.channelId = channelId;
    req.accessToken = accessToken;
    next();
  } catch (e) {
    next();
  }
};

export const optionalChannelId = (req, res, next) => {
  const channelId = (req.body && req.body.channelId) || req.query.channelId;
  req.channelId = channelId && VALID_CHANNEL_ID(channelId) ? channelId : null;
  next();
};

export const requirePlan = (minimumPlan) => async (req, res, next) => {
  next();
};

const deductSchema = z.object({
  action: z.string().min(1),
  channelId: z.string().optional(),
  accessToken: z.string().optional(),
  idempotencyKey: z.string().max(128).optional()
});

const saveStateSchema = z.object({
  channelId: z.string().min(1),
  state: z.any()
});

// --- Routes ---
router.post('/sync', requireVerifiedChannel, async (req, res) => {
  sendRes(res, 200, { credits: 999999, plan: 'agency' });
});

router.get('/status', optionalChannelId, async (req, res) => {
  sendRes(res, 200, { credits: 999999, plan: 'agency' });
});

router.post('/deduct', requireVerifiedChannel, validateBody(deductSchema), async (req, res) => {
  sendRes(res, 200, { success: true, credits: 999999, action: req.body.action, cost: 0 });
});

router.post('/nonce', (req, res) => {
  sendRes(res, 404, { error: 'Payments disabled. Tool is now 100% free!' });
});

router.post('/purchase-success', (req, res) => {
  sendRes(res, 404, { error: 'Payments disabled. Tool is now 100% free!' });
});

router.post('/paypal/webhook', (req, res) => {
  sendRes(res, 200, { received: true, note: 'Payments disabled' });
});

router.get('/quota/status', (req, res) => {
  res.status(200).json({ usedToday: 0, limit: 999999 });
});

router.post('/save-state', validateBody(saveStateSchema), async (req, res) => {
  sendRes(res, 200, { success: true });
});
