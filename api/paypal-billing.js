// api/paypal-billing.js — Subscription billing for YT SEO Architect
// Owner mode: complete, self-provisioning, zero manual steps.
//
// What this does
//   1. Auto-creates the PayPal Product + 2 Plans ($12/mo Pro, $149 Lifetime) on first use.
//   2. Exposes hosted subscription links — no PayPal UI clicking required.
//   3. Verifies every webhook against PayPal's signature API (production hardening).
//   4. On payment, writes plan='pro' + plan_expires_at to the users table.
//   5. Degrades gracefully: if PayPal creds are missing it returns a paypal.me fallback
//      instead of throwing, so the pricing page never breaks.
//
// Routes (mounted at /api/billing)
//   GET  /api/billing/pay?plan=pro|life&channelId=UC...   → redirects to PayPal
//   POST /api/billing/webhook                              → PayPal IPN/Webhook receiver
//   GET  /api/billing/status?channelId=UC...               → { plan, expiresAt, active }
//   GET  /api/billing/health                               → config self-check

import crypto from 'crypto';
import { Router } from 'express';

const paypalBilling = Router();

const PAYPAL_API = (process.env.PAYPAL_ENV === 'live' || process.env.VERCEL_ENV === 'production')
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

// The Vercel account stores this var as "WebhookID" (from an earlier integration);
// the billing code originally only read PAYPAL_WEBHOOK_ID, so webhooks were silently
// dropped. Accept every name the project has used.
function webhookId() {
  return (
    process.env.PAYPAL_WEBHOOK_ID ||
    process.env.WebhookID ||
    process.env.PAYPAL_WEBHOOKID ||
    process.env.WEBHOOK_ID ||
    ''
  );
}

// Legacy sandbox creds look like "sb" — treat those as "not configured" for billing.
function creds() {
  const id = process.env.PAYPAL_CLIENT_ID || '';
  const secret = process.env.PAYPAL_SECRET || '';
  if (!id || !secret || id === 'sb' || id.length < 20) return null;
  return { id, secret };
}

const PLAN_CACHE = {}; // in-memory; survives warm invocations

// ── PayPal REST helpers ──────────────────────────────────────────────
async function accessToken() {
  const c = creds();
  if (!c) throw new Error('PAYPAL_NOT_CONFIGURED');
  const auth = Buffer.from(`${c.id}:${c.secret}`).toString('base64');
  const r = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials'
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`PAYPAL_AUTH_${r.status}: ${j.error_description || j.error || ''}`);
  return j.access_token;
}

async function pp(method, path, body, token) {
  const t = token || (await accessToken());
  const r = await fetch(`${PAYPAL_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${t}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': crypto.randomUUID()
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await r.text();
  let j = {};
  try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) {
    const err = new Error(`PAYPAL_${method}_${r.status}: ${(j.details && j.details[0] && j.details[0].description) || j.message || j.name || ''}`);
    err.paypal = j; err.status = r.status;
    throw err;
  }
  return j;
}

// ── Product + Plan provisioning (idempotent, cached) ────────────────
async function ensureCatalog() {
  if (PLAN_CACHE.proId && PLAN_CACHE.planPro && PLAN_CACHE.planLife) return PLAN_CACHE;
  const token = await accessToken();

  // Product: one per site
  let productId = process.env.PAYPAL_PRODUCT_ID || null;
  if (!productId) {
    try {
      const p = await pp('POST', '/v1/catalogs/products', {
        name: 'YT SEO Architect Pro',
        description: 'AI-powered YouTube SEO toolkit — unlimited audits, bulk optimization, automation.',
        type: 'SERVICE',
        category: 'SOFTWARE'
      }, token);
      productId = p.id;
    } catch (e) {
      // Recover: look up an existing product by name before giving up
      const list = await pp('GET', '/v1/catalogs/products?page_size=20', null, token).catch(() => null);
      const found = list && list.products && list.products.find(x => x.name === 'YT SEO Architect Pro');
      if (found) productId = found.id; else throw e;
    }
  }

  const mkPlan = async (key, body) => {
    if (process.env[key]) return process.env[key];
    if (PLAN_CACHE[key]) return PLAN_CACHE[key];
    try {
      const r = await pp('POST', '/v1/billing/plans', { product_id: productId, ...body }, token);
      PLAN_CACHE[key] = r.id;
      return r.id;
    } catch (e) {
      const list = await pp('GET', `/v1/billing/plans?product_id=${productId}&page_size=20`, null, token).catch(() => null);
      const found = list && list.plans && list.plans.find(x => x.name === body.name);
      if (found) { PLAN_CACHE[key] = found.id; return found.id; }
      throw e;
    }
  };

  const planPro = await mkPlan('PAYPAL_PLAN_PRO', {
    name: 'YT SEO Architect Pro — Monthly',
    description: '$12/month. Unlimited audits, Bulk Injector, Auto-Responder, unlimited AI Coach.',
    status: 'ACTIVE',
    billing_cycles: [{
      frequency: { interval_unit: 'MONTH', interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { value: '12.00', currency_code: 'USD' } }
    }],
    payment_preferences: {
      auto_bill_outstanding: true,
      setup_fee_failure_action: 'CONTINUE',
      payment_failure_threshold: 3
    }
  });

  const planLife = await mkPlan('PAYPAL_PLAN_LIFETIME', {
    name: 'YT SEO Architect Lifetime',
    description: '$149 one-time. Pro features forever, founding member badge.',
    status: 'ACTIVE',
    billing_cycles: [{
      frequency: { interval_unit: 'MONTH', interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 1,
      pricing_scheme: { fixed_price: { value: '149.00', currency_code: 'USD' } }
    }],
    payment_preferences: { auto_bill_outstanding: false, payment_failure_threshold: 1 }
  });

  PLAN_CACHE.proId = productId;
  PLAN_CACHE.planPro = planPro;
  PLAN_CACHE.planLife = planLife;
  return PLAN_CACHE;
}

// ── $0-per-month fallback: paypal.me one-time link ──────────────────
function fallbackLink(plan) {
  const handle = process.env.PAYPAL_ME_HANDLE || '';
  const email = process.env.PAYPAL_BUSINESS_EMAIL || '';
  const amount = plan === 'life' ? '149' : '12';
  const label = plan === 'life' ? 'Lifetime' : 'Pro';
  if (handle) return `https://www.paypal.com/paypalme/${handle}/${amount}`;
  if (email) return `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(email)}&item_name=${encodeURIComponent('YT SEO Architect ' + label)}&amount=${amount}&currency_code=USD&no_shipping=1&no_note=1`;
  return null; // nothing configured — caller shows a contact path instead of a dead PayPal page
}

// ── Checkout: 4-tier cascade so a buyer can ALWAYS pay ──────────────
//   1. Recurring PayPal Subscription (true $12/mo auto-renew)
//   2. One-time PayPal Order  (works with only client_id + secret)
//   3. paypal.me / email checkout (if configured via env)
//   4. /contact with a clear message (never a 404)
paypalBilling.get('/pay', async (req, res) => {
  const plan = req.query.plan === 'life' ? 'life' : 'pro';
  const channelId = String(req.query.channelId || '').slice(0, 128) || 'anonymous';
  const origin = `https://${req.headers.host || 'yt-seo-architect.vercel.app'}`;

  if (!creds()) {
    const link = fallbackLink(plan);
    if (link) return res.redirect(302, link);
    return res.redirect(302, `${origin}/contact?billing=unavailable`);
  }

  // Tier 1 — recurring subscription (monthly Pro only; lifetime is one-time)
  if (plan !== 'life') try {
    const cat = await ensureCatalog();
    const planId = cat.planPro; // tier 1 is monthly Pro only
    const token = await accessToken();
    const sub = await pp('POST', '/v1/billing/subscriptions', {
      plan_id: planId,
      custom_id: channelId,
      application_context: {
        brand_name: 'YT SEO Architect',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'SUBSCRIBE_NOW',
        return_url: `${origin}/dashboard?billing=${plan}&ok=1`,
        cancel_url: `${origin}/pricing?billing=cancelled`
      }
    }, token);
    const link = (sub.links || []).find(l => l.rel === 'approve');
    if (!link) throw new Error('PAYPAL_NO_APPROVE_LINK');
    return res.redirect(302, link.href);
  } catch (e) {
    console.warn('[Billing] subscription path failed, trying one-time order:', e.message);
  }

  // Tier 2 — one-time order (Orders v2). Also used for the $149 lifetime.
  try {
    const token = await accessToken();
    const amount = plan === 'life' ? '149.00' : '12.00';
    const order = await pp('POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: plan,
        custom_id: channelId,
        description: plan === 'life' ? 'YT SEO Architect — Lifetime' : 'YT SEO Architect — Pro (1 month)',
        amount: { currency_code: 'USD', value: amount }
      }],
      application_context: {
        brand_name: 'YT SEO Architect',
        locale: 'en-US',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `${origin}/api/billing/return?plan=${plan}`,
        cancel_url: `${origin}/pricing?billing=cancelled`
      }
    }, token);
    const link = (order.links || []).find(l => l.rel === 'approve' || l.rel === 'payer-action');
    if (!link) throw new Error('PAYPAL_NO_APPROVE_LINK');
    return res.redirect(302, link.href);
  } catch (e) {
    console.warn('[Billing] order path failed, using fallback link:', e.message);
  }

  // Tier 3 / 4
  const link = fallbackLink(plan);
  return res.redirect(302, link || `${origin}/contact?billing=unavailable`);
});

// ── One-time order return + capture ─────────────────────────────────
paypalBilling.get('/return', async (req, res) => {
  const orderId = req.query.token;
  const plan = req.query.plan === 'life' ? 'life' : 'pro';
  const origin = `https://${req.headers.host || 'yt-seo-architect.vercel.app'}`;

  if (!orderId || !creds()) return res.redirect(302, `${origin}/dashboard?billing=${plan}&ok=0`);

  try {
    const token = await accessToken();
    const captured = await pp('POST', `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {}, token);
    const pu = (captured.purchase_units || [])[0] || {};
    const channelId = pu.custom_id || 'anonymous';
    const isLifetime = plan === 'life';

    if (channelId && channelId !== 'anonymous') {
      await setUserPlan(channelId, 'pro', isLifetime ? null : addMonth(new Date()), {
        paypal_order_id: orderId,
        paypal_event: 'ORDER.CAPTURED',
        paypal_plan: plan
      });
      console.log(`[Billing] GRANT pro (order) → ${channelId}`);
    }
    return res.redirect(302, `${origin}/dashboard?billing=${plan}&ok=1`);
  } catch (e) {
    console.error('[Billing] capture failed:', e.message);
    return res.redirect(302, `${origin}/dashboard?billing=${plan}&ok=0`);
  }
});

// ── Webhook: verify signature, then grant access ────────────────────
paypalBilling.post('/webhook', async (req, res) => {
  // 1. Signature verification (skipped only if no webhook id configured)
  const whId = webhookId();
  if (!creds() || !whId) {
    console.warn('[Billing] webhook received but webhook id/creds missing — ignoring');
    return res.status(200).json({ received: true, verified: false });
  }
  try {
    const v = await pp('POST', '/v1/notifications/verify-webhook-signature', {
      auth_algo: req.headers['paypal-auth-algo'],
      cert_url: req.headers['paypal-cert-url'],
      transmission_id: req.headers['paypal-transmission-id'],
      transmission_sig: req.headers['paypal-transmission-sig'],
      transmission_time: req.headers['paypal-transmission-time'],
      webhook_id: whId,
      webhook_event: req.body
    });
    if (!v || v.verification_status !== 'SUCCESS') {
      console.warn('[Billing] signature rejected:', v && v.verification_status);
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (e) {
    console.error('[Billing] verify error:', e.message);
    return res.status(500).json({ error: 'Verification failed' });
  }

  // 2. Handle the event
  const ev = req.body || {};
  const type = ev.event_type || '';
  const resource = ev.resource || {};
  const channelId = resource.custom_id || (ev.resource && ev.resource.subscriber && ev.resource.subscriber.payer_id) || null;

  try {
    const grants = {
      'BILLING.SUBSCRIPTION.ACTIVATED': 'pro',
      'BILLING.SUBSCRIPTION.RENEWED': 'pro',
      'BILLING.SUBSCRIPTION.UPDATED': 'pro',
      'PAYMENT.SALE.COMPLETED': 'pro'
    };
    const revokes = {
      'BILLING.SUBSCRIPTION.CANCELLED': 'free',
      'BILLING.SUBSCRIPTION.SUSPENDED': 'free',
      'BILLING.SUBSCRIPTION.EXPIRED': 'free',
      'BILLING.SUBSCRIPTION.PAYMENT.FAILED': 'free'
    };

    if (grants[type] && channelId) {
      // Lifetime plans should never expire
      const isLifetime = (resource.plan_id && resource.plan_id === (PLAN_CACHE.planLife || process.env.PAYPAL_PLAN_LIFETIME));
      await setUserPlan(channelId, 'pro', isLifetime ? null : addMonth(new Date()), {
        paypal_subscription_id: resource.id || null,
        paypal_event: type,
        paypal_plan_id: resource.plan_id || null
      });
      console.log(`[Billing] GRANT pro → ${channelId} (${type})`);
    } else if (revokes[type] && channelId) {
      await setUserPlan(channelId, 'free', null, { paypal_event: type, paypal_subscription_id: resource.id || null });
      console.log(`[Billing] REVOKE → free ${channelId} (${type})`);
    } else {
      console.log(`[Billing] ignored event ${type}`);
    }
  } catch (e) {
    console.error('[Billing] handler error:', e.message);
    // Return 200 so PayPal does not retry-loop on our DB hiccup;
    // a retry storm on a transient DB error is worse than a missed event we can reconcile.
    return res.status(200).json({ received: true, handled: false });
  }

  res.status(200).json({ received: true });
});

function addMonth(d) {
  const n = new Date(d);
  n.setMonth(n.getMonth() + 1);
  return n;
}

async function setUserPlan(channelId, plan, expiresAt, meta) {
  const { default: dbService } = await import('../src/database/services.js');
  const s = await import('../src/database/schema.js');
  const patch = {
    plan,
    planExpiresAt: expiresAt,
    updatedAt: new Date(),
    metadata: meta
  };
  await dbService.db.insert(s.users)
    .values({ channelId, plan, planExpiresAt: expiresAt, metadata: meta })
    .onConflictDoUpdate({ target: s.users.channelId, set: patch });
}

// ── Status check (dashboard uses this to render the badge) ──────────
paypalBilling.get('/status', async (req, res) => {
  const channelId = String(req.query.channelId || '').slice(0, 128);
  if (!channelId || channelId === 'anonymous') return res.json({ plan: 'free', active: false });
  try {
    const { default: dbService } = await import('../src/database/services.js');
    const s = await import('../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    const rows = await dbService.db.select().from(s.users).where(eq(s.users.channelId, channelId)).limit(1);
    const u = rows[0];
    if (!u) return res.json({ plan: 'free', active: false });
    const active = u.plan && u.plan !== 'free' && (!u.planExpiresAt || new Date(u.planExpiresAt) > new Date());
    return res.json({
      plan: active ? u.plan : 'free',
      active: !!active,
      expiresAt: u.planExpiresAt || null
    });
  } catch (e) {
    return res.json({ plan: 'free', active: false, error: 'lookup_failed' });
  }
});

// ── Config self-check (owner diagnostics) ───────────────────────────
paypalBilling.get('/health', async (req, res) => {
  const c = creds();
  const out = {
    configured: !!c,
    env: process.env.PAYPAL_ENV || (process.env.VERCEL_ENV === 'production' ? 'live' : 'sandbox'),
    api: PAYPAL_API,
    webhook_id_set: !!webhookId(),
    plan_pro: process.env.PAYPAL_PLAN_PRO || PLAN_CACHE.planPro || null,
    plan_lifetime: process.env.PAYPAL_PLAN_LIFETIME || PLAN_CACHE.planLife || null,
    fallback: !!process.env.PAYPAL_ME_HANDLE || !!process.env.PAYPAL_BUSINESS_EMAIL,
    checkout_tiers: ['subscription', 'one_time_order', 'paypalme_or_email', 'contact']
  };
  if (c) {
    try {
      await accessToken();
      out.token_ok = true;
      try { await ensureCatalog(); out.catalog_ok = true; }
      catch (e) { out.catalog_ok = false; out.catalog_error = e.message; }
    } catch (e) { out.token_ok = false; out.token_error = e.message; }
  }
  res.json(out);
});

export default paypalBilling;
export { ensureCatalog, fallbackLink, creds };
