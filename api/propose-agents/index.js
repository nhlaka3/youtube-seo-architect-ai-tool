// api/propose-agents/index.js — Unified PROPOSE runner (AUTO-QUEUE to Command Inbox)
import { generateTitleFix } from './title-fixer.js';
import { generateTagFix } from './tag-optimizer.js';
import { generateKeywordOpp } from './keyword-opportunity.js';
import { generateChapters } from './chapter-suggester.js';
import { generateEvergreen } from './evergreen-content.js';
import { runPreUploadCheck } from './pre-upload-check.js';
import { analyzeThumbnail } from './thumbnail-analyzer.js';
import { generateTitleVariants } from './ab-test-runner.js';

/**
 * Reads low-scoring items from scan_results, generates proposals,
 * and queues to optimizationQueue (Command Inbox).
 * AUTO mode: high-confidence items auto-execute.
 * MANUAL mode: all items queued for approval.
 */
export async function runAllProposals(scanResults, settings = {}, goal = null, strategyAgents = null) {
  if (!scanResults || scanResults.length === 0) return { proposed: 0, items: [] };
  
  const isAuto = settings.isAutonomous && !settings.dryRunMode;
  const autoThreshold = settings.confidenceThresholdAuto || 85;
  const proposals = [];
  let queuedCount = 0;
  
  // Agent-to-strategy mapping: which propose agent matches which strategy agent
  const agentMap = {
    optimizer: ['title-fixer', 'tag-optimizer', 'chapter-suggester', 'thumbnail-analyzer'],
    trend_scanner: ['keyword-opportunity'],
    pseo_engine: ['evergreen-content'],
    ab_tester: ['title-fixer', 'ab-test-runner'],
    coach: ['chapter-suggester', 'pre-upload-check', 'ab-test-runner'],
    content_planner: ['keyword-opportunity', 'evergreen-content']
  };
  
  // Default: all 8 proposers fire for every video in autonomous mode
  let enabledProposers = ['title-fixer', 'tag-optimizer', 'keyword-opportunity', 'chapter-suggester', 'evergreen-content', 'pre-upload-check', 'thumbnail-analyzer', 'ab-test-runner'];
  if (strategyAgents && strategyAgents.length > 0) {
    enabledProposers = [...new Set(strategyAgents.flatMap(a => agentMap[a] || []))];
    if (enabledProposers.length === 0) enabledProposers = ['title-fixer', 'tag-optimizer']; // fallback
  }
  
  // Only process TOP 5 worst-scoring videos to stay within Vercel 10s limit
  const sorted = [...scanResults].sort((a, b) => (a.overallScore || 100) - (b.overallScore || 100));
  for (const scan of sorted.slice(0, 8)) {
    try {
      // Enrich scan with video metadata for the proposal generators
      const enriched = {
        ...scan,
        videoTitle: scan.videoTitle || '',
        currentDescription: scan.currentDescription || '',
        currentTags: scan.currentTags || []
      };
      
      // Only run proposers that match what's weakest — saves AI calls
      const scores = { title: enriched.titleScore || 100, desc: enriched.descScore || 100, tags: enriched.tagScore || 100 };
      const weakest = Object.entries(scores).sort((a, b) => a[1] - b[1]);
      
      // Run all 8 propose agents for every video — autonomous agent leaves no feature untried
      const proms = [];
      proms.push(generateTitleFix(enriched, goal).catch(() => null));
      proms.push(generateTagFix(enriched).catch(() => null));
      proms.push(generateKeywordOpp(enriched, goal).catch(() => null));
      proms.push(generateChapters(enriched).catch(() => null));
      proms.push(generateEvergreen(enriched, goal).catch(() => null));
      proms.push(runPreUploadCheck(enriched).catch(() => null));
      proms.push(analyzeThumbnail(enriched.videoId, null, enriched.videoTitle, (enriched.niche || enriched.nicheAlignment ? 'general' : 'general')).catch(() => null));
      proms.push(generateTitleVariants(String(enriched.videoTitle || '').replace(/[|┃].*$/, ''), 'general', enriched).catch(() => null));
      
      const [titleFix, tagFix, keywordOpp, chapters, evergreen, preUpload, thumbAnalysis, abVariants] = await Promise.all(proms);
      
      const allFixes = [
        titleFix, tagFix, keywordOpp, chapters, evergreen, preUpload,
        thumbAnalysis, abVariants
      ].filter(Boolean);
      
      for (const fix of allFixes) {
        if (!fix.confidence || fix.confidence < 15) continue;
        
        // ── LAYER 2: Calculate Expected Value ──
        let evResult = null;
        try {
          const { calculateExpectedValue } = await import('../agent-core/scoring-engine.js');
          evResult = calculateExpectedValue(fix.actionType || 'title', fix.confidence || 50, 1, {
            quotaUsed: 0, quotaMax: 10000,
            recentSkipRate: 0,
            historicalWinRate: 0.5
          });
          // Drop negative EV proposals
          if (!evResult.thresholdPassed) continue;
        } catch (e) { /* continue without EV */ }
        
        // ── LAYER 3: Run Critic validation ──
        let criticResult = { approved: true, rejected: false };
        try {
          const { validateProposal } = await import('../agent-core/critic.js');
          criticResult = await validateProposal({
            videoId: fix.videoId,
            actionType: fix.actionType,
            videoTitle: scan.videoTitle || '',
            confidence: fix.confidence,
            proposedText: fix.proposedText,
            currentText: fix.currentText
          }, proposals);
          if (criticResult.rejected) continue; // Critic rejected
        } catch (e) { /* continue without critic */ }
        
      // t8 fix: tags auto-apply @90%+; titles/descriptions always manual
      const effectiveAuto = isAuto && fix.confidence >= autoThreshold && (fix.actionType === 'tags' || fix.actionType === 'tag');
        
        proposals.push({
          ...fix,
          autoApplied: effectiveAuto,
          evScore: evResult?.ev || null,
          criticFlags: criticResult?.flags || []
        });
        
        // Queue to Command Inbox (optimizationQueue)
        try {
          const { default: dbService } = await import('../../src/database/services.js');
          const s = await import('../../src/database/schema.js');
          
          // ── FIX: Store proposed content for ALL action types (not just title/tags) ──
          var isTitleFix = fix.actionType === 'title';
          var isDescFix = fix.actionType === 'description' || fix.actionType === 'chapters' || fix.actionType === 'evergreen' || fix.actionType === 'preupload';
          var isTagFix = fix.actionType === 'tags';
          var pTitle = isTitleFix ? (typeof fix.proposedText === 'string' ? fix.proposedText : '') : null;
          var pDesc = isDescFix ? (typeof fix.proposedText === 'string' ? fix.proposedText : (fix.rationale || fix.actionType + ' optimization')) : null;
          var pTags = isTagFix ? (Array.isArray(fix.proposedText) ? fix.proposedText : []) : [];
          // Fallback: always have something to show
          if (!pTitle && !pDesc && pTags.length === 0) pDesc = fix.rationale || (fix.actionType + ' optimization for this video');
          
          // ── Always include current state from the video so inbox shows before/after ──
          const currentDesc = scan.currentDescription || scan.description || '';
          const currentTags = Array.isArray(scan.currentTags) ? scan.currentTags : [];
          const currentTitle = scan.videoTitle || scan.title || '';
          
          // ── SKIP queue entry when proposed text is trivially identical to current ──
          if (isTitleFix && typeof fix.proposedText === 'string' && typeof fix.currentText === 'string') {
            const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase().replace(/[()\[\]{}#|]/g, '');
            const pNorm = norm(fix.proposedText);
            const cNorm = norm(fix.currentText);
            if (pNorm === cNorm || pNorm.includes(cNorm) || cNorm.includes(pNorm)) {
              continue; // Skip — proposal is trivially similar to current title
            }
          }

          const queueEntry = {
            channelId: scan.channelId || 'unknown',
            videoId: fix.videoId,
            videoTitle: currentTitle,
            currentTitle: currentTitle,
            proposedTitle: pTitle,
            currentDescription: currentDesc,
            proposedDescription: pDesc,
            currentTags: currentTags,
            proposedTags: pTags,
            actionType: fix.actionType || 'optimization',
            confidence: fix.confidence || 50,
            evScore: evResult?.ev || null,
            rationale: fix.rationale || null,
            scoreBefore: fix.scoreBefore || 0,
            scoreAfter: fix.scoreAfter || 80,
            status: effectiveAuto ? 'applied' : 'pending',
            actionedAt: effectiveAuto ? new Date() : null
          };
          
          await dbService.db.insert(s.optimizationQueue).values(queueEntry);
          queuedCount++;
          
          // Log with EV and critic data
          await dbService.db.insert(s.agentActivityLogs).values({
            agentName: 'system',
            actionTaken: `[PROPOSE] ${effectiveAuto ? 'AUTO-APPLIED' : 'Queued'}: ${fix.actionType} fix for "${(scan.videoTitle || '').substring(0, 40)}"`,
            impactDescription: `${fix.rationale} | Confidence: ${fix.confidence}% | EV: ${evResult?.ev || 'N/A'} | Critic: ${criticResult?.approved ? '✅' : '⚠️ ' + (criticResult?.warnings?.join('; ') || '')} | ${fix.predictedLift || ''}`,
            status: effectiveAuto ? 'success' : 'success'
          });
        } catch (e) {
          console.warn('[PROPOSE] Queue failed:', e.message);
        }

        // ── THUMBNAIL ANALYSIS — enqueue thumbnail alert if actionable ──
        if (thumbAnalysis?.actionableNow) {
          try {
            const thumbNotes = (thumbAnalysis.suggestions || []).join(' | ');
            await dbService.db.insert(s.optimizationQueue).values({
              channelId: scan.channelId || 'unknown', videoId: enriched.videoId,
              videoTitle: currentTitle, currentTitle: currentTitle, proposedTitle: null,
              currentDescription: currentDesc, proposedDescription: '(thumbnail refresh recommended)',
              currentTags: currentTags, proposedTags: [],
              actionType: 'thumbnail-alert', confidence: thumbAnalysis.scores?.overall || 50, evScore: null,
              rationale: `[Thumbnail Lab] Grade ${thumbAnalysis.thumbnailGrade || 'D'}, potential lift: ${thumbAnalysis.suggestions?.[0] || 'review'} — ${thumbNotes}`,
              scoreBefore: 0, scoreAfter: 0, status: 'pending', actionedAt: null
            }).catch(() => {});
            queuedCount++;
            await dbService.db.insert(s.agentActivityLogs).values({
              agentName: 'thumbnail_lab',
              actionTaken: `[THUMBNAIL] Grade ${thumbAnalysis.thumbnailGrade}/D for "${(currentTitle || '').substring(0, 35)}"`,
              impactDescription: thumbNotes.substring(0, 150),
              status: 'warning'
            });
          } catch (e) { /* non-blocking */ }
        }

        // ── A/B VARIANTS — enqueue top variant as a test suggestion ──
        if (Array.isArray(abVariants?.variants) && abVariants.variants.length > 0) {
          const topVariant = abVariants.variants[0];
          try {
            await dbService.db.insert(s.optimizationQueue).values({
              channelId: scan.channelId || 'unknown', videoId: enriched.videoId,
              videoTitle: currentTitle, currentTitle: currentTitle,
              proposedTitle: topVariant.title || null,
              currentDescription: currentDesc, proposedDescription: null,
              currentTags: currentTags, proposedTags: [],
              actionType: 'ab-test', confidence: 'AB Test', evScore: null,
              rationale: `[AB Tester] Test "${topVariant.variant}" — ${topVariant.predictedCTRLift} CTR lift via ${topVariant.strategy}. Keep best of ${abVariants.variants.length} variants for ${abVariants.testDuration || '48h'}.`,
              scoreBefore: 0, scoreAfter: 0, status: 'pending', actionedAt: null
            }).catch(() => {});
            queuedCount++;
            await dbService.db.insert(s.agentActivityLogs).values({
              agentName: 'ab_tester',
              actionTaken: `[AB TEST] ${abVariants.variants.length} variants generated for "${(currentTitle || '').substring(0, 30)}"`,
              impactDescription: `Top pick: "${(topVariant.title || '').substring(0, 45)}" (${topVariant.predictedCTRLift})`,
              status: 'success'
            });
          } catch (e) { /* non-blocking */ }
        }
      }
    } catch (e) {
      console.warn('[PROPOSE] Failed scan:', e.message);
    }
  }
  
  return {
    proposed: proposals.length,
    queued: queuedCount,
    autoApplied: proposals.filter(p => p.autoApplied).length,
    items: proposals
  };
}
