// api/recommend-agents/index.js — Unified RECOMMEND publisher (ALERT ONLY, zero execution)
import { checkThumbnailAlert } from './thumbnail-alert.js';
import { generateScriptIdeas } from './script-ideas.js';
import { suggestShortsClips } from './shorts-clips.js';
import { suggestCommunityTips } from './community-tips.js';
import { suggestMultiLang } from './multi-lang-suggest.js';
import { suggestPlaylists } from './playlist-builder.js';
import { suggestBulkOps } from './bulk-ops.js';

/**
 * Generates strategic recommendations from scan data.
 * Pushes to agent_recommendations table.
 * ALERT ONLY — never auto-executes or queues to inbox.
 */
export async function runAllRecommendations(scanResults, channelId, goal = null) {
  if (!scanResults || scanResults.length === 0) return { alerts: 0, items: [] };
  
  const allAlerts = [];
  
  try {
    // Run all 7 recommenders (some depend on AI, some are rule-based)
    const results = await Promise.allSettled([
      ...scanResults.map(s => checkThumbnailAlert(s)),
      generateScriptIdeas(scanResults, goal),
      suggestShortsClips(scanResults),
      suggestCommunityTips(scanResults),
      suggestMultiLang(scanResults),
      suggestPlaylists(scanResults),
      suggestBulkOps(scanResults)
    ]);
    
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) {
        const items = Array.isArray(r.value) ? r.value : [r.value];
        allAlerts.push(...items.filter(Boolean));
      }
    }
    
    // Deduplicate by message
    const seen = new Set();
    const unique = allAlerts.filter(a => {
      const key = a.message.substring(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    
    // Persist to agent_recommendations table
    try {
      const { default: dbService } = await import('../../src/database/services.js');
      const s = await import('../../src/database/schema.js');
      
      for (const alert of unique) {
        await dbService.db.insert(s.agentRecommendations).values({
          channelId: channelId || 'unknown',
          type: alert.type,
          message: alert.message,
          priority: alert.priority,
          readStatus: false,
          createdAt: new Date()
        }).catch(() => {}); // ignore duplicates
      }
      
      // Log
      if (unique.length > 0) {
        await dbService.db.insert(s.agentActivityLogs).values({
          agentName: 'system',
          actionTaken: `[RECOMMEND] ${unique.length} strategic alerts generated`,
          impactDescription: `Types: ${[...new Set(unique.map(a => a.type))].join(', ')} | Priorities: ${unique.filter(a=>a.priority==='high').length} high, ${unique.filter(a=>a.priority==='medium').length} medium`,
          status: 'success'
        });
      }
    } catch (e) {
      console.warn('[RECOMMEND] DB persist failed:', e.message);
    }
    
    return {
      alerts: unique.length,
      items: unique
    };
  } catch (e) {
    console.warn('[RECOMMEND] Runner failed:', e.message);
    return { alerts: 0, items: [] };
  }
}
