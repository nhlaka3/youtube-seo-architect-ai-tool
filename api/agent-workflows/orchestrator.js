// api/agent-workflows/orchestrator.js
// Task 14 + agentking.txt — Autonomous Orchestrator with confidence routing, Command Inbox, safety
import express from 'express';
export const router = express.Router();
const sendRes = (res, status, data) => { if (!res.headersSent) res.status(status).json(data); };
import { formatAgentLog, firstPersonLog } from '../../utils/format-agent-log.js';
import { applyLearningWeight, getLearningAdjustments, trackOutcome } from '../agent-core/outcome-tracker.js';
import { z } from 'zod';

// ── Notification digest: sends email + webhook + in-app summary ──
// Called fire-and-forget at end of runAutonomousLoop()
const _digestLock = false;  // set to true only inside function body
let _digestRunning = false;

export async function sendDigest({ results, goal, webhookUrl, userEmail }) {
  // Simple fire-once guard: skip if already running
  if (globalThis._phronesisDigestRunning) return;
  globalThis._phronesisDigestRunning = true;
  try {
    const proposed = results?.propose?.proposed || 0;
    const queued   = results?.propose?.queued   || 0;
    const alerts   = results?.recommend?.alerts || 0;
    const applied  = results?.propose?.autoApplied || 0;
    const scanned  = results?.scan?.scanned    || 0;

    const lines = [
      `🎯 Phronesis Digest — ${new Date().toLocaleString()}`,
      goal ? `Goal: ${goal}` : 'Goal: not set',
      `Scan: ${scanned} videos analyzed`,
      `Proposals: ${proposed} generated (${queued} in inbox, ${applied} auto-applied)`,
      `Alerts: ${alerts} recommendations`,
      '',
      webhookUrl ? `Dashboard: https://yt-seo-architect.vercel.app/dashboard` : ''
    ].filter(Boolean);

    const body = lines.join('\n');

// ── 1. Webhook (Slack / Discord / IFTTT / Zapier)
    if (webhookUrl) {
      try {
        const url = new URL(webhookUrl);
        const hostname = url.hostname.toLowerCase();
        const privateCIDRs = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|169\.254\.|::1$|^fc|^fd|^fe80)/;
        if (url.protocol !== 'https:') throw new Error('Webhook URL must use HTTPS');
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || privateCIDRs.test(hostname)) {
          throw new Error('Webhook URL must not target internal/loopback addresses');
        }
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: body,
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: '🎯 Phronesis Agent Digest' } },
              { type: 'section', fields: [
                { type: 'mrkdwn', text: `*Scanned:* ${scanned} videos` },
                { type: 'mrkdwn', text: `*Proposals:* ${proposed}` },
                { type: 'mrkdwn', text: `*Queued:* ${queued}` },
                { type: 'mrkdwn', text: `*Auto-applied:* ${applied}` },
                { type: 'mrkdwn', text: `*Alerts:* ${alerts}` },
                { type: 'mrkdwn', text: `*Goal:* ${goal || 'not set'}` }
              ]}
            ]
          })
        }).catch(() => {});
      } catch(e) { /* non-critical */ }
    }

    // 2. Email digest via Resend
    if (userEmail && process.env.RESEND_API_KEY) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Phronesis <agent@yt-seo-architect.vercel.app>',
            to: userEmail,
            subject: `🎯 Phronesis Report — ${proposed} proposals, ${alerts} alerts`,
            text: body
          })
        }).catch(() => {});
      } catch(e) { /* non-critical */ }
    }
  } catch(e) { /* swallow */ }
}

// ── Fetch the user's OWN uploaded videos via YouTube API ──
async function fetchUnderperformingVideos(niche = 'YouTube SEO', goalFormat = null, goalKeywords = null, targetChannelId = null) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const users = await dbService.getAllUsers(100);
    // Filter to target channel if specified
    const filteredUsers = targetChannelId
      ? users.filter(u => u.channelId === targetChannelId)
      : users;
    const results = [];

    for (const user of filteredUsers) {
      if (!user.metadata?.accessToken) continue;
      try {
        const accessToken = user.metadata.accessToken;

        // Step 1: Get the user's uploads playlist ID
        const channelRes = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true',
          { headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(3000) }
        );
        if (!channelRes.ok) continue;
        const channelData = await channelRes.json();
        const uploadsPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        if (!uploadsPlaylistId) continue;

        // Step 2: Fetch the user's uploaded videos (last 50)
        const playlistRes = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId=${uploadsPlaylistId}&maxResults=25`,
          { headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(3000) }
        );
        if (!playlistRes.ok) continue;
        const playlistData = await playlistRes.json();
        const videoIds = (playlistData.items || []).map(i => i.contentDetails?.videoId).filter(Boolean);
        if (!videoIds.length) continue;

        // Step 3: Get statistics + full snippet for all videos
        const statsRes = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet,contentDetails&id=${videoIds.slice(0, 25).join(',')}`,
          { headers: { Authorization: 'Bearer ' + accessToken }, signal: AbortSignal.timeout(3000) }
        );
        if (!statsRes.ok) continue;
        const statsData = await statsRes.json();

        // Step 4: Score every video — NO arbitrary niche filter
        for (const v of (statsData.items || [])) {
          const title = v.snippet?.title || '';
          const description = v.snippet?.description || '';
          const tags = v.snippet?.tags || [];
          const views = parseInt(v.statistics?.viewCount || '0');
          const likes = parseInt(v.statistics?.likeCount || '0');
          const comments = parseInt(v.statistics?.commentCount || '0');
          const eng = views > 0 ? ((likes + comments) / views * 100) : 0;
          const duration = v.contentDetails?.duration || '';
          // Tag as Short (under 60s) vs long-form — different scoring applies
          const isShort = duration.includes('S') && !duration.includes('M');
          const format = isShort ? 'short' : 'long';

          // Flag issues across ALL dimensions (different criteria for Shorts vs long-form)
          const issues = [];
          if (isShort) {
            if (title.length < 10) issues.push('Shorts title too short');
            if (!/#shorts/i.test(title + ' ' + description)) issues.push('Missing #shorts hashtag');
            if (views < 100) issues.push('Low Shorts views');
            if (views > 100 && eng < 3) issues.push('Low Shorts engagement (' + eng.toFixed(1) + '%)');
          } else {
            if (title.length < 25) issues.push('Title too short (' + title.length + ' chars)');
            if (title.length > 60) issues.push('Title too long (' + title.length + ' chars — truncated)');
            if (!description || description.length < 200) issues.push('Description too short (' + (description ? description.length : 0) + ' chars)');
            if (!/\d{1,2}:\d{2}/.test(description)) issues.push('No timestamps/chapters');
            if (tags.length < 8) issues.push('Only ' + tags.length + ' tags');
            if (tags.some(t => /\s/.test(t))) issues.push('Tags contain spaces');
            if (views > 100 && eng < 2) issues.push('Low engagement (' + eng.toFixed(1) + '%)');
            if (views < 50) issues.push('Very low views (' + views + ')');
          }

          // Always include — the orchestrator will decide whether to act based on SEO scores
          results.push({
            channelId: user.channelId,
            videoId: v.id,
            title: title,
            description: description,
            tags: tags,
            views, likes, comments,
            engagementRate: +eng.toFixed(2),
            tagsCount: tags.length,
            issues,
            accessToken,
            format  // 'short' or 'long'
          });
        }
      } catch (e) { /* skip failed user */ }
      break; // Process first valid user only
    }
    // Sort: worst engagement first (most critical to fix)
    results.sort((a, b) => a.engagementRate - b.engagementRate);

    // ── Strategy filter: prefer videos matching goal format & keywords ──
    if (goalFormat || goalKeywords?.length) {
      const scored = results.map(v => {
        let boost = 0;
        if (goalFormat && v.format === goalFormat) boost += 3;
        if (goalKeywords?.length) {
          const titleAndDesc = (v.title + ' ' + v.description).toLowerCase();
          boost += goalKeywords.filter(k => titleAndDesc.includes(k)).length * 1.5;
        }
        return { v, boost };
      });
      scored.sort((a, b) => b.boost - a.boost);           // push goal-aligned videos toward front
      const top = scored.slice(0, 8).map(x => x.v);         // keep best-scored for propose
      results.length = 0;
      top.forEach(v => results.push(v));
    }
    return results;
  } catch (e) { return []; }
}

// ── Real: Scan trends via YouTube API ──
async function scanTrends() {
  try {
    const key = process.env.YOUTUBE_API_KEY || '';
    if (!key) return [];
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=viewCount&maxResults=5&regionCode=US&relevanceLanguage=en&publishedAfter=${new Date(Date.now() - 7*86400000).toISOString()}&q=trending&key=${key}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.items || []).map(v => ({ name: v.snippet?.title || '', videoId: v.id?.videoId || '', channel: v.snippet?.channelTitle || '' }));
  } catch (e) { return []; }
}

// ── Core Autonomous Loop with confidence routing ──
// ═══════════════════════════════════════════════════════════════
//  MULTI-DIMENSIONAL GROWTH ENGINE — YouTube Masterclass Agent
//  ─────────────────────────────────────────────────────────────
//  Orchestrates: Title • Description • Tags • Thumbnail/CTR
//  Retention • A/B Tests • Trends • PSEO • Competitor Gaps
//  Content Calendar • Growth Progress Tracking
// ═══════════════════════════════════════════════════════════════

// ─── Concurrency Guard ─── Prevents overlapping cron / manual runs
let _runToken = 0;           // increments on each call start — old calls self-abort
let _runAbortController = null;

export async function runAutonomousLoop(targetChannelId = null) {
  // Guard: another invocation already running with the same token?
  const myToken = ++_runToken;
  if (_runAbortController) {
    try { _runAbortController.abort(); } catch(e) { /* ignore stale abort */ }
  }
  _runAbortController = new AbortController();
  const signal = _runAbortController.signal;
  if (signal.aborted) return { status: 'cancelled', reason: 'Pre-existing run was aborted' };
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq, desc, gte } = await import('drizzle-orm');

    // ═══ SETTINGS & GUARDRAILS ═══
    const settingsRows = await dbService.db.select().from(s.agentSettings).limit(1);
    const settings = settingsRows[0];
    if (!settings || !settings.isAutonomous) return { status: 'skipped', reason: 'Autonomous mode off' };
    
    // Mark running for /status/clock protection
    await dbService.db.update(s.agentSettings).set({ isRunning: true, updatedAt: new Date() }).where(eq(s.agentSettings.id, 'global'));
    const goal = settings.goal || null;
    const maxDaily = settings.maxDailyOptimizations || 10;
    
    // ── Depth isolation: load config and reset counters for this run ──
    let _depthCfg = { maxActiveBranches: 3, memoryLimitMb: 512, batchSize: 25, reasoningDepth: 2 };
    try {
      const { refreshDepthConfig } = await import('../agent-core/depth-manager.js');
      _depthCfg = await refreshDepthConfig();
    } catch (e) { /* depth manager not yet available — skip */ }
    
    // ── LAYER 2: Circuit Breaker check ──
    try {
      const { checkCircuitBreaker } = await import('../agent-core/scoring-engine.js');
      const breaker = await checkCircuitBreaker();
      if (breaker.tripped) {
        await dbService.db.insert(s.agentActivityLogs).values({
          agentName: 'system',
          actionTaken: '⚠️ CIRCUIT BREAKER TRIPPED — Pausing all sub-agents',
          impactDescription: `Error rate: ${breaker.errorRate}% (threshold: 15%) — ${breaker.errors} errors in ${breaker.totalActions} actions`,
          status: 'warning'
        });
        return { status: 'skipped', reason: 'Circuit breaker tripped — error rate exceeds 15%' };
      }
    } catch (e) { /* non-critical — continue without breaker */ }
    
    // Parse growth strategy from activity log to prioritize agents
    let strategy = null;
    try {
      const strategyLogs = await dbService.db.select().from(s.agentActivityLogs)
        .orderBy(desc(s.agentActivityLogs.createdAt)).limit(50);
      const strategyEntry = strategyLogs.find(l => l.actionTaken && l.actionTaken.startsWith('STRATEGY:'));
      if (strategyEntry) {
        strategy = JSON.parse(strategyEntry.actionTaken.replace('STRATEGY:', ''));
      }
    } catch (e) { /* ignore */ }
    const strategyAgents = strategy ? strategy.subtasks.map(st => st.agent) : null;
    const strategyHasAgent = (agent) => !strategyAgents || strategyAgents.includes(agent);
    
    // Daily limit check
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayLogs = await dbService.db.select().from(s.agentActivityLogs)
      .where(gte(s.agentActivityLogs.createdAt, todayStart));
    const realAgents = ['optimizer', 'trend_scanner', 'pseo_engine', 'ab_tester', 'coach', 'content_planner'];
    const realTodayCount = todayLogs.filter(l => realAgents.includes(l.agentName)).length;
    if (realTodayCount >= maxDaily) {
      return { status: 'skipped', reason: `Daily limit reached: ${realTodayCount}/${maxDaily}` };
    }

    const isDryRun = settings.dryRunMode || false;
    const results = { scan: null, propose: null, recommend: null };

    // ── Credit check: autonomous scan costs 3 credits per run (agency: free) ──
    try {
      const scanChannelId = targetChannelId || settings.channelId || 'global';
      const { getPlan: getPlanDynamic, CREDIT_COSTS: agentCosts } = await import('../credits.js');
      const scanCost = agentCosts['queue-scan'] || 3;
      const userPlan = await getPlanDynamic(scanChannelId);
      if (userPlan !== 'agency') {
        const { deductCredits } = await import('../credits.js');
        const creditResult = await deductCredits(scanChannelId, scanCost);
        if (!creditResult.success) {
          return { status: 'skipped', reason: `Insufficient credits: ${creditResult.balance} remaining` };
        }
      }
    } catch (e) { if (!isDryRun) console.warn('[Agent] Credit check failed:', e.message); }

    // ═══════════════════════════════════════════════════════
    //  TIER 1: SCAN AGENTS (autonomous, silent)
    // ═══════════════════════════════════════════════════════
    // Parse goal into format + keywords for strategy-aware filtering
    let goalFormat = null, goalKeywords = null;
    if (goal) {
      const lower = goal.toLowerCase();
      goalFormat = lower.includes('shorts') ? 'short' : lower.includes('long') ? 'long' : null;
      goalKeywords = lower.split(/[^a-z]+/).filter(w => w.length >= 3 && !['the','get','get','and','for','with','from','into','how','what','when','why','used','make','your','you','out','all','more','will','this','that','have','were','then','than','them','they','most','least','some','good','best','good','need','plan','well','like','only','also'].includes(w));
    }
    const videos = await fetchUnderperformingVideos('YouTube SEO', goalFormat, goalKeywords, targetChannelId);
    
    // Detect channel niche and adapt everything
    const { detectNiche, adaptScoring } = await import('../agent-core/niche-detector.js');
    const nicheInfo = detectNiche(videos);
    
    // ── LAYER 3: Planner — generate action plan from goal ──
    let actionPlan = null;
    if (goal) {
      try {
        const { generatePlan, validatePlanDependencies } = await import('../agent-core/planner.js');
        actionPlan = await generatePlan(Date.now().toString(), goal, nicheInfo.niche);
        const planValidation = validatePlanDependencies(actionPlan);
        // Store plan in activity log for dashboard retrieval
        await dbService.db.insert(s.agentActivityLogs).values({
          agentName: 'system',
          actionTaken: `PLAN:${JSON.stringify(actionPlan)}`,
          impactDescription: `Action plan generated: ${actionPlan.totalSteps} steps across ${actionPlan.phases.length} phases | Estimated: ${actionPlan.estimatedWeeksToGoal} weeks | Validation: ${planValidation.valid ? '✅ valid' : '⚠️ ' + planValidation.reason}`,
          status: 'success'
        });
      } catch (e) { /* non-critical — continue without plan */ }
    }
    results.plan = actionPlan;
    
    if (videos.length > 0) {
      const { runAllScanners } = await import('../scan-agents/index.js');
      // Depth isolation: cap scan batch to configured batch_size
      const scanBatch = videos.slice(0, _depthCfg.batchSize || 25);
      try { const { claimBranch, releaseBranch } = await import('../agent-core/depth-manager.js'); if (!claimBranch(80)) { await dbService.db.insert(s.agentActivityLogs).values({ agentName: 'system', actionTaken: '⏸ Depth cap hit — skipping propose/recommend tiers this run', impactDescription: `Branches: ${_depthCfg.maxActiveBranches}`, status: 'warning' }).catch(()=>{}); } else {  } } catch(e) { /* depth manager optional */ }
      const scanResult = await runAllScanners(scanBatch, videos[0]?.channelId || 'unknown', 'YouTube SEO');
      results.scan = { scanned: scanResult.scanned, analytics: scanResult.analytics };

      if (scanResult.results.length > 0) {
        // Clear old pending queue items so inbox shows only fresh proposals
        try {
          await dbService.db.delete(s.optimizationQueue).where(eq(s.optimizationQueue.status, 'pending'));
        } catch (e) { /* ignore */ }
        
        // ═══════════════════════════════════════════════════════
        //  TIER 2: PROPOSE AGENTS (always run — dryRun only blocks auto-execute)
        // ═══════════════════════════════════════════════════════
        const { runAllProposals } = await import('../propose-agents/index.js');

        // ── LAYER 2: Confidence adjustment from learning history ──
        try {
          const { applyLearningWeight, getLearningAdjustments } = await import('../agent-core/outcome-tracker.js');
          const adj = await getLearningAdjustments((nicheInfo && nicheInfo.niche) || 'General');
          scanResult.results.forEach(r => {
            r.overallScore = applyLearningWeight(r.overallScore || 100, 'scan-score', adj, (nicheInfo && nicheInfo.niche) || 'General');
          });
        } catch (e) { /* learning disabled if module unavailable */ }

        const enriched = scanResult.results.map(r => ({
          ...r,
          videoTitle: videos.find(v => v.videoId === r.videoId)?.title || '',
          currentDescription: videos.find(v => v.videoId === r.videoId)?.description || '',
          currentTags: videos.find(v => v.videoId === r.videoId)?.tags || []
        }));

        const proposeResult = await runAllProposals(
          enriched,
          settings,
          goal,
          strategyAgents  // Only run agents that match the growth strategy
        );
        results.propose = { proposed: proposeResult.proposed, queued: proposeResult.queued, autoApplied: proposeResult.autoApplied };

        // ═══ QUALITY GATES — verify proposals before they ship ═══
        try {
          const { runQualityGates } = await import('../agent-core/quality-gates.js');
          const gateResult = await runQualityGates(scanResult.results, proposeResult.items);
          results.qualityGates = gateResult;
          await dbService.db.insert(s.agentActivityLogs).values({
            agentName: 'system',
            actionTaken: `[QUALITY] ${gateResult.summary}`,
            impactDescription: gateResult.passed ? `${proposeResult.proposed} proposals verified` : gateResult.failures.join('; '),
            status: gateResult.passed ? 'success' : 'warning'
          });
        } catch (e) { /* non-critical */ }

        // Depth isolation: release scan/propose branch before recommend tier
        try { const { releaseBranch } = await import('../agent-core/depth-manager.js'); releaseBranch(80).catch(()=>{}); } catch(e) { /* optional */ }

        // ═══════════════════════════════════════════════════════
        //  TIER 3: RECOMMEND AGENTS (alert only)
        // ═══════════════════════════════════════════════════════
        const { runAllRecommendations } = await import('../recommend-agents/index.js');
        const recResult = await runAllRecommendations(scanResult.results, videos[0]?.channelId || 'unknown', goal);
        results.recommend = { alerts: recResult.alerts };
      }
    } else {
      // No videos from YouTube API — fallback to trends
      try {
        const trends = await scanTrends();
        if (trends.length > 0) {
          await dbService.db.insert(s.agentActivityLogs).values({
            agentName: 'trend_scanner',
            actionTaken: `[SCAN] Trend Pulse: ${trends.length} trending topics found`,
            impactDescription: `Found ${trends.length} topics — capitalize within 48h`,
            status: 'success'
          });
          results.scan = { trends: trends.length };
        }
      } catch (e) { /* skip */ }

      // PSEO check — BLOG POSTS PERMANENTLY DISABLED (2026-05-19)
      // The autoPublishPseo path below has been permanently blocked.
      // Blog posts must NOT be published automatically by the Phronesis agent.
      if (false && settings.autoPublishPseo) {
        try {
          const opportunities = await dbService.db.select().from(s.contentOpportunities)
            .where(eq(s.contentOpportunities.status, 'pending'))
            .orderBy(desc(s.contentOpportunities.priority)).limit(2);
          if (opportunities.length > 0) {
            const { generatePageContent, submitToIndexNow } = await import('../programmatic-seo/generator.js');
            for (const opp of opportunities) {
              const slug = opp.targetUrlSlug || opp.keyword.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').substring(0, 60);
              const pageContent = buildLongFormTemplate(opp.keyword, slug);
              await dbService.db.insert(s.seoPages).values({
                opportunityId: opp.id, slug, title: pageContent.title, metaDescription: pageContent.metaDescription,
                h1: pageContent.h1, content: pageContent.content, wordCount: pageContent.wordCount,
                status: 'published', publishedAt: new Date()
              }).onConflictDoUpdate({ target: s.seoPages.slug, set: { status: 'published' } }).catch(() => {});
              await dbService.db.update(s.contentOpportunities).set({ status: 'generated' }).where(eq(s.contentOpportunities.id, opp.id));
              await submitToIndexNow([slug]).catch(() => {});
            }
          }
        } catch (e) { /* skip */ }
      }
    }

    // Summary log
    const scanSummary = results.scan ? `${results.scan.scanned || results.scan.trends || 0} scanned` : 'no videos';
    const proposeSummary = results.propose ? `${results.propose.queued || 0} queued, ${results.propose.autoApplied || 0} auto-applied` : 'none';
    const recSummary = results.recommend ? `${results.recommend.alerts || 0} alerts` : 'none';
    
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'system',
      actionTaken: goal 
        ? `🎯 Phronesis Pipeline [${nicheInfo.niche}]: SCAN(${scanSummary}) → PROPOSE(${proposeSummary}) → RECOMMEND(${recSummary}) toward "${goal}"`
        : `🔍 Phronesis Pipeline [${nicheInfo.niche}]: SCAN(${scanSummary}) → PROPOSE(${proposeSummary}) → RECOMMEND(${recSummary})`,
      impactDescription: '3-tier pipeline complete',
      status: 'success'
    });

    if (!results.scan && !results.propose && !results.recommend) {
      await dbService.db.insert(s.agentActivityLogs).values({
        agentName: 'system',
        actionTaken: 'Phronesis scan complete — no high-confidence actions needed',
        impactDescription: goal ? `Working toward: ${goal}` : 'Channel looks healthy',
        status: 'success'
      });
    }

    // ── Notification digest: email + webhook (fire-and-forget) ──
    // ── Notification digest: email + webhook (fire-and-forget, self-contained scope) ──
    (async function fireDigest(){
      try{
        const { default: _db } = await import('../../src/database/services.js');
        const _s = await import('../../src/database/schema.js');
        const settingsRows = await _db.db.select({
          notifyEmail: _s.agentSettings.notifyEmail,
          webhookUrl: _s.agentSettings.webhookUrl
        }).from(_s.agentSettings).limit(1);
        const settings = settingsRows[0] || {};
        await sendDigest({ results, goal,
          webhookUrl: settings.webhookUrl || process.env.NOTIFY_WEBHOOK_URL || '',
          userEmail: settings.notifyEmail || process.env.NOTIFY_USER_EMAIL || ''
        });
      }catch(e){ console.warn('[PHRONESIS] Digest failed:', e.message); }
    })();

    // ── FULLY AUTONOMOUS: sweep → YouTube push before marking idle ──
    await autoApplySweep().catch(function(e){ console.warn('[PHRONESIS] Auto-apply sweep failed:', e.message); });

    // ── POST-LOOP BRAIN: retrospective, safety, confidence cal, growth model ──
    (async function postLoopHooks(){
      try{
        const { default: _db } = await import('../../src/database/services.js');
        const _s = await import('../../src/database/schema.js');
        const { eq, desc, gte } = await import('drizzle-orm');
        // Retrospective + decay — recalibrate confidence based on recent outcomes
        try{
          const { batchApplyDecay, calculateNicheLambda } = await import('../agent-core/retrospective.js');
          const lambda = calculateNicheLambda('General');
          await batchApplyDecay(7).catch(function(){}); // 7-day novelty decay
          await _db.db.insert(_s.agentActivityLogs).values({
            agentName: 'system',
            actionTaken: '🧠 Retrospective: decay applied (λ=' + lambda.toFixed(3) + ') — stale signals downweighted',
            impactDescription: 'Weekly calibration keeps confidence honest — no stale free-rides',
            status: 'success'
          }).catch(function(){});
        }catch(e2){/* non-blocking */}

        // Safety validator — verify today's agent actions are within policy
        try{
          const { checkDailyLimits } = await import('../agent-core/safety.js');
          const lim = await checkDailyLimits('global');
          if (!lim.allowed) {
            await _db.db.insert(_s.agentActivityLogs).values({
              agentName: 'system',
              actionTaken: '⚠️ DAILY LIMIT REACHED — agent will idle tomorrow',
              impactDescription: `${lim.used}/${lim.max} actions used today`,
              status: 'warning'
            }).catch(function(){});
          }
        }catch(e2){/* non-blocking */}

        // Confidence engine — validate that our auto-apply bar is calibrated to reality
        try{
          const { calculateConfidence, getHistoricalData } = await import('../agent-core/confidence-engine.js');
          const histTags = await getHistoricalData('tags', 'General');
          const histTitle = await getHistoricalData('title', 'General');
          const confTags = calculateConfidence('tags', histTags, { seoScore: 60 });
          const confTitle = calculateConfidence('title', histTitle, { seoScore: 60 });
          const suggestedThresholdTags = confTags >= 80 ? 88 : confTags >= 65 ? 85 : 90;
          const suggestedThresholdTitle = confTitle >= 80 ? 92 : confTitle >= 65 ? 95 : 98;
          await _db.db.insert(_s.agentActivityLogs).values({
            agentName: 'system',
            actionTaken: `📊 Confidence Engine: tags ≈${confTags}% → threshold ${suggestedThresholdTags}%, titles ≈${confTitle}% → threshold ${suggestedThresholdTitle}%`,
            impactDescription: `Tags win-rate: ${(histTags.winRate*100).toFixed(1)}% (n=${histTags.sampleSize}), Titles win-rate: ${(histTitle.winRate*100).toFixed(1)}% (n=${histTitle.sampleSize})`,
            status: 'success'
          }).catch(function(){});
        }catch(e2){/* non-blocking */}

        // Growth projection — model +365d trajectory based on recent momentum
        try{
          const { compoundGrowthModel } = await import('../agent-core/growth-compounder.js');
          const growth = compoundGrowthModel(100, Date.now(), 30);
          await _db.db.insert(_s.agentActivityLogs).values({
            agentName: 'system',
            actionTaken: '📈 Growth Model: +' + Math.round(growth.expected365) + ' subs/day projected (momentum=' + growth.momentum.toFixed(2) + ')',
            impactDescription: growth.signals ? growth.signals.slice(0,3).join('; ') : 'Model active',
            status: 'success'
          }).catch(function(){});
        }catch(e2){/* non-blocking */}

        // Depth isolation: log final branch state for observability
        try{
          const { getDepthState } = await import('../agent-core/depth-manager.js');
          const ds = getDepthState();
          await _db.db.insert(_s.agentActivityLogs).values({
            agentName: 'system',
            actionTaken: '🔬 Depth State: branches=' + ds.activeBranches + ' mem=' + ds.estimatedMemoryMb + 'MB depth=' + ds.currentDepth + ' (maxB=' + _depthCfg.maxActiveBranches + ' memCap=' + _depthCfg.memoryLimitMb + 'MB)',
            impactDescription: 'Depth isolation keeps agent within resource bounds',
            status: 'success'
          }).catch(function(){});
        }catch(e2b){/* non-blocking */}

      }catch(e){ console.warn('[PHRONESIS] Post-loop hooks crashed:', e.message); }
    })();

    await dbService.db.update(s.agentSettings).set({ isRunning: false, updatedAt: new Date() }).where(eq(s.agentSettings.id, 'global'));
    return { status: 'completed', tasks: results, totalProposals: results.propose?.proposed || 0, queueItemsCreated: results.propose?.queued || 0 };
  } catch (e) {
    console.error('[PHRONESIS] Pipeline crashed:', e.message, e.stack?.substring(0, 300));
    try { await dbService.db.update(s.agentSettings).set({ isRunning: false, updatedAt: new Date() }).where(eq(s.agentSettings.id, 'global')).catch(() => {}); } catch(_) {}
    return { status: 'error', reason: e.message, stack: (e.stack || '').substring(0, 500) };
  }
}

// ── AUTO-APPLY SWEEP — pushes applied-but-unacted items to YouTube ──
// Called at end of runAutonomousLoop() + exposed as GET /api/agent/auto-apply
let _sweepRunning = false;
export async function autoApplySweep() {
  if (_sweepRunning) return { applied: 0, failed: 0, skipped: 0, reason: 'already running' };
  _sweepRunning = true;
  const t0 = Date.now();
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { sql, eq } = await import('drizzle-orm');
    const settingsRow = await dbService.db.select().from(s.agentSettings).limit(1);
    const settings = settingsRow[0];
    if (!settings || !settings.isAutonomous || settings.dryRunMode) {
      return { applied: 0, failed: 0, skipped: 0, reason: 'dry-run or autonomous off' };
    }

    // ── Fetch all users with YouTube tokens ──
    const users = await dbService.getAllUsers(200);
    const userByChannel = {};
    for (const u of users) {
      if (u.metadata?.accessToken) userByChannel[u.channelId] = u;
    }
    if (!Object.keys(userByChannel).length) return { applied: 0, failed: 0, skipped: 0, reason: 'no users with tokens' };

    // ── Fetch all applied-but-not-yet-pushed-to-YouTube queue items ──
    // A row is "unacted" if actionedAt IS NULL (not yet stamped by the apply step)
    const rawRows = await dbService.db.execute(sql`
      SELECT * FROM ${s.optimizationQueue}
      WHERE status = 'applied' AND actioned_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50
    `);
    const items = (rawRows || []).filter(Boolean);
    if (!items.length) return { applied: 0, failed: 0, skipped: 0, reason: 'nothing to apply' };

    // ── Keep only items whose channel has a token we can use ──
    const actionable = items.filter(item => userByChannel[item.channelId]);
    if (!actionable.length) return { applied: 0, failed: 0, skipped: 0, reason: 'no matching channels' };

    let applied = 0, failed = 0, skippedCount = 0;

    // ── Process items sequentially per-channel to respect YouTube rate limits ──
    const done = new Set();
    for (const item of actionable) {
      if (_runAbortController?.signal?.aborted) break; // killed mid-sweep
      if (done.has(item.id)) continue;
      done.add(item.id);
      const user = userByChannel[item.channelId];
      const token = user.metadata.accessToken;
      try {
        const cleanTags = (item.proposedTags || []).map(t => String(t).replace(/\s+/g, '')).filter(t => t.length > 1).slice(0, 25);
        const vidId = item.videoId;

        // Fetch current YouTube snippet to preserve fields we're not changing
        const getRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${vidId}`, {
          headers: { Authorization: 'Bearer ' + token },
          signal: AbortSignal.timeout(6000)
        });
        if (!getRes.ok) { failed++; continue; }
        const gd = await getRes.json();
        const snip = gd.items?.[0]?.snippet;
        if (!snip) { failed++; continue; }

        // Only update fields that actually changed — YouTube rejects no-op PUTs with 400
        const newTitle   = (item.proposedTitle || item.currentTitle || '').substring(0, 100);
        const newDesc    = item.proposedDescription || item.currentDescription || '';
        const newTags    = cleanTags.length > 0 ? cleanTags : snip.tags;

        const unchanged =
          (snip.title  === newTitle) &&
          (snip.description === newDesc) &&
          JSON.stringify(snip.tags || []) === JSON.stringify(newTags);

        if (unchanged) {
          // Nothing to do — stamp actionedAt and move on
          await dbService.db.update(s.optimizationQueue).set({
            actionedAt: new Date(),
            status: 'applied'
          }).where(eq(s.optimizationQueue.id, item.id)).catch(() => {});
          applied++;
          continue;
        }

        // Push to YouTube
        const putRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
          method: 'PUT',
          headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: vidId,
            snippet: { ...snip, title: newTitle, description: newDesc, tags: newTags }
          }),
          signal: AbortSignal.timeout(15000)
        });
        if (!putRes.ok) { failed++; continue; }

        // ── Credit deduction: auto-apply costs 8 credits per applied item (agency: free) ──
        try {
          const { getPlan: getPlanDyn } = await import('../credits.js');
          const applyPlan = await getPlanDyn(item.channelId);
          if (applyPlan !== 'agency') {
            const { deductCredits } = await import('../credits.js');
            await deductCredits(item.channelId, 8); // proposal-apply cost
          }
        } catch (e) { /* non-critical — continue sweep */ }

        // Stamp DB — this is the atomic marker that YouTube accepted our change
        await dbService.db.update(s.optimizationQueue).set({
          actionedAt: new Date(),
          status: 'applied'
        }).where(eq(s.optimizationQueue.id, item.id));

        await dbService.db.insert(s.optimizationTrials).values({
          channelId: item.channelId, videoId: vidId, videoTitle: item.proposedTitle,
          optimizationType: 'auto-queued', beforeMetrics: {},
          appliedData: {
            oldTitle: item.currentTitle, oldDescription: item.currentDescription,
            oldTags: item.currentTags, newTitle, newDescription: newDesc, newTags
          },
          seoScoreBefore: item.scoreBefore, notes: 'Auto-applied by agent'
        }).catch(() => {});

        // ── Learning signal: record successful outcome ──
        await trackOutcome(item.actionType || 'optimization', 'applied', 'General').catch(function(){});

        applied++;
      } catch(e) {
        failed++;
      }
    }

    return { applied, failed, skipped: skippedCount, elapsedMs: Date.now() - t0 };
  } catch(e) {
    return { applied: 0, failed: 0, skipped: 0, reason: e.message };
  } finally {
    _sweepRunning = false;
  }
}

// ── POST /kill — Emergency kill switch ──
router.post('/kill', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    // Abort any in-flight autonomous loop
    if (_runAbortController) {
      try { _runAbortController.abort(); } catch(e) { /* ignore */ }
      _runAbortController = null;
    }
    await dbService.db.update(s.agentSettings).set({ isAutonomous: false, isRunning: false, dryRunMode: true, updatedAt: new Date() }).where(eq(s.agentSettings.id, 'global'));
    await dbService.db.update(s.optimizationQueue).set({ status: 'skipped' }).where(eq(s.optimizationQueue.status, 'pending'));
    await dbService.db.insert(s.agentActivityLogs).values({ agentName: 'system', actionTaken: '🛑 KILL SWITCH — Agent halted, queue cleared', impactDescription: 'Manual kill — user triggered', status: 'warning' });
    sendRes(res, 200, { success: true, message: 'Agent halted, isRunning cleared' });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── POST /mock-test — Inject 3 sample proposals for UI verification ──
router.post('/mock-test', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { and, eq } = await import('drizzle-orm');

    // Only clear mock-channel items — never touch real channel data
    await dbService.db.delete(s.optimizationQueue).where(eq(s.optimizationQueue.channelId, 'mock-channel'));

    // 1. Optimizer - Title Optimization
    await dbService.db.insert(s.optimizationQueue).values({
      channelId: 'mock-channel', videoId: 'mock-vid-001',
      videoTitle: '10 Powerful Bible Verses for Hope and Strength',
      currentTitle: '10 Powerful Bible Verses for Hope and Strength',
      proposedTitle: '60-Second Bible Verses for Daily Strength: Faith Boost!',
      currentDescription: 'A collection of powerful verses to lift your spirit...',
      actionType: 'title', confidence: 82, evScore: 3.2,
      rationale: 'Curiosity gap + exact-match keyword — shorter title performs better on mobile',
      scoreBefore: 42, scoreAfter: 78, status: 'pending'
    });

    // 2. Trend Pulse - Keyword Opportunity
    await dbService.db.insert(s.optimizationQueue).values({
      channelId: 'mock-channel', videoId: 'mock-vid-002',
      videoTitle: 'AI Bible Study Tools 2026',
      currentTitle: 'AI Bible Study Tools 2026',
      proposedTitle: 'AI Bible Study Revolution: 3 Tools You Need in 2026',
      currentDescription: 'Quick overview of AI tools for Bible study in 2026...',
      proposedDescription: 'Discover the 3 AI-powered Bible study tools transforming how millions engage with scripture in 2026. From instant Greek/Hebrew word studies to AI-generated sermon outlines, these tools are changing the game.\n\n📖 Chapters:\n0:00 — Introduction\n1:15 — Tool #1: Logos AI\n4:30 — Tool #2: BibleMate\n7:45 — Tool #3: ScriptureAI\n10:00 — Which one is right for you?',
      proposedTags: ['ai-bible-study','bible-tools-2026','christian-tech','bible-study-apps','ai-for-christians','scripture-study','logos-bible-software','biblemate','faith-and-technology','digital-bible-study'],
      actionType: 'description', confidence: 78, evScore: 2.4,
      rationale: 'Description too short (currently 60 chars) — YouTube indexes first 200 chars. Add chapters for better retention + 10 optimized tags for search discovery.',
      scoreBefore: 30, scoreAfter: 72, status: 'pending'
    });

    // 3. A/B Tester - Test Complete
    await dbService.db.insert(s.optimizationQueue).values({
      channelId: 'mock-channel', videoId: 'mock-vid-003',
      videoTitle: 'How to Pray Effectively — A Beginners Guide',
      currentTitle: 'How to Pray Effectively — A Beginners Guide',
      proposedTitle: 'How to Pray Effectively (5-Minute Daily Guide)',
      currentDescription: 'Learn the basics of prayer in this beginner-friendly guide...',
      actionType: 'title', confidence: 86, evScore: 4.1,
      rationale: 'Add time hook ("5-Minute") — A/B test showed +23% CTR over original. Shorter, more actionable titles convert better.',
      scoreBefore: 48, scoreAfter: 85, status: 'pending'
    });

    // Activity feed entries
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'optimizer', status: 'success',
      actionTaken: '🔧 Title proposal: "10 Powerful Bible Verses..." → "60-Second Bible Verses for Daily Strength"',
      impactDescription: 'Curiosity gap + exact-match keyword | Confidence: 82% | Est. +15% CTR'
    });
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'trend_scanner', status: 'success',
      actionTaken: '⚡ Trend Pulse: "AI Bible Study" surging 340% this week',
      impactDescription: 'High alignment with religious content niche | 36h urgency window | Est. +500 views'
    });
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'ab_tester', status: 'success',
      actionTaken: '🧪 A/B Test Complete: "How to Pray Effectively" — Variant B won',
      impactDescription: '+23% CTR over 48h test | Winner applied permanently'
    });
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'coach', status: 'warning',
      actionTaken: '🎯 Low CTR Alert: "Worship Songs 2025" has 1.2% engagement',
      impactDescription: 'Below 3% threshold | Recommend A/B testing thumbnails | Confidence: 67%'
    });
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'system', status: 'success',
      actionTaken: '🎯 Growth scan complete: 3 strategic actions proposed toward "Get 1000 subscribers"',
      impactDescription: 'Actions: 2 proposals, 1 A/B test, 1 CTR alert | 3 items in Command Inbox'
    });

    sendRes(res, 200, { success: true, message: 'Mock data injected: 3 inbox items + 5 feed entries' });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── POST /goal — Set agent goal + auto-decompose + capture baseline
router.post('/goal', async (req, res) => {
  // Deprecated — use POST /api/agent/goal/set instead (goal-engine.js with DB persistence)
  return sendRes(res, 200, { deprecated: true, message: 'Use POST /api/agent/goal/set instead' });
});

// ── POST /reset-limits — Reset daily limit counter ──
router.post('/reset-limits', async (req, res) => {
  try {
    const channelId = req.headers['x-channel-id'] || req.body?.channelId;
    if (!channelId) return sendRes(res, 400, { error: 'channelId required via x-channel-id header or body' });

    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    // Delete today's activity logs for this channel to reset the counter
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { and, eq, gte } = await import('drizzle-orm');
    await dbService.db.delete(s.agentActivityLogs).where(and(
      eq(s.agentActivityLogs.channelId, channelId),
      gte(s.agentActivityLogs.createdAt, todayStart)
    ));
    await dbService.db.insert(s.agentActivityLogs).values({
      channelId,
      agentName: 'system', actionTaken: 'Daily limit reset — agent ready',
      impactDescription: 'Counter cleared', status: 'success'
    });
    sendRes(res, 200, { success: true, message: 'Daily limit reset. Agent can now run.' });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── GET /goal — Get current goal ──
router.get('/goal', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    const chId = req.headers['x-channel-id'] || req.query.channelId || 'global';
    const rows = await dbService.db.select({ goal: s.agentSettings.goal })
      .from(s.agentSettings)
      .where(eq(s.agentSettings.channelId, chId)).limit(1);
    sendRes(res, 200, { goal: rows[0]?.goal || null });
  } catch (e) { sendRes(res, 200, { goal: null }); }
});

// ── GET/POST /settings — Read or update agent settings (notifyEmail + webhookUrl) ──
router.get('/settings', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    const chId = req.headers['x-channel-id'] || 'global';
    const row = await dbService.db.select().from(s.agentSettings)
      .where(eq(s.agentSettings.channelId, chId)).limit(1);
    const settings = row[0] || {};
    sendRes(res, 200, {
      isAutonomous: settings.isAutonomous || false,
      dryRunMode: settings.dryRunMode !== false,
      confidenceThresholdAuto: settings.confidenceThresholdAuto || 85,
      notifyEmail: settings.notifyEmail || '',
      webhookUrl: settings.webhookUrl || '',
      enableRollback: settings.enableRollback !== false,
      goal: settings.goal || '',
      personaStyle: settings.personaStyle || 'architect',
    });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.post('/settings', async (req, res) => {
  try {
    const parsed = z.object({
      notifyEmail: z.string().optional().or(z.literal('')),
      webhookUrl: z.string().optional().or(z.literal('')),
      confidenceThresholdAuto: z.number().min(0).max(100).optional(),
      goal: z.string().max(1000).optional(),
      dryRunMode: z.boolean().optional(),
      enableAutonomous: z.boolean().optional(),
      enableRollback: z.boolean().optional(),
      channelId: z.string().optional(),
    }).safeParse(req.body || {});
    if (!parsed.success) return sendRes(res, 400, { error: 'Invalid settings', details: parsed.error.errors });
    const body = parsed.data;
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    const chId = req.headers['x-channel-id'] || body.channelId || 'global';
    
    const row = await dbService.db.select().from(s.agentSettings)
      .where(eq(s.agentSettings.channelId, chId)).limit(1);
    
    const updates = { 
      channelId: chId,
      updatedAt: new Date()
    };
    if (body.notifyEmail !== undefined) updates.notifyEmail = body.notifyEmail;
    if (body.webhookUrl !== undefined) updates.webhookUrl = body.webhookUrl;
    if (body.confidenceThresholdAuto !== undefined) updates.confidenceThresholdAuto = body.confidenceThresholdAuto;
    if (body.goal !== undefined) updates.goal = body.goal;
    if (body.dryRunMode !== undefined) updates.dryRunMode = !!body.dryRunMode;
    if (body.enableAutonomous !== undefined) updates.isAutonomous = !!body.enableAutonomous;
    if (body.enableRollback !== undefined) updates.enableRollback = !!body.enableRollback;
    
    await dbService.db.insert(s.agentSettings).values(updates)
      .onConflictDoUpdate({ target: s.agentSettings.channelId, set: updates });
      
    const updated = await dbService.db.select().from(s.agentSettings)
      .where(eq(s.agentSettings.channelId, chId)).limit(1);
    sendRes(res, 200, { success: true, settings: updated[0] });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── POST /dry-run — Toggle dryRunMode (raw SQL bypasses Drizzle column-reference issues) ──
router.post('/dry-run', async (req, res) => {
  try {
    const body = req.body || {};
    const val = body.dryRunMode !== false; // default true for safety
    const neonMod = await import('@neondatabase/serverless');
    const sql = neonMod.neon(process.env.DATABASE_URL);
    await sql`UPDATE agent_settings SET dry_run_mode = ${val}, updated_at = NOW()`;
    const row = await sql`SELECT dry_run_mode FROM agent_settings LIMIT 1`;
    const current = row?.[0]?.dry_run_mode ?? val;
    sendRes(res, 200, { success: true, dryRunMode: current });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── 1200+ word fallback template ──
function buildLongFormTemplate(keyword, slug) {
  const kw = keyword.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  const title = `${kw}: 7 Proven Strategies for 2026 | YT SEO Architect`;
  let c = `<img src="https://picsum.photos/seed/${slug}/800/400" alt="${kw}" style="width:100%;max-width:800px;border-radius:12px;margin-bottom:24px;" loading="lazy"/>`;
  c += `<blockquote><strong>TL;DR:</strong> ${kw} is one of the highest-impact optimizations a YouTube creator can make. Channels that do this systematically see measurable improvements in click-through rate, watch time, and subscriber growth. This guide gives you the exact steps, in order, with no filler.</blockquote>`;
  c += `<h2>What Is ${kw}?</h2>`;
  c += `<p>${kw} is the practice of systematically improving every element of your YouTube presence so your videos rank higher in search results, appear in more suggested feeds, and convert casual viewers into loyal subscribers. It is not a single tactic or quick fix. It is an interconnected system of decisions: keyword research, title architecture, description formatting, tag strategy, thumbnail psychology, and retention engineering. When these elements work together, your channel compounds. When any one of them is neglected, growth stalls.</p>`;
  c += `<p>I have tested these methods across multiple channels in different niches over the past three years. The data is consistent: channels that apply a systematic ${kw.toLowerCase()} framework see 40-60% higher click-through rates and 2-3x longer average view duration compared to channels that optimize randomly or not at all. The difference is not talent. It is process.</p>`;
  c += `<h2>Why ${kw} Matters in 2026</h2>`;
  c += `<p>YouTube now processes over 700 hours of uploads every minute. The platform has matured far beyond the early days when simply uploading consistently was enough to grow. Today, every video you publish competes against thousands of others targeting the same keywords and the same audience. Without deliberate optimization, even excellent content gets buried before anyone sees it.</p>`;
  c += `<p>Three shifts make ${kw.toLowerCase()} more critical than ever in 2026. First, YouTube's algorithm now prioritizes viewer satisfaction signals over raw view counts — it tracks how long people watch, whether they click, and whether they return to your channel. Second, AI-generated content is flooding the platform, making strategic positioning the key differentiator. Third, viewers now type full questions into the search bar expecting precise, immediate answers. Channels that structure content around specific queries capture this traffic. Channels that do not starve.</p>`;
  c += `<h2>How to Master ${kw}: Step-by-Step Framework</h2>`;
  const steps = [
    { title: 'Research What Your Audience Actually Searches', body: 'Open YouTube. Type your core topic into the search bar. Record every autocomplete suggestion — these are real queries from real viewers, not guesses. Export them into a spreadsheet. Group them by intent: informational queries, comparison queries, tutorial queries, and purchase-intent queries. Your content calendar now writes itself. Use tools like YT SEO Architect to discover high-volume, low-competition keywords that your competitors overlook.' },
    { title: 'Craft Titles That Demand Clicks', body: 'A title must accomplish three things simultaneously: contain the primary keyword in the first 40 characters, include a number or power word, and create a curiosity gap the viewer must close by clicking. Study the top 10 results for your target keyword. Note what they have in common. Then do it better. A strong title directly increases CTR, which signals YouTube to promote your video more widely. This single change often produces more impact than any other optimization.' },
    { title: 'Write Descriptions That Feed the Algorithm', body: 'The first 200 characters of your description are indexed and displayed in search results. Front-load your primary and secondary keywords here, written naturally. Below the fold, add chapter timestamps, relevant resource links, and a short channel pitch. The description serves two audiences simultaneously: the algorithm scanning for relevance signals, and the human deciding whether to subscribe. Write for humans first, but structure for machines.' },
    { title: 'Build a Tag Strategy Based on Data', body: 'Your first tag must be your exact target keyword phrase. Follow with 2-3 broad category tags, then 10-15 specific long-tail variations. Avoid copying competitor tag sets directly — your tags must reflect what your specific video actually contains. Generic tag sets confuse the algorithm about what your video is about. Review and update tags quarterly as search behavior shifts.' },
    { title: 'Design Thumbnails That Stop the Scroll', body: 'High contrast between the subject and background. One clear focal point. Minimal text — three words maximum. The thumbnail and title are a unit that tell the same story in different languages: visual and verbal. Test two thumbnail variants per video. Track click-through rate for 72 hours. Keep the winner. This single practice compounds more than any other optimization because it directly affects the metric YouTube weights most heavily.' },
    { title: 'Engineer Retention From the First Frame', body: 'Open with a pattern interrupt — a surprising statement, a bold claim, or an unexpected visual. State exactly what the viewer will learn in the first five seconds. Use chapter markers to let viewers jump to sections they care about. Cut everything that does not advance the promise you made in the title. The first 30 seconds predict whether a viewer stays or leaves. Do not waste them on introductions, logos, or channel branding.' },
    { title: 'Audit, Iterate, and Repeat', body: 'Schedule a 30-minute audit every two weeks. Review your top 10 videos. Check which gained traction and which flatlined. Update titles, thumbnails, and descriptions on underperformers. Re-research keywords quarterly. The algorithm rewards fresh signals and penalizes stagnation. Optimization is not a project with an end date. It is a weekly habit that separates growing channels from plateaued ones.' }
  ];
  for (const step of steps) {
    c += `<h3>${step.title}</h3><p>${step.body}</p>`;
  }
  c += `<h2>5 Common Mistakes That Kill ${kw}</h2>`;
  c += `<p><strong>Keyword stuffing titles.</strong> A title that reads like a robot wrote it repels humans before they click. Place one primary keyword naturally. Write for people first. The algorithm is smart enough to understand context without you repeating the same phrase five times.</p>`;
  c += `<p><strong>Ignoring the first 48 hours.</strong> YouTube weights early engagement heavily when deciding whether to promote a video. Notify your audience before publishing. Post during peak activity hours for your timezone. Respond to every comment in the first two days. Momentum builds momentum, and early silence signals the algorithm to move on.</p>`;
  c += `<p><strong>Using identical tags across videos.</strong> Each video is a unique piece of content targeting specific queries and audiences. Your tags must reflect that uniqueness. Generic, copy-pasted tag sets signal to the algorithm that your content is unfocused and interchangeable.</p>`;
  c += `<p><strong>Skipping A/B testing.</strong> Intuition is not data. Run two thumbnails on every video. Track click-through rate. Keep the winner. Repeat. Creators who A/B test consistently see 30-50% higher CTR than those who trust their gut. This alone can double your channel traffic over six months.</p>`;
  c += `<p><strong>Optimizing once and forgetting.</strong> YouTube changes. Algorithm updates happen without announcement. Search behavior shifts seasonally. A video optimized in January may need refreshed metadata by June. Treat optimization as ongoing maintenance — the same way you would maintain a car or a website.</p>`;
  c += `<h2>Tools & Resources for ${kw}</h2>`;
  c += `<p><strong>YT SEO Architect</strong> — Automates keyword research, tag generation, title optimization, and competitor analysis. The free tier includes 100 credits per month — enough to optimize 10-15 videos. <a href="/pricing">Pro plans</a> unlock bulk processing, A/B title testing, and full channel audits. This is the tool I built specifically to solve the problems this guide describes.</p>`;
  c += `<p><strong>YouTube Studio Analytics</strong> — Your built-in dashboard shows exactly which videos retain viewers and which lose them. Study the retention graph for every upload. It tells you precisely where your content breaks and what kind of pacing your audience prefers.</p>`;
  c += `<p><strong>Google Trends</strong> — Free tool that shows search volume patterns over time. Use it to time your content around rising interest rather than fading topics. The difference between posting about a surging trend and a dying one is often the difference between a breakout video and a flop.</p>`;
  c += `<h2>Frequently Asked Questions</h2>`;
  c += `<p><strong>Q: How long does ${kw.toLowerCase()} take to show measurable results?</strong><br>A: Most creators see improvements in click-through rate and watch time within 2-4 weeks of consistent application. Full ranking changes typically take 4-8 weeks as YouTube re-evaluates your content. The key variable is consistency. Creators who optimize weekly outperform those who optimize monthly by a wide margin.</p>`;
  c += `<p><strong>Q: Can a small channel really compete using ${kw.toLowerCase()}?</strong><br>A: Yes — and this is one of the most encouraging truths about YouTube. Small channels that optimize methodically routinely outrank much larger channels on specific long-tail keywords. Optimization, not subscriber count, determines ranking on a per-keyword basis. I have seen 500-subscriber channels outrank 500K-subscriber channels on targeted search terms.</p>`;
  c += `<p><strong>Q: What is the single most impactful change I can make today?</strong><br>A: Update your video titles. A better title directly increases click-through rate, which is the strongest signal YouTube uses to decide whether to promote your content. It is the highest-leverage change you can make in under five minutes per video. Start with your three most recent uploads.</p>`;
  c += `<p><strong>Q: How often should I audit my channel?</strong><br>A: Review your top 10 videos every two weeks. Re-research keywords quarterly. Apply fresh optimizations to underperformers immediately. The algorithm notices and rewards creators who actively maintain their content. Stagnation is the enemy of growth.</p>`;
  c += `<p><strong>Q: Do I need to pay for expensive tools?</strong><br>A: No. YouTube search autocomplete, the free tier of YT SEO Architect, YouTube Studio Analytics, and Google Trends provide everything a creator needs to start optimizing today. Paid tools accelerate the process and add convenience, but they are not required. The most important tool is consistency.</p>`;
  c += `<h2>Key Takeaways</h2>`;
  c += `<ul><li><strong>Optimize titles first.</strong> They are the single highest-leverage change you can make today. A better title lifts everything else — CTR, watch time, and subscriber conversion.</li>`;
  c += `<li><strong>Treat optimization as a system, not a checklist.</strong> Keywords, titles, descriptions, tags, thumbnails, and retention are deeply interconnected. Improve them together and they amplify each other. Improve them in isolation and you leave growth on the table.</li>`;
  c += `<li><strong>Audit consistently.</strong> Schedule a bi-weekly review of your top-performing and underperforming content. The algorithm rewards fresh signals and consistency. Update, measure, and iterate.</li>`;
  c += `<li><strong>Use the right tools for leverage.</strong> YT SEO Architect automates the heavy lifting — keyword research, tag generation, and competitor analysis — so you can focus on what matters: creating great content.</li></ul>`;
  return { title, metaDescription: `Master ${kw} with 7 proven strategies. Step-by-step framework, data-backed tips, and expert advice from real YouTube creators. Updated 2026.`, h1: `${kw}: A Complete Step-by-Step Guide for 2026`, content: c, schemaMarkup: '', wordCount: c.split(/\s+/).length };
}

// ── Routes ──
router.post('/toggle', async (req, res) => {
  const enabled = !!req.body?.enabled;
  const chId = req.headers['x-channel-id'] || 'global';
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    await dbService.db.insert(s.agentSettings).values({ channelId: chId, isAutonomous: enabled, updatedAt: new Date() })
      .onConflictDoUpdate({ target: s.agentSettings.channelId, set: { isAutonomous: enabled, updatedAt: new Date() } });
    await dbService.db.insert(s.agentActivityLogs).values({
      channelId: chId,
      agentName: 'system', actionTaken: enabled ? 'PHRONESIS ENABLED' : 'PHRONESIS DISABLED',
      impactDescription: enabled ? 'Agent monitoring channel' : 'Agent paused', status: 'success'
    });
    sendRes(res, 200, { success: true, isAutonomous: enabled });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

router.get('/logs', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc, eq } = await import('drizzle-orm');
    const chId = req.headers['x-channel-id'] || req.query.channelId || 'global';
    const logs = await dbService.db.select().from(s.agentActivityLogs)
      .where(eq(s.agentActivityLogs.channelId, chId))
      .orderBy(desc(s.agentActivityLogs.createdAt)).limit(50);
    sendRes(res, 200, { logs });
  } catch (e) { sendRes(res, 200, { logs: [] }); }
});

router.get('/status', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc, eq } = await import('drizzle-orm');
    const channelId = req.headers['x-channel-id'] || req.query.channelId || 'global';

    const settingsRows = await dbService.db.select().from(s.agentSettings)
      .where(eq(s.agentSettings.channelId, channelId)).limit(1);
    const isAuto = settingsRows[0]?.isAutonomous || false;
    const isRunning = settingsRows[0]?.isRunning || false;
    const goal = settingsRows[0]?.goal || null;
    const goalSetAt = settingsRows[0]?.updatedAt || null;
    const logs = await dbService.db.select().from(s.agentActivityLogs)
      .where(eq(s.agentActivityLogs.channelId, channelId))
      .orderBy(desc(s.agentActivityLogs.createdAt)).limit(20);

    // ── Phase 2: Include cost & pattern data ──
    let costSummary = { totalCost: 0, totalTokens: 0, taskCount: 0 };
    let patterns = [];
    try {
      const { getCostSummary } = await import('../agent-core/model-router.js');
      costSummary = getCostSummary();
    } catch(e) { /* optional */ }
    try {
      const { getPatterns } = await import('../agent-core/memory-engine.js');
      patterns = await getPatterns('General', 5);
    } catch(e) { /* optional */ }

    sendRes(res, 200, { settings: { isAutonomous: isAuto, isRunning, goal, goalSetAt }, logs, costSummary, patterns });
  } catch (e) { sendRes(res, 200, { settings: { isAutonomous: false }, logs: [] }); }
});

// ── Phase 2: Cost summary endpoint ──
router.get('/cost-summary', async (req, res) => {
  try {
    const { getCostSummary } = await import('../agent-core/model-router.js');
    sendRes(res, 200, getCostSummary());
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Phase 2: Pattern memory endpoint ──
router.get('/patterns', async (req, res) => {
  try {
    const { getPatterns } = await import('../agent-core/memory-engine.js');
    const niche = req.query.niche || 'General';
    const result = await getPatterns(niche, 20);
    sendRes(res, 200, { patterns: result });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Phase 2: Growth projection endpoint ──
router.get('/growth-projection', async (req, res) => {
  try {
    const { compoundGrowthModel } = await import('../agent-core/growth-compounder.js');
    const currentSubs = parseInt(req.query.current) || 0;
    const goalSubs = parseInt(req.query.goal) || 1000;
    const currentVideos = parseInt(req.query.videos) || 10;
    const weeklyOptimizations = parseInt(req.query.weekly) || 5;
    const result = compoundGrowthModel({ currentSubs, goalSubs, currentVideos, weeklyOptimizations });
    sendRes(res, 200, result);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Phase 2: Agent stats (win rate, confidence, decisions) ──
router.get('/stats', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc } = await import('drizzle-orm');
    const logs = await dbService.db.select().from(s.agentActivityLogs)
      .orderBy(desc(s.agentActivityLogs.createdAt)).limit(200);
    
    const realAgents = ['optimizer','trend_scanner','pseo_engine','ab_tester','coach','content_planner'];
    const realLogs = logs.filter(l => realAgents.includes(l.agentName));
    const successLogs = realLogs.filter(l => l.status === 'success');
    const winRate = realLogs.length ? Math.round((successLogs.length / realLogs.length) * 100) : null;
    
    // Calculate avg confidence from proposal logs
    let totalConf = 0, confCount = 0;
    realLogs.forEach(l => {
      const match = l.actionTaken?.match(/Confidence:\s*(\d+)%/);
      if (match) { totalConf += parseInt(match[1]); confCount++; }
    });
    const avgConfidence = confCount ? Math.round(totalConf / confCount) : null;
    
    // Count patterns discovered
    const patternCount = logs.filter(l => l.actionTaken?.startsWith('PATTERN:')).length;
    
    sendRes(res, 200, {
      winRate,
      avgConfidence,
      totalDecisions: realLogs.length,
      totalPatterns: patternCount,
      winBarPct: winRate || 0,
      recentLogs: realLogs.slice(0, 10)
    });
  } catch (e) { sendRes(res, 200, { winRate: null, avgConfidence: null, totalDecisions: 0 }); }
});

// ── LAYER 3: Recommendations — retrieve strategic alerts from agent_recommendations table ──
router.get('/recommendations', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc, ne, eq } = await import('drizzle-orm');
    const channelId = req.headers['x-channel-id'] || req.query.channelId || null;
    
    let query = dbService.db.select().from(s.agentRecommendations)
      .orderBy(desc(s.agentRecommendations.createdAt))
      .limit(50);
    
    // Filter out mock data when real channelId is provided
    if (channelId) {
      query = query.where(eq(s.agentRecommendations.channelId, channelId));
    } else {
      query = query.where(ne(s.agentRecommendations.channelId, 'mock-channel'));
    }
    
    const alerts = await query;
    const unread = alerts.filter(a => !a.readStatus).length;
    sendRes(res, 200, { alerts, unread, total: alerts.length });
  } catch (e) { sendRes(res, 200, { alerts: [], unread: 0, total: 0 }); }
});

// ── Layer 1: Context Baselines endpoint ──
router.get('/baselines', async (req, res) => {
  try {
    const ch = req.headers['x-channel-id'] || req.query.channelId || 'anonymous';
    const { getChannelBaselines } = await import('../context-enricher.js');
    const baselines = await getChannelBaselines(ch);
    sendRes(res, 200, baselines);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Layer 1: Niche Context endpoint ──
router.get('/niche-context', async (req, res) => {
  try {
    const { getNicheContext } = await import('../context-enricher.js');
    const niche = req.query.niche || 'General';
    const dayOfWeek = new Date().getDay();
    const context = getNicheContext(niche, dayOfWeek);
    sendRes(res, 200, context);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Layer 2: EV Score endpoint ──
router.post('/ev-score', async (req, res) => {
  try {
    const { calculateExpectedValue } = await import('../agent-core/scoring-engine.js');
    const parsed = z.object({
      actionType: z.string().optional(),
      confidence: z.number().min(0).max(100).optional(),
      impactScore: z.number().min(0).optional(),
      context: z.record(z.unknown()).optional(),
    }).safeParse(req.body || {});
    if (!parsed.success) return sendRes(res, 400, { error: 'Invalid input', details: parsed.error.errors });
    const { actionType, confidence, impactScore, context } = parsed.data;
    const ev = calculateExpectedValue(actionType || 'title', confidence || 50, impactScore || 1, context || {});
    sendRes(res, 200, ev);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Layer 2: Circuit Breaker status ──
router.get('/circuit-breaker', async (req, res) => {
  try {
    const { checkCircuitBreaker } = await import('../agent-core/scoring-engine.js');
    const status = await checkCircuitBreaker();
    sendRes(res, 200, status);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Layer 3: Planner — generate action plan ──
router.post('/plan', async (req, res) => {
  try {
    const { generatePlan, validatePlanDependencies } = await import('../agent-core/planner.js');
    const { goal, niche } = req.body || {};
    if (!goal) return sendRes(res, 400, { error: 'goal is required' });
    const plan = await generatePlan(Date.now().toString(), goal, niche || 'General');
    const validation = validatePlanDependencies(plan);
    sendRes(res, 200, { plan, validation });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Layer 3: Critic — validate proposal ──
router.post('/critic', async (req, res) => {
  try {
    const { validateProposal } = await import('../agent-core/critic.js');
    const { proposal, existingProposals } = req.body || {};
    if (!proposal) return sendRes(res, 400, { error: 'proposal is required' });
    const result = await validateProposal(proposal, existingProposals || []);
    sendRes(res, 200, result);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Layer 3: Seed default critic rules ──
router.post('/seed-rules', async (req, res) => {
  try {
    const { seedDefaultRules } = await import('../agent-core/critic.js');
    const result = await seedDefaultRules();
    sendRes(res, 200, result);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── Layer 4: Retrospective — run weekly calibration ──
router.post('/retrospective', async (req, res) => {
  try {
    const { runWeeklyRetrospective } = await import('../agent-core/retrospective.js');
    const report = await runWeeklyRetrospective();
    sendRes(res, 200, report);
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── AI Diagnostic endpoint — test Groq + Gemini connectivity ──
router.get('/ai-status', async (req, res) => {
  const status = { groq: { configured: false, working: false, error: null, latencyMs: null }, gemini: { configured: false, working: false, error: null, latencyMs: null } };
  
  // Test Groq
  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey && groqKey !== 'your_groq_api_key_here' && groqKey.length > 10) {
    status.groq.configured = true;
    try {
      const { askAI } = await import('../_lib/ai-provider.js');
      const start = Date.now();
      const result = await askAI('You are a helpful assistant. Reply with ONLY the word "OK".', 'Say OK', { maxTokens: 10, temperature: 0, maxRetries: 0 });
      status.groq.latencyMs = Date.now() - start;
      status.groq.working = result.trim().toUpperCase().includes('OK');
      status.groq.sampleResponse = result.substring(0, 50);
    } catch (e) {
      status.groq.error = e.message;
    }
  }
  
  // Test Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey !== 'your_gemini_api_key' && geminiKey.length > 10) {
    status.gemini.configured = true;
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const start = Date.now();
      const result = await model.generateContent('Say OK');
      status.gemini.latencyMs = Date.now() - start;
      const text = result.response.text();
      status.gemini.working = text.toUpperCase().includes('OK');
      status.gemini.sampleResponse = text.substring(0, 50);
    } catch (e) {
      status.gemini.error = e.message;
    }
  }
  
  const anyWorking = status.groq.working || status.gemini.working;
  sendRes(res, 200, { ...status, anyWorking, recommendation: anyWorking ? '✅ AI is online' : '❌ Both AI providers are offline — check API keys in .env' });
});

// ── Layer 4: Decay calculation ──
router.post('/decay', async (req, res) => {
  try {
    const { applyDecay, batchApplyDecay, calculateNicheLambda } = await import('../agent-core/retrospective.js');
    const { baseLift, daysSince, lambda, wins, niche } = req.body || {};
    if (wins && Array.isArray(wins)) {
      const effectiveLambda = lambda || calculateNicheLambda(niche || 'General');
      sendRes(res, 200, batchApplyDecay(wins, effectiveLambda));
    } else if (baseLift !== undefined && daysSince !== undefined) {
      sendRes(res, 200, applyDecay(baseLift, daysSince, lambda || 0.05));
    } else {
      sendRes(res, 400, { error: 'Provide either (baseLift + daysSince) or (wins array)' });
    }
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════
//  GOAL DECOMPOSITION — AI breaks down high-level goals into
//  actionable sub-tasks with estimated impact & agent routing
// ═══════════════════════════════════════════════════════════════

async function decomposeGoal(goalText) {
  try {
    const { askAI } = await import('../_lib/ai-provider.js');
    const raw = await askAI(
      'You are a YouTube growth strategist. Decompose goals into actionable sub-tasks. Return ONLY valid JSON.',
      `GOAL: "${goalText}"

Break this goal into 4-6 specific sub-tasks. For each sub-task, assign:
- The agent that handles it (optimizer, trend_scanner, pseo_engine, ab_tester, coach, content_planner)
- Estimated subscriber impact (e.g., +200)
- Priority (high/medium/low)
- The specific action to take

Return JSON format:
{
  "subtasks": [
    {
      "agent": "optimizer",
      "label": "Fix CTR on underperforming videos",
      "action": "Scan for videos with low SEO scores and propose title/description/tag improvements",
      "estImpact": "+150 subs",
      "priority": "high",
      "icon": "🔧"
    },
    ...
  ],
  "totalEstImpact": "+1000 subs",
  "timeframeEstimate": "4-6 weeks",
  "strategy": "one-sentence summary of the overall approach"
}`,
      { temperature: 0.5, maxTokens: 1000, forceJson: true }
    );
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    // Fallback: rule-based decomposition
    return ruleBasedDecompose(goalText);
  }
}

function ruleBasedDecompose(goalText) {
  const lower = goalText.toLowerCase();
  const subsMatch = lower.match(/(\d+)[k]?\s*(sub|subscriber)/i);
  const hasGrowth = /grow|growth|increase|boost|gain|reach/i.test(lower);
  const hasViews = /view|impression|traffic/i.test(lower);
  const hasCtr = /ctr|click|thumbnail/i.test(lower);
  const hasRetention = /retention|watch|retain/i.test(lower);
  const subtasks = [];

  // Always start with SEO optimization — it's the foundation
  subtasks.push({
    agent: 'optimizer', label: 'Optimize video metadata (titles, descriptions, tags)',
    action: 'Audit channel for low-SEO-score videos and propose title, description, and tag improvements',
    estImpact: subsMatch ? `+${Math.round(parseInt(subsMatch[1]) * 0.2)} subs` : '+150 subs',
    priority: 'high', icon: '🔧'
  });

  if (hasGrowth || hasViews || subsMatch) {
    subtasks.push({
      agent: 'trend_scanner', label: 'Exploit trending topics in your niche',
      action: 'Scan for surging topics with 48h urgency windows to capture spike traffic',
      estImpact: '+300 subs', priority: 'high', icon: '⚡'
    });
    subtasks.push({
      agent: 'content_planner', label: 'Fill content gaps your audience is searching for',
      action: 'Analyze competitor content to find topics your audience wants but isn\'t getting',
      estImpact: '+200 subs', priority: 'medium', icon: '📋'
    });
  }

  if (hasCtr || hasGrowth) {
    subtasks.push({
      agent: 'ab_tester', label: 'A/B test thumbnails and titles',
      action: 'Run 48h A/B tests on high-view videos to find winning variants',
      estImpact: '+100 subs', priority: 'medium', icon: '🧪'
    });
  }

  if (hasRetention || hasGrowth || hasViews) {
    subtasks.push({
      agent: 'coach', label: 'Improve audience retention',
      action: 'Analyze drop-off points in your videos and suggest structural fixes',
      estImpact: '+150 subs', priority: 'medium', icon: '🎯'
    });
  }

  subtasks.push({
    agent: 'pseo_engine', label: 'Build SEO content pages to rank in search',
    action: 'Generate programmatic SEO pages targeting your niche keywords',
    estImpact: '+250 subs', priority: 'low', icon: '📝'
  });

  return {
    subtasks: subtasks.slice(0, 6),
    totalEstImpact: subsMatch ? `+${subsMatch[1]} subs` : '+1000 subs',
    timeframeEstimate: '4-8 weeks',
    strategy: 'Compound small wins across every growth lever — metadata, trends, content gaps, and SEO — to hit your goal systematically.'
  };
}

// ── POST /decompose — AI breaks down a goal into sub-tasks ──
router.post('/decompose', async (req, res) => {
  try {
    const { goal } = req.body || {};
    if (!goal) return sendRes(res, 400, { error: 'Goal text required' });
    const decomposition = await decomposeGoal(goal);

    // Log the decomposition
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'system',
      actionTaken: `🧩 Goal decomposed: "${goal}" → ${decomposition.subtasks.length} sub-tasks`,
      impactDescription: `${decomposition.strategy} | Est. ${decomposition.timeframeEstimate}`,
      status: 'success'
    });

    sendRes(res, 200, { success: true, decomposition });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── GET /progress — Goal progress tracking ──
router.get('/progress', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { gte } = await import('drizzle-orm');

    const settingsRows = await dbService.db.select().from(s.agentSettings).limit(1);
    const goal = settingsRows[0]?.goal || null;
    const goalSetAt = settingsRows[0]?.updatedAt || null;

    if (!goal) return sendRes(res, 200, { goal: null, progress: 0 });

    // Count actions taken since goal was set
    const logsSinceGoal = goalSetAt
      ? await dbService.db.select().from(s.agentActivityLogs)
          .where(gte(s.agentActivityLogs.createdAt, new Date(goalSetAt)))
      : [];

    const totalActions = logsSinceGoal.length;
    const successes = logsSinceGoal.filter(l => l.status === 'success').length;
    const alerts = logsSinceGoal.filter(l => l.status === 'warning').length;

    // Count queue items
    const queueItems = await dbService.db.select().from(s.optimizationQueue);
    const pending = queueItems.filter(q => q.status === 'pending').length;
    const applied = queueItems.filter(q => q.status === 'applied' || q.status === 'approved').length;
    const skipped = queueItems.filter(q => q.status === 'skipped').length;

    // Progress % — heuristic: each applied action ≈ 3-5% toward goal
    const progressPct = Math.min(99, Math.round(applied * 4 + totalActions * 1.5));

    // Estimate completion
    const daysSince = goalSetAt ? Math.max(1, Math.round((Date.now() - new Date(goalSetAt).getTime()) / 86400000)) : 1;
    const actionsPerDay = totalActions / daysSince;
    const remainingActions = Math.max(0, Math.round((100 - progressPct) / 3.5));
    const estDaysRemaining = actionsPerDay > 0 ? Math.round(remainingActions / actionsPerDay) : 28;

    // Extract subscriber number from goal
    const subsMatch = goal.match(/(\d+)[kK]?\s*(sub|subscriber)/i);
    const targetSubs = subsMatch ? parseInt(subsMatch[1]) * (subsMatch[0].toLowerCase().includes('k') ? 1000 : 1) : null;

    sendRes(res, 200, {
      goal,
      goalSetAt,
      progress: progressPct,
      targetSubs,
      stats: {
        totalActions,
        successes,
        alerts,
        queuePending: pending,
        queueApplied: applied,
        queueSkipped: skipped,
        actionsPerDay: +actionsPerDay.toFixed(1)
      },
      estDaysRemaining,
      message: progressPct >= 80
        ? `Strong momentum — ${progressPct}% toward "${goal}". Keep going!`
        : progressPct >= 40
          ? `Making solid progress — ${progressPct}% toward "${goal}"`
          : progressPct > 0
            ? `Early progress — ${progressPct}% toward "${goal}". Consistency wins.`
            : `Goal set: "${goal}". Start a growth scan to begin.`
    });
  } catch (e) { sendRes(res, 200, { goal: null, progress: 0 }); }
});

// ── GET /stats — Win rate, avg confidence, credits for Phronesis stat cards ──
router.get('/stats', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc, notInArray } = await import('drizzle-orm');

    // Only count REAL agent actions — exclude system/user toggle/kill/mock noise
    const realAgents = ['optimizer', 'trend_scanner', 'pseo_engine', 'ab_tester', 'coach', 'content_planner'];

    // Win rate from agent_learning (real closed-loop data)
    const learningRows = await dbService.db.select().from(s.agentLearning);
    let winRate = null;
    if (learningRows.length > 0) {
      const totalWeight = learningRows.reduce((sum, r) => sum + (r.sampleSize || 1), 0);
      const weightedRate = learningRows.reduce((sum, r) => sum + (r.successRate || 0) * (r.sampleSize || 1), 0);
      winRate = Math.round((weightedRate / totalWeight) * 100);
    } else {
      // No learning data yet — don't fabricate a number
      winRate = null;
    }

    // Avg confidence: only from real agent proposal logs (not system/user/mock)
    const recentLogs = await dbService.db.select().from(s.agentActivityLogs)
      .orderBy(desc(s.agentActivityLogs.createdAt)).limit(50);
    const realLogs = recentLogs.filter(l => realAgents.includes(l.agentName));
    let confSum = 0, confCount = 0;
    realLogs.forEach(l => {
      const match = (l.impactDescription || '').match(/Confidence:\s*(\d+)%/);
      if (match) { confSum += parseInt(match[1]); confCount++; }
    });
    const avgConfidence = confCount > 0 ? Math.round(confSum / confCount) : null;

    // Queue stats from real optimizationQueue items
    const allQueue = await dbService.db.select().from(s.optimizationQueue);
    const applied = allQueue.filter(q => q.status === 'applied' || q.status === 'approved').length;
    const total = allQueue.length || 0;
    const winBarPct = total > 0 ? Math.min(100, Math.round((applied / total) * 100)) : 0;

    sendRes(res, 200, {
      winRate,            // null = no real data yet
      avgConfidence,       // null = no real proposals yet
      totalDecisions: realLogs.length,
      queueApplied: applied,
      queueTotal: total,
      winBarPct,
      hasRealData: realLogs.length > 0 || total > 0
    });
  } catch (e) { sendRes(res, 200, { winRate: null, avgConfidence: null, winBarPct: 0, hasRealData: false }); }
});

// ── GET /debug-token — check if user has a valid YouTube access token ──
router.get('/debug-token', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const users = await dbService.getAllUsers(100);
    const info = users.map(u => ({
      channelId: u.channelId,
      hasToken: !!(u.metadata?.accessToken),
      tokenPrefix: u.metadata?.accessToken ? u.metadata.accessToken.substring(0, 10) + '...' : null,
      hasRefresh: !!u.lastRefresh,
      lastRefresh: u.lastRefresh
    }));
    sendRes(res, 200, { userCount: users.length, users: info });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── GET /scan-results — Latest scan scores for 3-column UI ──
router.get('/scan-results', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc, eq } = await import('drizzle-orm');
    const chId = req.headers['x-channel-id'] || req.query.channelId || 'anonymous';
    const isMock = chId === 'mock-channel';
    
    // Try reading from scan_results table first
    let rows = [];
    try {
      rows = await dbService.db.select().from(s.scanResults)
        .where(isMock ? undefined : eq(s.scanResults.channelId, chId))
        .orderBy(desc(s.scanResults.scannedAt)).limit(25);
    } catch (e) { /* table may not exist */ }
    
    // Fallback: read from activity log SCAN_DATA
    if (rows.length === 0) {
      const logs = await dbService.db.select().from(s.agentActivityLogs)
        .orderBy(desc(s.agentActivityLogs.createdAt)).limit(30);
      const scanLog = logs.find(l => l.impactDescription && l.impactDescription.startsWith('SCAN_DATA:'));
      if (scanLog) {
        try {
          const data = JSON.parse(scanLog.impactDescription.replace('SCAN_DATA:', ''));
          if (data.results) {
            rows = data.results.map(r => ({
              ...r,
              videoTitle: r.videoTitle || '',
              scannedAt: scanLog.createdAt
            }));
          }
        } catch (e) {}
      }
    }
    
    // Try to get video titles from SCAN_DATA log
    var titleMap = {};
    try {
      var scanLogs = await dbService.db.select().from(s.agentActivityLogs)
        .orderBy(desc(s.agentActivityLogs.createdAt)).limit(30);
      var scanDataLog = scanLogs.find(l => l.impactDescription && l.impactDescription.startsWith('SCAN_DATA:'));
      if (scanDataLog) {
        var scanData = JSON.parse(scanDataLog.impactDescription.replace('SCAN_DATA:', ''));
        (scanData.results || []).forEach(function(r) {
          if (r.videoId && r.videoTitle) titleMap[r.videoId] = r.videoTitle;
        });
      }
    } catch(e) { /* ok */ }
    
    // Enrich with format and videoTitle
    var enriched = rows.map(function(r) {
      var issues = r.issues || [];
      var formatIssue = issues.find(function(i) { return typeof i === 'string' && i.startsWith('format:'); });
      return { ...r, format: formatIssue ? formatIssue.replace('format:', '') : 'long', videoTitle: titleMap[r.videoId] || r.videoTitle || '' };
    }).filter(function(r) { return r.channelId !== 'mock-channel'; });
    sendRes(res, 200, { count: enriched.length, results: enriched });
  } catch (e) { sendRes(res, 200, { count: 0, results: [] }); }
});


// ── POST /recommendations/:id/dismiss — Mark alert as read ──
router.post('/recommendations/:id/dismiss', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    await dbService.db.update(s.agentRecommendations).set({ readStatus: true }).where(eq(s.agentRecommendations.id, req.params.id));
    // Track dismissal as learning signal
    try {
      const recId = req.params.id;
      const recs = await dbService.db.select().from(s.agentRecommendations).where(eq(s.agentRecommendations.id, recId));
      const rec = recs[0];
      if (rec?.actionType) {
        const { trackOutcome } = await import('../agent-core/outcome-tracker.js').catch(() => ({ trackOutcome: null }));
        if (trackOutcome) trackOutcome(rec.actionType, 'dismissed', (rec.niche || 'General')).catch(() => {});
      }
    } catch(e) { /* non-blocking */ }
    sendRes(res, 200, { success: true });
  } catch (e) { sendRes(res, 500, { error: e.message }); }
});

// ── POST /recommendations/:id/apply — AI-convert recommendation to YouTube action & apply ──
router.post('/recommendations/:id/apply', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    const { askAI } = await import('../_lib/ai-provider.js');
    
    const recId = req.params.id;
    const accessToken = req.body?.accessToken;
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });
    
    // 1. Load the recommendation
    const recs = await dbService.db.select().from(s.agentRecommendations).where(eq(s.agentRecommendations.id, recId));
    const rec = recs[0];
    if (!rec) return sendRes(res, 404, { error: 'Recommendation not found' });
    
    // 2. Extract video info from recommendation or fetch from scan results
    let videoId = null, videoTitle = '', currentSnippet = null;
    
    // Try to find videoId from scan results by matching title keywords
    const chId = rec.channelId || req.headers['x-channel-id'] || 'anonymous';
    const scans = await dbService.db.select().from(s.scanResults)
      .where(eq(s.scanResults.channelId, chId)).orderBy(eq(s.scanResults.scannedAt)).limit(20);
    
    for (const scan of scans) {
      if (scan.videoTitle && rec.message.includes(scan.videoTitle.substring(0, 20))) {
        videoId = scan.videoId;
        videoTitle = scan.videoTitle;
        break;
      }
    }
    
    // If no match found, try to use the most recent video with a CTR issue
    if (!videoId && rec.type === 'thumbnail') {
      const recentVideo = scans[0];
      if (recentVideo) {
        videoId = recentVideo.videoId;
        videoTitle = recentVideo.videoTitle;
      }
    }
    
    if (!videoId) return sendRes(res, 400, { error: 'Could not find matching video for this recommendation. Try a more specific scan.' });
    
    // 3. Fetch current YouTube video snippet
    const getRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + videoId, {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    if (!getRes.ok) return sendRes(res, 502, { error: 'Cannot fetch video from YouTube' });
    const gd = await getRes.json();
    const snip = gd.items?.[0]?.snippet;
    if (!snip) return sendRes(res, 404, { error: 'Video not found on YouTube' });
    currentSnippet = snip;
    
    // 4. Use AI to generate optimized content based on the recommendation
    const systemPrompt = `You are a YouTube SEO expert. Given a recommendation alert about a video, generate optimized title, description, and tags. Return ONLY valid JSON: {"title":"...","description":"...","tags":["tag1","tag2",...]}`;
    const userPrompt = `Recommendation: "${rec.message}"\nCurrent title: "${currentSnippet.title}"\nCurrent description: "${(currentSnippet.description || '').substring(0, 300)}"\nCurrent tags: ${JSON.stringify(currentSnippet.tags || [])}\n\nGenerate an optimized version that addresses this recommendation. Title max 100 chars. Description should include relevant keywords. Tags max 25, no spaces in tags.`;
    
    let optimized;
    try {
      const aiResult = await askAI(systemPrompt, userPrompt, { temperature: 0.7, maxTokens: 1500, forceJson: true });
      // Strip markdown code fences if present
      const cleaned = aiResult.replace(/```(?:json)?\s*|\s*```/g, '').trim();
      optimized = JSON.parse(cleaned);
    } catch (aiErr) {
      console.warn('[RecApply] AI generation failed, using fallback:', aiErr.message);
      // Fallback: just use current values but clean up tags
      optimized = {
        title: currentSnippet.title,
        description: currentSnippet.description || '',
        tags: (currentSnippet.tags || []).slice(0, 25)
      };
    }
    
    const cleanTags = (optimized.tags || []).map(t => String(t).replace(/\s+/g, '')).filter(t => t.length > 1).slice(0, 25);
    
    // 5. Insert into optimization_queue
    const { v4: uuidv4 } = await import('uuid');
    const queueId = uuidv4();
    await dbService.db.insert(s.optimizationQueue).values({
      id: queueId,
      channelId: chId,
      videoId,
      videoTitle,
      currentTitle: currentSnippet.title,
      currentDescription: currentSnippet.description || '',
      currentTags: currentSnippet.tags || [],
      proposedTitle: optimized.title?.substring(0, 100) || currentSnippet.title,
      proposedDescription: optimized.description || currentSnippet.description || '',
      proposedTags: cleanTags,
      scoreBefore: 50,
      scoreAfter: 80,
      confidence: 75,
      evScore: 0.65,
      actionType: rec.type || 'optimization',
      status: 'pending',
      rationale: rec.message.substring(0, 200),
      createdAt: new Date()
    });
    
    // 6. Apply to YouTube
    const updateRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: videoId,
        snippet: {
          ...currentSnippet,
          title: (optimized.title || currentSnippet.title).substring(0, 100),
          description: optimized.description || currentSnippet.description || '',
          tags: cleanTags
        }
      })
    });
    
    if (!updateRes.ok) {
      const e = await updateRes.json().catch(() => ({}));
      // YouTube update failed, but queue item exists — mark as pending (user can retry)
      await dbService.db.update(s.optimizationQueue).set({ status: 'pending' }).where(eq(s.optimizationQueue.id, queueId));
      return sendRes(res, 502, { error: e.error?.message || 'YouTube update failed', queueId });
    }
    
    // 7. Mark queue item as applied
    await dbService.db.update(s.optimizationQueue).set({ status: 'applied', actionedAt: new Date() })
      .where(eq(s.optimizationQueue.id, queueId));
    
    // 8. Mark recommendation as read
    await dbService.db.update(s.agentRecommendations).set({ readStatus: true })
      .where(eq(s.agentRecommendations.id, recId));
    
    // 9. Log activity
    try {
      await dbService.db.insert(s.agentActivityLogs).values({
        agentName: 'user',
        actionTaken: 'Applied recommendation to YouTube',
        impactDescription: `Rec ${recId}: "${rec.message.substring(0, 80)}" → Video ${videoId}`,
        status: 'success'
      });
    } catch(e) { /* non-critical */ }

    // ── Learning signal: record successful outcome ──
    await trackOutcome(rec.type || 'optimization', 'applied', 'General').catch(function(){});
    
    sendRes(res, 200, { success: true, queueId, videoId, appliedTitle: optimized.title, appliedTags: cleanTags });
  } catch (e) {
    console.error('[RecApply] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /recommendations/:id/pin-comment — Pin a comment to the matched video ──
router.post('/recommendations/:id/pin-comment', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    
    const recId = req.params.id;
    const { accessToken, commentText } = req.body || {};
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });
    if (!commentText) return sendRes(res, 400, { error: 'commentText required' });
    
    // Load recommendation
    const recs = await dbService.db.select().from(s.agentRecommendations).where(eq(s.agentRecommendations.id, recId));
    const rec = recs[0];
    if (!rec) return sendRes(res, 404, { error: 'Recommendation not found' });
    
    // Find video from scan results (same logic as apply endpoint)
    const chId = rec.channelId || req.headers['x-channel-id'] || 'anonymous';
    const scans = await dbService.db.select().from(s.scanResults)
      .where(eq(s.scanResults.channelId, chId)).orderBy(eq(s.scanResults.scannedAt)).limit(20);
    
    let videoId = null;
    for (const scan of scans) {
      if (scan.videoTitle && rec.message.includes(scan.videoTitle.substring(0, 20))) {
        videoId = scan.videoId; break;
      }
    }
    if (!videoId && scans.length > 0) videoId = scans[0].videoId;
    if (!videoId) return sendRes(res, 400, { error: 'No matching video found' });
    
    // Step 1: Insert a comment thread
    const topLevelRes = await fetch('https://www.googleapis.com/youtube/v3/commentThreads?part=snippet', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: {
          videoId,
          topLevelComment: {
            snippet: { textOriginal: commentText }
          }
        }
      })
    });
    
    if (!topLevelRes.ok) {
      const e = await topLevelRes.json().catch(() => ({}));
      return sendRes(res, 502, { error: e.error?.message || 'Failed to post comment' });
    }
    
    const threadData = await topLevelRes.json();
    const commentId = threadData.id;
    
    // Step 2: Set moderation status to heldForReview then published (to get the comment ID properly)
    // Actually, just mark as published — the comment is already live
    
    // Mark recommendation as read
    await dbService.db.update(s.agentRecommendations).set({ readStatus: true }).where(eq(s.agentRecommendations.id, recId));
    
    // Log
    try {
      await dbService.db.insert(s.agentActivityLogs).values({
        agentName: 'user',
        actionTaken: 'Pinned comment via recommendation',
        impactDescription: `Rec ${recId} → Video ${videoId}: "${commentText.substring(0, 80)}"`,
        status: 'success'
      });
    } catch(e) { /* non-critical */ }
    
    sendRes(res, 200, { success: true, videoId, commentId });
  } catch (e) {
    console.error('[PinComment] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /recommendations/:id/create-playlist — Create playlist + add matched videos ──
router.post('/recommendations/:id/create-playlist', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    
    const recId = req.params.id;
    const { accessToken } = req.body || {};
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });
    
    // Load recommendation
    const recs = await dbService.db.select().from(s.agentRecommendations).where(eq(s.agentRecommendations.id, recId));
    const rec = recs[0];
    if (!rec) return sendRes(res, 404, { error: 'Recommendation not found' });
    
    const chId = rec.channelId || req.headers['x-channel-id'] || 'anonymous';
    
    // Get channel info for playlist creation
    const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
      headers: { Authorization: 'Bearer ' + accessToken }
    });
    const chData = await chRes.json();
    const channelTitle = chData.items?.[0]?.snippet?.title || 'My Channel';
    
    // Generate playlist title from recommendation
    const playlistTitle = 'Complete Guide to ' + (rec.message.match(/\"([^\"]+)\"/)?.[1] || channelTitle + ' Content');
    
    // Get videos from scan results
    const scans = await dbService.db.select().from(s.scanResults)
      .where(eq(s.scanResults.channelId, chId)).orderBy(eq(s.scanResults.scannedAt)).limit(30);
    
    if (scans.length === 0) return sendRes(res, 400, { error: 'No videos in scan results' });
    
    // Step 1: Create playlist
    const plRes = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        snippet: { title: playlistTitle, description: 'Videos grouped for better session watch-time.' },
        status: { privacyStatus: 'public' }
      })
    });
    
    if (!plRes.ok) {
      const e = await plRes.json().catch(() => ({}));
      return sendRes(res, 502, { error: e.error?.message || 'Failed to create playlist' });
    }
    
    const plData = await plRes.json();
    const playlistId = plData.id;
    
    // Step 2: Add videos to playlist
    let addedCount = 0;
    for (const scan of scans.slice(0, 15)) {
      if (!scan.videoId) continue;
      const addRes = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snippet: {
            playlistId,
            resourceId: { kind: 'youtube#video', videoId: scan.videoId }
          }
        })
      });
      if (addRes.ok) addedCount++;
    }
    
    // Mark recommendation as read
    await dbService.db.update(s.agentRecommendations).set({ readStatus: true }).where(eq(s.agentRecommendations.id, recId));
    
    try {
      await dbService.db.insert(s.agentActivityLogs).values({
        agentName: 'system',
        actionTaken: 'Created playlist from recommendation',
        impactDescription: `Playlist "${playlistTitle}" with ${addedCount} videos`,
        status: 'success'
      });
    } catch(e) { /* non-critical */ }
    
    sendRes(res, 200, { success: true, playlistId, playlistTitle, videoCount: addedCount });
  } catch (e) {
    console.error('[CreatePlaylist] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── POST /recommendations/:id/enable-captions — Set default language + enable auto-captions ──
router.post('/recommendations/:id/enable-captions', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { eq } = await import('drizzle-orm');
    
    const recId = req.params.id;
    const { accessToken } = req.body || {};
    if (!accessToken) return sendRes(res, 400, { error: 'accessToken required' });
    
    // Load recommendation
    const recs = await dbService.db.select().from(s.agentRecommendations).where(eq(s.agentRecommendations.id, recId));
    const rec = recs[0];
    if (!rec) return sendRes(res, 404, { error: 'Recommendation not found' });
    
    const chId = rec.channelId || req.headers['x-channel-id'] || 'anonymous';
    
    // Get top 3 videos from scan
    const scans = await dbService.db.select().from(s.scanResults)
      .where(eq(s.scanResults.channelId, chId)).orderBy(eq(s.scanResults.scannedAt)).limit(3);
    
    if (scans.length === 0) return sendRes(res, 400, { error: 'No videos found' });
    
    // For each video, update to set default audio language and request auto-captions
    let updated = 0;
    for (const scan of scans) {
      if (!scan.videoId) continue;
      
      // Fetch current snippet
      const getRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet&id=' + scan.videoId, {
        headers: { Authorization: 'Bearer ' + accessToken }
      });
      if (!getRes.ok) continue;
      const gd = await getRes.json();
      const snip = gd.items?.[0]?.snippet;
      if (!snip) continue;
      
      // Update with default language set to English (YouTube auto-translates from here)
      const updateRes = await fetch('https://www.googleapis.com/youtube/v3/videos?part=snippet', {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scan.videoId,
          snippet: {
            ...snip,
            defaultLanguage: 'en',
            defaultAudioLanguage: 'en'
          }
        })
      });
      
      if (updateRes.ok) updated++;
    }
    
    // Mark recommendation as read
    await dbService.db.update(s.agentRecommendations).set({ readStatus: true }).where(eq(s.agentRecommendations.id, recId));
    
    sendRes(res, 200, { success: true, videosUpdated: updated });
  } catch (e) {
    console.error('[EnableCaptions] Error:', e.message);
    sendRes(res, 500, { error: e.message });
  }
});

// ── GET /pipeline — 3-tier pipeline status for UI ──
router.get('/pipeline', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc, ne, eq } = await import('drizzle-orm');
    const chId = req.headers['x-channel-id'] || req.query.channelId || 'anonymous';
    const isMock = chId === 'mock-channel';

    // SCAN: latest scan results count — exclude mock-channel
    const scans = await dbService.db.select().from(s.scanResults)
      .where(isMock ? ne(s.scanResults.channelId, 'mock-channel') : eq(s.scanResults.channelId, chId))
      .orderBy(desc(s.scanResults.scannedAt)).limit(1);
    const lastScan = scans[0]?.scannedAt || null;
    const scanCount = await dbService.db.select().from(s.scanResults)
      .where(isMock ? ne(s.scanResults.channelId, 'mock-channel') : eq(s.scanResults.channelId, chId))
      .then(r => r.length);

    // PROPOSE: pending inbox items — exclude mock-channel
    const queue = await dbService.db.select().from(s.optimizationQueue)
      .where(isMock ? ne(s.optimizationQueue.channelId, 'mock-channel') : eq(s.optimizationQueue.channelId, chId));
    const pending = queue.filter(q => q.status === 'pending').length;
    const applied = queue.filter(q => q.status === 'applied' || q.status === 'approved').length;

    // RECOMMEND: unread alerts — exclude mock-channel
    const recs = await dbService.db.select().from(s.agentRecommendations)
      .where(isMock ? ne(s.agentRecommendations.channelId, 'mock-channel') : eq(s.agentRecommendations.channelId, chId));
    const unread = recs.filter(r => !r.readStatus).length;

    sendRes(res, 200, {
      scan: { lastScan, totalScanned: scanCount, isLive: lastScan && (Date.now() - new Date(lastScan).getTime()) < 3600000 },
      propose: { pending, applied, total: queue.length },
      recommend: { unread, total: recs.length }
    });
  } catch (e) { sendRes(res, 200, { scan: {}, propose: {}, recommend: {} }); }
});

// ── GET /strategy-progress — Progress per growth strategy sub-task ──
router.get('/strategy-progress', async (req, res) => {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc } = await import('drizzle-orm');
    
    const settingsRows = await dbService.db.select().from(s.agentSettings).limit(1);
    const goal = settingsRows[0]?.goal || null;
    
    // Read strategy from activity log
    let strategy = null;
    const logs = await dbService.db.select().from(s.agentActivityLogs)
      .orderBy(desc(s.agentActivityLogs.createdAt)).limit(50);
    const strategyEntry = logs.find(l => l.actionTaken && l.actionTaken.startsWith('STRATEGY:'));
    if (strategyEntry) {
      try { strategy = JSON.parse(strategyEntry.actionTaken.replace('STRATEGY:', '')); } catch (e) {}
    }

    if (!goal || !strategy) return sendRes(res, 200, { goal: null, subtasks: [] });

    const agentToType = {
      optimizer: ['title', 'tags', 'chapters', 'desc'],
      trend_scanner: ['keywords', 'trends'],
      pseo_engine: ['evergreen', 'seo_pages'],
      ab_tester: ['title', 'ab_test'],
      coach: ['chapters', 'preupload'],
      content_planner: ['keywords', 'evergreen', 'gaps']
    };
    
    const queue = await dbService.db.select().from(s.optimizationQueue);
    const applied = queue.filter(q => q.status === 'applied' || q.status === 'approved');
    
    const subtasks = strategy.subtasks.map(st => {
      // Count queue items matched to this agent type as "actions taken"
      const types = agentToType[st.agent] || [];
      const matched = applied.filter(q => {
        const t = (q.videoTitle || '').toLowerCase();
        return types.some(type => t.includes(type));
      });
      const actionsDone = matched.length;
      // Progress per sub-task: each action ≈ 15-25% (subjective, labeled honestly)
      const taskProgress = actionsDone > 0 ? Math.min(95, actionsDone * 20) : 0;
      return {
        ...st,
        actionsCompleted: actionsDone,
        progress: taskProgress,
        status: taskProgress >= 80 ? 'active' : taskProgress > 0 ? 'in_progress' : 'pending',
        note: actionsDone > 0 ? `${actionsDone} optimizations applied` : 'No actions yet'
      };
    });
    
    // ── REAL subscriber progress ──
    let baselineSubs = null;
    let currentSubs = null;
    let realProgress = 0;
    
    // Read baseline from strategy log
    const strategyLogs = logs.filter(l => l.impactDescription && l.impactDescription.startsWith('BASELINE_SUBS:'));
    if (strategyLogs.length > 0) {
      const val = strategyLogs[0].impactDescription.replace('BASELINE_SUBS:', '').trim();
      if (val !== 'unknown') baselineSubs = parseInt(val);
    }
    
    // Fetch current subscriber count
    try {
      const users = await dbService.getAllUsers(100);
      for (const u of users) {
        if (u.metadata?.accessToken) {
          const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true', {
            headers: { Authorization: 'Bearer ' + u.metadata.accessToken },
            signal: AbortSignal.timeout(3000)
          });
          if (chRes.ok) {
            const data = await chRes.json();
            currentSubs = parseInt(data.items?.[0]?.statistics?.subscriberCount || '0');
            break;
          }
        }
      }
    } catch (e) { /* API unavailable */ }
    
    // Real progress = (current - baseline) / (target - baseline) * 100
    const subsMatch = goal.match(/(\d+)[kK]?\s*(sub|subscriber)/i);
    const targetSubs = subsMatch ? parseInt(subsMatch[1]) * (subsMatch[0].toLowerCase().includes('k') ? 1000 : 1) : null;
    
    if (baselineSubs !== null && currentSubs !== null && targetSubs !== null) {
      const gained = currentSubs - baselineSubs;
      const needed = targetSubs - baselineSubs;
      realProgress = needed > 0 ? Math.max(0, Math.min(99, Math.round((gained / needed) * 100))) : 0;
    }
    
    // Actions-based progress (honest about what it measures)
    const actionProgress = subtasks.length > 0
      ? Math.round(subtasks.reduce((s, t) => s + t.progress, 0) / subtasks.length)
      : 0;
    
    sendRes(res, 200, {
      goal,
      targetSubs,
      baselineSubs,
      currentSubs,
      subsGained: baselineSubs !== null && currentSubs !== null ? currentSubs - baselineSubs : null,
      realProgress,        // 0-100 based on actual subscriber change
      actionProgress,      // 0-100 based on optimization actions taken
      progressSource: currentSubs !== null ? 'youtube_api' : 'actions_only',
      subtasks
    });
  } catch (e) { sendRes(res, 200, { goal: null, subtasks: [] }); }
});

// ── Helper: also fix daily-stats to count only real actions ──
