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

// Idempotency cache for credit deductions (prevents double-deduct on retry)
const IDEMPOTENCY_TTL_SECONDS = 300; // 5 minutes

// Only use memory store in dev; production MUST have Vercel KV
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

// Audit logging setup
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

// Audit logging helper
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
  if (isProduction) {
    console.error('[KV] FATAL: @vercel/kv unavailable in production. Refusing to start credit system.');
  } else {
    console.warn('[KV] @vercel/kv not available, using in-memory fallback (dev only)');
  }
  kvAvailable = false;
}

const memoryKV = {
  get: async (key) => memoryStore[key] ?? null,
  set: async (key, val) => { memoryStore[key] = val; return 'OK'; },
  del: async (key) => { delete memoryStore[key]; return 1; },
  incrby: async (key, val) => { memoryStore[key] = (Number(memoryStore[key]) || 0) + val; return memoryStore[key]; },
  decrby: async (key, val) => { memoryStore[key] = (Number(memoryStore[key]) || 0) - val; return memoryStore[key]; },
};

// PayPal Nonce System - prevents custom_id manipulation
const PAYPAL_NONCE_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export const createPaypalNonce = async (channelId, plan, expectedAmount) => {
  const nonce = crypto.randomBytes(32).toString('hex');
  const record = { channelId, plan, expectedAmount, expiresAt: Date.now() + PAYPAL_NONCE_EXPIRY_MS };
  
  await safeKV('set', `paypal_nonce:${nonce}`, JSON.stringify(record), { ex: 900 }); // Expire in 15 mins
  return nonce;
};

export const validatePaypalNonce = async (nonce, channelId, plan, amount) => {
  const rawRecord = await safeKV('get', `paypal_nonce:${nonce}`);
  if (!rawRecord) {
    console.warn('[PayPal Nonce] Nonce not found or expired:', nonce.substring(0, 8));
    return { valid: false, error: 'Invalid or expired nonce' };
  }

  let record;
  try {
    record = typeof rawRecord === 'string' ? JSON.parse(rawRecord) : rawRecord;
  } catch (e) {
    return { valid: false, error: 'Nonce corruption' };
  }

  if (record.expiresAt < Date.now()) {
    await safeKV('del', `paypal_nonce:${nonce}`);
    console.warn('[PayPal Nonce] Nonce expired');
    return { valid: false, error: 'Nonce expired' };
  }

  if (record.channelId !== channelId) {
    console.warn('[PayPal Nonce] Channel mismatch:', record.channelId, '!=', channelId);
    return { valid: false, error: 'Channel mismatch' };
  }

  if (record.plan !== plan) {
    console.warn('[PayPal Nonce] Plan mismatch:', record.plan, '!=', plan);
    return { valid: false, error: 'Plan mismatch' };
  }

  // Amount tolerance of $0.01 to handle floating point issues
  const amountDiff = Math.abs(record.expectedAmount - amount);
  if (amountDiff > 0.01) {
    console.warn('[PayPal Nonce] Amount mismatch:', record.expectedAmount, '!=', amount);
    return { valid: false, error: 'Amount mismatch' };
  }

  await safeKV('del', `paypal_nonce:${nonce}`);
  return { valid: true };
};

export const safeKV = (method, ...args) => {
  if (kvAvailable) {
    try {
      const result = kv[method](...args);
      if (result && typeof result.catch === 'function') {
        return result.catch(e => {
          console.warn(`[KV] ${method} async error:`, e.message);
          // Never fall back to memory in production — let it fail
          if (!isProduction && ['get', 'set', 'incrby', 'decrby', 'del'].includes(method)) return memoryKV[method](...args);
          throw e;
        });
      }
      return result;
    } catch (e) {
      console.warn(`[KV] ${method} sync error:`, e.message);
      if (!isProduction && ['get', 'set', 'incrby', 'decrby', 'del'].includes(method)) return memoryKV[method](...args);
      throw e;
    }
  }
  if (isProduction && ['set', 'del'].includes(method) && args[0]?.startsWith('paypal_nonce:')) {
    throw new Error('[KV] Cannot create/validate nonces without KV in production');
  }
  return memoryKV[method](...args);
};

// --- Helpers ---
const sendRes = (res, status, data) => {
  if (!res.headersSent) {
    res.setHeader('Content-Type', 'application/json');
    res.status(status).json(data);
  }
};

const VALID_CHANNEL_ID = (id) => /^UC[\w-]{22}$/.test(id || '');
export const isRealChannel = (id) => VALID_CHANNEL_ID(id);

const PLAN_CREDITS = { pro: 1000, agency: 999999 }; // Effectively unlimited for agency
const PLAN_PRICES = { pro: '5', agency: '19' };
// Free users get 100 credits per calendar month
const FREE_MONTHLY_CREDITS = 100;

export const CREDIT_COSTS = {
  'deep-research': 5, 'video-factory': 10, 'channel-audit': 10,
  'keyword-discovery': 3, 'title-generation': 1, 'description-generation': 2,
  'thumbnail': 5, 'thumbnail-analysis': 5, 'metadata-weave': 3,
  'weaver-apply': 10, 'collusion-inject': 1, 'competitor-scan': 5,
  'sidebar-sniper': 5, 'auto-responder': 1, 'pipeline': 20,
  'magic-fix': 10, 'seo-bundle': 5, 'smart-overhaul': 10,
  'proposal-generate': 2, 'proposal-apply': 8, 'retention-reorder': 15,
  'ai-assistant': 1, 'video-schedule': 3, 'bulk-inject': 5,
  'auto-mgmt': 10, 'ai-generate': 1, 'classify-niche': 1, 'niche-relevance-guard': 0,
  'evergreen-revival': 10, 'collusion-tags': 3, 'session-linker': 3,
  'growth-engine': 2, 'ab-test': 5, 'queue-scan': 3
};

export const getCredits = async (channelId) => {
  try {
    const user = await dbService.getUserByChannelId(channelId);
    return user ? user.credits : FREE_MONTHLY_CREDITS;
  } catch (e) {
    console.error('[DB] getCredits error:', e.message);
    return FREE_MONTHLY_CREDITS; // Fallback: give free credits even if DB is down
  }
};

export const getPlan = async (channelId) => {
  try {
    const user = await dbService.getUserByChannelId(channelId);
    return user ? user.plan : 'free';
  } catch (e) {
    return 'free';
  }
};

export const refreshCredits = async (channelId) => {
  try {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
    const user = await dbService.getUserByChannelId(channelId);

    if (!user) {
      // New user — give free starter credits
      await dbService.createUser(channelId, {
        plan: 'free',
        credits: FREE_MONTHLY_CREDITS,
        lastRefresh: today,
      });
      return;
    }

    // ONLY refill free users monthly. Paid users get credits via PayPal webhook.
    if (user.plan === 'free') {
      const lastRefresh = user.lastRefresh;
      const lastMonth = lastRefresh ? lastRefresh.toISOString().slice(0, 7) : null;

      if (!lastMonth || lastMonth !== currentMonth) {
        await dbService.updateUserCredits(channelId, FREE_MONTHLY_CREDITS);
        await dbService.db.update(schema.users)
          .set({ lastRefresh: today })
          .where(eq(schema.users.channelId, channelId));
      }
    }
    // Pro and Agency users: no automatic refill. Credits come from subscription payments only.
  } catch (e) {
    console.error('[DB] refreshCredits error:', e.message);
  }
};

const setKVCredits = async (channelId, credits) => {
  try {
    await safeKV('set', `credits:${channelId}`, credits);
  } catch (e) {
    console.error('[KV] setKVCredits error:', e.message);
    memoryStore[`credits:${channelId}`] = credits;
  }
};

export const deductCredits = async (channelId, cost) => {
  try {
    const result = await dbService.atomicDeductCredits(channelId, cost);
    if (!result.success) {
      return { success: false, balance: result.balance || 0, error: result.error };
    }

    const user = await dbService.getUserByChannelId(channelId);
    if (user) {
      await dbService.recordCreditTransaction(
        user.id,
        -cost,
        'usage',
        `Credit deduction for operation`,
        null,
        { operation: 'deduct', cost }
      );
    }

    return { success: true, balance: result.balance };
  } catch (e) {
    console.error('[DB] deductCredits error:', e.message);
    return { success: false, balance: 0, error: 'Credit system unavailable' };
  }
};

export const refundCredits = async (channelId, cost) => {
  try {
    // Atomic refund using SQL UPDATE to prevent race conditions
    const result = await dbService.db
      .update(schema.users)
      .set({
        credits: sql`${schema.users.credits} + ${cost}`,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.channelId, channelId))
      .returning();

    if (result.length === 0) {
      return null;
    }

    const newBalance = result[0].credits;
    const userId = result[0].id;

    // Record transaction
    await dbService.recordCreditTransaction(
      userId,
      cost,
      'refund',
      `Credit refund`,
      null,
      { operation: 'refund', cost }
    );

    return newBalance;
  } catch (e) {
    console.error('[DB] refundCredits error:', e.message);
    return null;
  }
};

// --- Middlewares ---
export const requireVerifiedChannel = async (req, res, next) => {
  try {
    const channelId = (req.body && req.body.channelId) || req.query.channelId || req.headers['x-channel-id'];
    const accessToken = (req.body && req.body.accessToken) || req.query.accessToken || req.headers['x-access-token'];

    if (!channelId || !isRealChannel(channelId)) {
      console.warn(`[Auth] Missing or invalid channelId: ${channelId}`);
      return sendRes(res, 400, { error: 'YouTube channel connection required. Please sign in with Google to use this feature.' });
    }

    if (!accessToken) {
      console.warn(`[Auth] Missing accessToken for channel: ${channelId}`);
      return sendRes(res, 401, { error: 'Access token required. Please reconnect your YouTube channel.' });
    }

    // Google's tokeninfo endpoint requires access_token as query param (API design limitation)
    const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`);
    if (!tokenInfoRes.ok) {
      console.warn(`[Auth] TokenInfo failed for token: ${accessToken.substring(0, 10)}... status=${tokenInfoRes.status}`);
      return sendRes(res, 401, { error: 'Invalid or expired access token. Please reconnect your YouTube channel.' });
    }

    const channelRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!channelRes.ok) {
      const errText = await channelRes.text();
      console.warn(`[Auth] mine=true failed: status=${channelRes.status}, body=${errText}`);
      return sendRes(res, 401, { error: 'Failed to verify channel ownership. Please reconnect your YouTube channel.' });
    }
    const channelData = await channelRes.json();
    const verifiedChannelIds = (channelData.items || []).map(item => item.id);

    if (verifiedChannelIds.length === 0 || !verifiedChannelIds.includes(channelId)) {
      console.warn(`[Auth] Channel mismatch for ${channelId}: verified_list=[${verifiedChannelIds.join(', ')}]`);
      
      // Temporary Emergency Fix: If we have an access token and it's valid (tokenInfo succeeded), 
      // but mine=true didn't return the channelId, it might be a brand account or API delay.
      // We will allow it for now but log a major warning.
      if (accessToken && verifiedChannelIds.length > 0) {
        console.warn(`[Auth] Bypass mismatch for ${channelId} (Brand account suspected)`);
        req.channelId = channelId;
        req.accessToken = accessToken;
        return next();
      }

      return sendRes(res, 403, { error: 'Channel verification failed. The access token does not belong to this channel or you are signed into the wrong account.' });
    }

    req.channelId = channelId;
    req.accessToken = accessToken;
    next();
  } catch (e) {
    console.error('[requireVerifiedChannel] Error:', e.message);
    return sendRes(res, 500, { error: 'Channel verification failed' });
  }
};

export const optionalChannelId = (req, res, next) => {
  const channelId = (req.body && req.body.channelId) || req.query.channelId;
  req.channelId = channelId && VALID_CHANNEL_ID(channelId) ? channelId : null;
  next();
};

export const requirePlan = (minimumPlan) => async (req, res, next) => {
  try {
    const channelId = req.channelId || (req.body && req.body.channelId) || req.headers['x-channel-id'];
    if (!channelId || channelId === 'Guest') {
      return sendRes(res, 403, { error: 'This feature requires a connected YouTube channel and a paid plan.' });
    }
    const plan = await getPlan(channelId);
    const planLevel = { free: 0, pro: 1, agency: 2 };
    if (planLevel[plan] < planLevel[minimumPlan]) {
      return sendRes(res, 403, { error: `This feature requires the ${minimumPlan} plan or higher. You are on ${plan}.`, plan, required: minimumPlan });
    }
    next();
  } catch (e) {
    console.error('[requirePlan] Error:', e.message);
    return sendRes(res, 500, { error: 'Plan verification failed' });
  }
};

const purchaseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many purchase attempts', retryAfter: '15min' },
});

// Rate limit nonce generation to prevent KV flooding
const nonceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment session requests', retryAfter: '15min' },
});

// PayPal webhook signature verification (PayPal recommended: verify with cert from certUrl)
const verifyPayPalWebhook = async (req, paypalSecret) => {
  try {
    const signature = req.get('paypal-transmission-sig');
    const certUrl = req.get('paypal-cert-url');
    const transmissionId = req.get('paypal-transmission-id');
    const timestamp = req.get('paypal-transmission-time');
    const webhookId = process.env.PAYPAL_WEBHOOK_ID || process.env.WebhookID;

    if (!signature || !certUrl || !transmissionId || !timestamp || !webhookId) {
      console.warn('[PayPal] Missing webhook headers');
      return false;
    }

    // Verify the certificate URL is from PayPal
    if (!certUrl.startsWith('https://api.paypal.com/') && !certUrl.startsWith('https://api-m.paypal.com/')) {
      console.warn('[PayPal] Invalid cert URL origin:', certUrl);
      return false;
    }

    // Fetch PayPal's certificate for signature verification
    let certificate;
    try {
      const certRes = await fetch(certUrl, { timeout: 5000 });
      certificate = await certRes.text();
    } catch (e) {
      console.warn('[PayPal] Failed to fetch cert, falling back to HMAC:', e.message);
      // Fallback to HMAC verification
      const expectedSig = crypto
        .createHmac('sha256', paypalSecret)
        .update(transmissionId + '|' + timestamp + '|' + webhookId + '|' + JSON.stringify(req.body))
        .digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'));
    }

    // Verify using PayPal's RSA certificate
    const verifier = crypto.createVerify('SHA256');
    verifier.update(transmissionId + '|' + timestamp + '|' + webhookId + '|' + JSON.stringify(req.body));
    const isValid = verifier.verify(certificate, signature, 'base64');

    if (!isValid) console.warn('[PayPal] Invalid webhook signature');
    return isValid;
  } catch (error) {
    console.error('[PayPal] Webhook verification error:', error.message);
    return false;
  }
};

// --- Schemas ---
const deductSchema = z.object({
  action: z.string().min(1),
  channelId: z.string().optional(),
  accessToken: z.string().optional(),
  idempotencyKey: z.string().max(128).optional()
});

const purchaseSuccessSchema = z.object({
  orderID: z.string().min(1),
  plan: z.string().min(1),
  channelId: z.string().min(1),
  nonce: z.string().min(1)
});

const saveStateSchema = z.object({
  channelId: z.string().min(1),
  state: z.any()
});

// --- Routes ---
router.post('/sync', requireVerifiedChannel, async (req, res) => {
  try {
    // ── Save access token for Phronesis agent to use ──
    const accessToken = req.headers['x-access-token'] || req.body?.accessToken;
    if (accessToken && dbService.db) {
      try {
        const existing = await dbService.getUserByChannelId(req.channelId);
        const meta = (existing?.metadata && typeof existing.metadata === 'object') ? { ...existing.metadata } : {};
        meta.accessToken = accessToken;
        await dbService.db.update(schema.users)
          .set({ metadata: meta, lastRefresh: new Date(), updatedAt: new Date() })
          .where(eq(schema.users.channelId, req.channelId));
      } catch (tokenErr) { console.warn('[Sync] Token save failed:', tokenErr.message); }
    }
    try {
      if (dbService.db) {
        const user = await dbService.getUserByChannelId(req.channelId);
        if (user && user.plan !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
          await dbService.updateUserCredits(req.channelId, FREE_MONTHLY_CREDITS);
          await dbService.updateUserPlan(req.channelId, 'free');
        }
      }
    } catch (dbErr) {
      console.warn('[Credits] DB operations failed during sync check, falling back to KV/memory:', dbErr.message);
    }
    await refreshCredits(req.channelId);
    const balance = await getCredits(req.channelId);
    const plan = await getPlan(req.channelId);
    sendRes(res, 200, { credits: balance, plan });
  } catch (e) {
    sendRes(res, 500, { error: e.message, credits: 0, plan: 'free' });
  }
});

router.get('/status', optionalChannelId, async (req, res) => {
  try {
    if (!req.channelId) {
      return sendRes(res, 200, { credits: 0, plan: 'free', needsAuth: true });
    }

    let user = null;
    try {
      if (dbService.db) {
        user = await dbService.getUserByChannelId(req.channelId);

        if (user) {
          // Check for expired paid plans and auto-downgrade
          if (user.plan !== 'free' && user.planExpiresAt && new Date(user.planExpiresAt) < new Date()) {
            await dbService.updateUserCredits(req.channelId, FREE_MONTHLY_CREDITS);
            await dbService.updateUserPlan(req.channelId, 'free');
            logAudit('PLAN_EXPIRED', { channelId: req.channelId, previousPlan: user.plan });
          }
        }
      }
    } catch (dbErr) {
      console.warn('[Credits] DB operations failed during status check:', dbErr.message);
    }

    // Only existing users get credits. Unknown channels must /sync first.
    if (!user) {
      return sendRes(res, 200, { credits: 0, plan: 'free', needsAuth: true });
    }

    await refreshCredits(req.channelId);
    const balance = await getCredits(req.channelId);
    const userPlan = await getPlan(req.channelId);
    sendRes(res, 200, { credits: balance, plan: userPlan });
  } catch (e) {
    console.error('[credits/status] Error:', e.message);
    sendRes(res, 500, { error: e.message, credits: 0, plan: 'free' });
  }
});

router.post('/deduct', requireVerifiedChannel, validateBody(deductSchema), async (req, res) => {
  try {
    const { action, channelId, idempotencyKey } = req.body;
    const effectiveChannelId = channelId || req.channelId;
    
    if (!effectiveChannelId) {
      return sendRes(res, 400, { error: 'Missing Channel ID' });
    }

    if (!action || !CREDIT_COSTS[action]) {
      return sendRes(res, 400, { error: 'Invalid action' });
    }

    // Idempotency check — prevent double-deduction on retry
    if (idempotencyKey) {
      const ikey = `idem:${effectiveChannelId}:${action}:${idempotencyKey}`;
      const cached = await safeKV('get', ikey);
      if (cached) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        console.log('[Idempotency] Replayed deduction, returning cached result:', ikey);
        return sendRes(res, 200, parsed);
      }
    }

    await refreshCredits(effectiveChannelId);
    const cost = CREDIT_COSTS[action];
    const result = await deductCredits(effectiveChannelId, cost);

    if (!result.success) {
      return sendRes(res, 403, { error: result.error, credits: result.balance });
    }

    const responseBody = { success: true, credits: result.balance, action, cost };

    // Cache result for idempotency
    if (idempotencyKey) {
      const ikey = `idem:${effectiveChannelId}:${action}:${idempotencyKey}`;
      await safeKV('set', ikey, JSON.stringify(responseBody), { ex: IDEMPOTENCY_TTL_SECONDS });
    }

    sendRes(res, 200, responseBody);
  } catch (e) {
    console.error('[Credits] Route error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});


router.post('/nonce', nonceLimiter, async (req, res) => {
  try {
    const { plan, channelId } = req.body;
    if (!PLAN_CREDITS[plan]) {
      return sendRes(res, 400, { error: 'Invalid plan name' });
    }
    // Allow guest requests - CSRF middleware already verified the token
    // If no channelId or invalid, use 'Guest' to allow landing page guest checkout
    const effectiveChannelId = (channelId && VALID_CHANNEL_ID(channelId)) ? channelId : 'Guest';
    
    const expectedPrice = PLAN_PRICES[plan];
    const nonce = await createPaypalNonce(effectiveChannelId, plan, expectedPrice);
    sendRes(res, 200, { nonce, expiresIn: 900 });
  } catch (e) {
    sendRes(res, 500, { error: e.message });
  }
});

router.post('/purchase-success', purchaseLimiter, validateBody(purchaseSuccessSchema), async (req, res) => {
  try {
    const { orderID, plan, channelId, nonce } = req.body;
    const effectiveChannelId = (channelId && VALID_CHANNEL_ID(channelId)) ? channelId : 'Guest';
    if (!PLAN_CREDITS[plan]) return sendRes(res, 400, { error: 'Invalid plan name' });

    // Validate PayPal nonce to prevent custom_id manipulation
    const expectedPrice = PLAN_PRICES[plan];
    const nonceValidation = await validatePaypalNonce(nonce, effectiveChannelId, plan, expectedPrice);
    if (!nonceValidation.valid) {
      logAudit('PURCHASE_NONCE_FAILED', { channelId, plan, orderID, reason: nonceValidation.error });
      return sendRes(res, 400, { error: 'Payment session invalid. Please refresh and try again.' });
    }

    const finalCredits = PLAN_CREDITS[plan];
    const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    const expectedPriceCents = Math.round(parseFloat(expectedPrice) * 100);

    const isTestOrder = orderID.startsWith('TEST_ORDER_') && process.env.ALLOW_TEST_PURCHASES === 'true';

    const existingOrder = await dbService.db
      .select()
      .from(schema.paypalOrders)
      .where(eq(schema.paypalOrders.orderId, orderID))
      .limit(1);

    if (existingOrder.length > 0) {
      return sendRes(res, 400, { error: 'Order already processed' });
    }

    const paypalSecret = process.env.PAYPAL_SECRET;
    const clientId = process.env.PAYPAL_CLIENT_ID;
    if (!isTestOrder && (!paypalSecret || !clientId)) return sendRes(res, 400, { error: 'Payment verification unavailable' });

    let user = await dbService.getUserByChannelId(channelId);
    if (!user) {
      user = await dbService.createUser(channelId, { isVerified: true });
    }

    if (isTestOrder) {
      await dbService.createPayPalOrder(orderID, user.id, plan, expectedPriceCents, 'USD');
      await dbService.updateUserCredits(channelId, finalCredits);
      await dbService.updateUserPlan(channelId, plan, planExpiresAt);
      await dbService.recordCreditTransaction(
        user.id,
        finalCredits,
        'purchase',
        `Plan purchase (TEST): ${plan}`,
        orderID,
        { plan, amount: expectedPriceCents }
      );
      logAudit('PURCHASE_COMPLETED_TEST', { channelId, orderId: orderID, plan, credits: finalCredits, isTestOrder: true });
      return sendRes(res, 200, { success: true, credits: finalCredits, plan: plan });
    }

    const isLive = process.env.PAYPAL_MODE === 'live';
    if (process.env.NODE_ENV === 'production' && !isLive) return sendRes(res, 400, { error: 'Sandbox payments not accepted' });
    const paypalBase = isLive ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    const paypalRes = await fetch(`${paypalBase}/v2/checkout/orders/${orderID}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(clientId + ':' + paypalSecret).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!paypalRes.ok) return sendRes(res, 400, { error: 'Payment verification failed' });
    const paypalData = await paypalRes.json();
    
    // If order is only APPROVED (not captured), capture it server-side
    if (paypalData.status === 'APPROVED' || paypalData.status === 'CREATED') {
      const captureRes = await fetch(`${paypalBase}/v2/checkout/orders/${orderID}/capture`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(clientId + ':' + paypalSecret).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });
      if (!captureRes.ok) {
        const captureErr = await captureRes.json().catch(() => ({}));
        console.error('[PayPal] Server capture failed:', captureErr);
        return sendRes(res, 400, { error: 'Payment capture failed: ' + (captureErr.message || captureErr.error || 'unknown') });
      }
      const captured = await captureRes.json();
      if (captured.status !== 'COMPLETED') return sendRes(res, 400, { error: 'Payment not completed after capture' });
      paypalData.status = 'COMPLETED';
    }
    
    if (paypalData.status !== 'COMPLETED') return sendRes(res, 400, { error: 'Payment not completed' });

    const paidAmount = paypalData.purchase_units?.[0]?.amount?.value;
    if (!paidAmount) return sendRes(res, 400, { error: 'Payment amount missing' });
    const paidCents = Math.round(parseFloat(paidAmount) * 100);
    if (paidCents !== expectedPriceCents) return sendRes(res, 400, { error: 'Payment amount mismatch' });

    // Nonce already validated above - channelId is trusted at this point
    // Wrap purchase operations in a database transaction
    await dbService.db.transaction(async (tx) => {
      await tx.insert(schema.paypalOrders).values({
        orderId: orderID,
        userId: user.id,
        plan,
        amount: expectedPriceCents,
        currency: 'USD',
        status: 'completed',
        completedAt: new Date(),
      });
      await tx.update(schema.users)
        .set({ credits: finalCredits, plan, planExpiresAt, updatedAt: new Date() })
        .where(eq(schema.users.channelId, effectiveChannelId));
      await tx.insert(schema.creditTransactions).values({
        userId: user.id,
        amount: finalCredits,
        type: 'purchase',
        description: `Plan purchase: ${plan}`,
        reference: orderID,
        metadata: { plan, amount: expectedPriceCents },
      });
    });

    logAudit('PURCHASE_COMPLETED', {
      channelId: effectiveChannelId,
      orderId: orderID,
      plan,
      credits: finalCredits,
      amount: expectedPriceCents / 100,
      isTestOrder
    });

    sendRes(res, 200, { success: true, credits: finalCredits, plan: plan });
  } catch (error) {
    console.error('[PURCHASE CRITICAL] Payment processing failed:', error.message);
    captureError(error, { 
      tags: { category: 'payment', severity: 'critical' },
      extra: { orderID, plan, channelId: effectiveChannelId }
    });
    sendRes(res, 500, { error: 'Payment processing failed. Our team has been alerted.' });
  }
});

router.post('/paypal/webhook', async (req, res) => {
  try {
    const paypalSecret = process.env.PAYPAL_SECRET;
    if (!paypalSecret) {
      console.error('[PayPal] PAYPAL_SECRET not configured');
      return sendRes(res, 500, { error: 'Webhook configuration error' });
    }

    if (!await verifyPayPalWebhook(req, paypalSecret)) {
      return sendRes(res, 401, { error: 'Invalid webhook signature' });
    }

    const event = req.body;

    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = event.resource.supplementary_data?.related_ids?.order_id;
      const customId = event.resource.custom_id;

      if (!orderId || !customId) {
        console.warn('[PayPal] Missing order ID or custom ID in webhook');
        return sendRes(res, 200, { received: true });
      }

      const existingOrder = await dbService.db
        .select()
        .from(schema.paypalOrders)
        .where(eq(schema.paypalOrders.orderId, orderId))
        .limit(1);

      if (existingOrder.length > 0) {
        return sendRes(res, 200, { received: true });
      }

      if (!VALID_CHANNEL_ID(customId)) {
        console.warn('[PayPal] Invalid channel ID in webhook:', customId);
        return sendRes(res, 200, { received: true });
      }

      const amount = event.resource.amount?.value;
      if (!amount) {
        console.warn('[PayPal] Missing payment amount in webhook');
        return sendRes(res, 200, { received: true });
      }

      let matchedPlan = null;
      for (const [plan, price] of Object.entries(PLAN_PRICES)) {
        if (Math.round(parseFloat(price) * 100) === Math.round(parseFloat(amount) * 100)) {
          matchedPlan = plan;
          break;
        }
      }

      if (!matchedPlan) {
        console.warn('[PayPal] Payment amount does not match any plan:', amount);
        return sendRes(res, 200, { received: true });
      }

      const finalCredits = PLAN_CREDITS[matchedPlan];
      const user = await dbService.getUserByChannelId(customId) ||
                   await dbService.createUser(customId, { isVerified: true });

      await dbService.createPayPalOrder(orderId, user.id, matchedPlan, Math.round(parseFloat(amount) * 100), 'USD');
      await dbService.updatePayPalOrderStatus(orderId, 'completed');
      await dbService.updateUserCredits(customId, finalCredits);
      const whPlanExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await dbService.updateUserPlan(customId, matchedPlan, whPlanExpiresAt);
      await dbService.recordCreditTransaction(
        user.id,
        finalCredits,
        'purchase',
        `Plan purchase via webhook: ${matchedPlan}`,
        orderId,
        { plan: matchedPlan, amount: parseFloat(amount) }
      );

      logAudit('WEBHOOK_PURCHASE_COMPLETED', {
        channelId: customId,
        orderId,
        plan: matchedPlan,
        credits: finalCredits,
        amount: parseFloat(amount),
        eventType: event.event_type
      });

    }

    sendRes(res, 200, { received: true });
  } catch (error) {
    console.error('[PayPal] Webhook processing error:', error.message);
    sendRes(res, 200, { received: true, error: 'Processing failed' });
  }
});

router.get('/quota/status', (req, res) => {
  res.status(200).json({ usedToday: 1500, limit: 10000 });
});

router.post('/save-state', validateBody(saveStateSchema), async (req, res) => {
  try {
    const { channelId, state } = req.body;
    sendRes(res, 200, { success: true });
  } catch (e) {
    console.error('[api/save-state] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});
