// api/scan-agents/index.js — Unified SCAN runner (FULLY AUTONOMOUS, no UI, no queue)
import { scoreTitle } from './title-scorer.js';
import { scanCTR } from './ctr-scanner.js';
import { trackRetention } from './retention-tracker.js';
import { checkNiche } from './niche-checker.js';
import { syncAnalytics } from './analytics-sync.js';

/**
 * Run all scanners in parallel against a list of videos.
 * Enriched with context baselines for dynamic scoring (Layer 1).
 * Saves results to scan_results table. No UI interaction.
 */
export async function runAllScanners(videos, channelId, niche = 'General') {
  if (!videos || videos.length === 0) return { scanned: 0, results: [] };
  
  // ── LAYER 1: Fetch channel baselines for dynamic comparison ──
  let baselines = null;
  try {
    const { getChannelBaselines, getNicheContext } = await import('../context-enricher.js');
    baselines = await getChannelBaselines(channelId);
    const nicheCtx = getNicheContext(niche, new Date().getDay());
    baselines.nicheContext = nicheCtx;
  } catch (e) { /* continue without baselines */ }
  
  const results = [];
  
  for (const video of videos) {
    try {
      // Enrich video with baseline data for smarter scoring
      const enrichedVideo = {
        ...video,
        channelBaseline: baselines?.rolling30d || null,
        trendDirection: baselines?.trend?.direction || 'stable',
        isPeakDay: baselines?.nicheContext?.isPeakDay || false
      };
      
      // Run all 5 scanners in parallel per video
      const [titleResult, ctrResult, retentionResult, nicheResult] = await Promise.all([
        scoreTitle(enrichedVideo),
        scanCTR(enrichedVideo),
        trackRetention(enrichedVideo),
        checkNiche(enrichedVideo, niche)
      ]);
      
      const merged = {
        channelId: video.channelId || channelId,
        videoId: video.videoId,
        videoTitle: video.title || video.videoTitle || '',
        titleScore: titleResult.titleScore,
        descScore: titleResult.descScore,
        tagScore: titleResult.tagScore,
        overallScore: titleResult.overallScore,
        ctrSignal: ctrResult.ctrSignal,
        retentionScore: retentionResult.retentionScore,
        nicheAlignment: nicheResult.nicheAlignment,
        views: video.views || 0,
        engagement: video.engagementRate || 0,
        issues: [...(titleResult.issues || []), `format:${video.format||'long'}`],
        compliance: titleResult.compliance || {},
        format: video.format || 'long',
        description: video.description || video.snippet?.description || '',
        tags: video.tags || video.snippet?.tags || []
      };
      
      results.push(merged);
    } catch (e) {
      // Skip failed video — don't block the batch
      console.warn('[SCAN] Failed video:', video.videoId, e.message);
    }
  }
  
  // Run analytics sync
  const analytics = await syncAnalytics(videos);
  
  // Persist to scan_results table
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    
    for (const r of results) {
      try {
        await dbService.db.insert(s.scanResults).values({
          channelId: r.channelId || 'unknown',
          videoId: r.videoId,
          videoTitle: r.videoTitle || '',
          titleScore: r.titleScore || 0,
          descScore: r.descScore || 0,
          tagScore: r.tagScore || 0,
          overallScore: r.overallScore || 0,
          ctrSignal: r.ctrSignal || 0,
          retentionScore: r.retentionScore || 0,
          nicheAlignment: r.nicheAlignment || 0,
          views: r.views || 0,
          engagement: r.engagement || 0,
          issues: r.issues || [],
          currentDescription: r.description || '',
          currentTags: r.tags || [],
          scannedAt: new Date()
        });
      } catch (insertErr) {
        console.warn('[SCAN] Insert failed for', r.videoId, insertErr.message);
      }
    }
    
    // Log to activity feed with SCAN_DATA for UI retrieval
    await dbService.db.insert(s.agentActivityLogs).values({
      agentName: 'system',
      actionTaken: `[SCAN] Silent background scan: ${results.length} videos analyzed`,
      impactDescription: `SCAN_DATA:${JSON.stringify({ count: results.length, results: results.slice(0, 25), analytics })}`,
      status: 'success'
    });
  } catch (e) {
    console.warn('[SCAN] DB persist failed:', e.message);
  }
  
  return {
    scanned: results.length,
    results,
    analytics
  };
}
