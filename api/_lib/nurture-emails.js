// Email nurture module using Resend (free tier: 100/day)
export async function sendNurtureEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Nurture] RESEND_API_KEY not set — skipping email to', to);
    return false;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'YT SEO Architect <onboarding@resend.dev>',
        to: [to],
        subject,
        html,
        tags: [{ name: 'type', value: 'nurture' }]
      })
    });

    if (res.ok) {
      return true;
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn('[Nurture] Resend error:', err.message || res.status);
      return false;
    }
  } catch (e) {
    console.error('[Nurture] Send failed:', e.message);
    return false;
  }
}

// Day 1: Welcome + quick start
export function welcomeEmail(name) {
  const n = name || 'Creator';
  return {
    subject: `Welcome to YT SEO Architect, ${n}! 🚀`,
    html: `
      <div style="max-width:560px;margin:0 auto;font-family:system-ui,sans-serif;color:#e8e8f0;background:#0a0a14;padding:32px;border-radius:12px;">
        <h2 style="color:#f97316;">Welcome, ${n}!</h2>
        <p style="color:#94a3b8;line-height:1.7;font-size:15px;">
          You just unlocked 17 AI-powered YouTube SEO tools. Here's what to do first:
        </p>
        <div style="background:#12122a;border:1px solid #252545;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#f97316;font-weight:700;margin:0 0 8px;">⚡ Quick Start (2 minutes)</p>
          <p style="color:#94a3b8;font-size:14px;margin:0;">
            1. Click <strong>Audit</strong> in the sidebar<br>
            2. Paste any YouTube video URL<br>
            3. Get an instant SEO grade + AI fix suggestions
          </p>
        </div>
        <a href="https://yt-seo-architect.vercel.app/dashboard" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:12px;">Open Dashboard →</a>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">You have <strong>100 free credits</strong> this month. No card needed.</p>
      </div>
    `
  };
}

// Day 3: Run your first audit
export function auditEmail(name) {
  const n = name || 'Creator';
  return {
    subject: `${n}, see how your videos rank (takes 60 sec)`,
    html: `
      <div style="max-width:560px;margin:0 auto;font-family:system-ui,sans-serif;color:#e8e8f0;background:#0a0a14;padding:32px;border-radius:12px;">
        <h2 style="color:#f97316;">Your channel is ready for its first audit</h2>
        <p style="color:#94a3b8;line-height:1.7;font-size:15px;">
          Most creators don't realize their titles are too long, their tags are weak, or their descriptions are missing timestamps — until they run an audit.
        </p>
        <div style="background:#12122a;border:1px solid #252545;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#10b981;font-weight:700;margin:0 0 8px;">✅ What the AI checks:</p>
          <p style="color:#94a3b8;font-size:14px;margin:0;">
            Title optimization · Tag relevance · Description SEO · Thumbnail analysis · Keyword density
          </p>
        </div>
        <a href="https://yt-seo-architect.vercel.app/dashboard" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:12px;">Audit My Channel →</a>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">You have <strong>free credits</strong> remaining — audits don't cost anything.</p>
      </div>
    `
  };
}

// Day 7: Credits expiring reminder
export function reminderEmail(name, credits) {
  const n = name || 'Creator';
  const c = credits || 100;
  return {
    subject: `${n}, your ${c} free credits reset in a few days`,
    html: `
      <div style="max-width:560px;margin:0 auto;font-family:system-ui,sans-serif;color:#e8e8f0;background:#0a0a14;padding:32px;border-radius:12px;">
        <h2 style="color:#f97316;">Your free credits refresh soon</h2>
        <p style="color:#94a3b8;line-height:1.7;font-size:15px;">
          You have <strong style="color:#f97316;font-size:18px;">${c} credits</strong> remaining this month. They reset at the start of next month — use them before they're gone!
        </p>
        <div style="background:#12122a;border:1px solid #252545;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="color:#f97316;font-weight:700;margin:0 0 8px;">🎯 What you can do:</p>
          <p style="color:#94a3b8;font-size:14px;margin:0;">
            🔍 Keyword research (3 credits)<br>
            📝 AI title generation (1 credit)<br>
            🎬 Video script generator (10 credits)<br>
            🏷️ Tag optimization (free)<br>
            📊 Channel audit (free)
          </p>
        </div>
        <a href="https://yt-seo-architect.vercel.app/dashboard" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin-top:12px;">Use My Credits →</a>
        <p style="color:#64748b;font-size:12px;margin-top:24px;">Need more? Upgrade to <strong>Pro ($5/mo)</strong> for 1,000 credits.</p>
      </div>
    `
  };
}
