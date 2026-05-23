// api/notifications/digest.js
// Phronesis Agent — Post-scan notification digest
// Called from orchestrator at end of runAutonomousLoop()
// Sends a brief summary after each agent scan via Email (Resend) or Webhook.

const RESEND_API = 'https://api.resend.com/emails';

export async function sendDigest({ results, goal, userEmail, webhookUrl }) {
  const items = [];
  if (results.propose?.queued) {
    items.push(`${results.propose.queued} proposal${results.propose.queued !== 1 ? 's' : ''} queued in your Command Inbox`);
  }
  if (results.propose?.autoApplied) {
    items.push(`${results.propose.autoApplied} auto-applied`);
  }
  if (results.recommend?.alerts) {
    items.push(`${results.recommend.alerts} recommendation${results.recommend.alerts !== 1 ? 's' : ''} in the alerts column`);
  }
  if (results.scan?.scanned) {
    items.push(`${results.scan.scanned} video${results.scan.scanned !== 1 ? 's' : ''} scanned`);
  }
  if (results?.qualityGates?.passed === false) {
    items.push(`⚠️ Quality gate failure: ${results.qualityGates.failures?.join(', ') || 'see logs'}`);
  }

  const lines = [
    `Phronesis Agent — Scan Report`,
    goal ? `Goal: ${goal}` : null,
    items.length ? items.join('\n') : 'No proposals this cycle — channel looks healthy.',
    '',
    `View inbox → https://youtube-seo-architect.vercel.app/dashboard`,
  ].filter(Boolean);

  const text = lines.join('\n');

  // ── 1. Webhook POST (Slack / Discord / Zapier / anything) ──
  if (webhookUrl) {
    try {
      const url = new URL(webhookUrl);
      const hostname = url.hostname.toLowerCase();
      const privateCIDRs = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|::1$|^fc|^fd|^fe80)/;
      if (url.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS');
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || privateCIDRs.test(hostname)) {
        throw new Error('Webhook URL must not target internal/loopback addresses');
      }
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          blocks: [
            { type: 'header', text: { type: 'plain_text', text: '🤖 Phronesis Agent — Scan Complete' } },
            ...items.map(i => ({ type: 'section', text: { type: 'plain_text', text: i } })),
            { type: 'section', text: { type: 'mrkdwn', text: '<https://youtube-seo-architect.vercel.app/dashboard|Open Dashboard →' } },
          ],
        }),
      });
      if (!resp.ok) console.warn('[NOTIFY] Webhook failed:', resp.status);
    } catch (e) { console.warn('[NOTIFY] Webhook error:', e.message); }
  }

  // ── 2. Resend email ──
  // Requires RESEND_API_KEY in environment and a from_address in agentSettings
  if (userEmail) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        const resp = await fetch(RESEND_API, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Phronesis Agent <agent@youtube-seo-architect.vercel.app>',
            to: [userEmail],
            subject: goal ? `Phronesis: ${results.propose?.queued || 0} proposals for "${goal}"` : 'Phronesis Agent — Daily Pulse',
            text,
          }),
        });
        if (!resp.ok) console.warn('[NOTIFY] Email failed:', resp.status);
      }
    } catch (e) { console.warn('[NOTIFY] Email error:', e.message); }
  }
}
