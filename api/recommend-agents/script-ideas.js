// api/recommend-agents/script-ideas.js — Wraps Task 07 coach memory + trends for content planning
export async function generateScriptIdeas(scanResults, goal = null) {
  const lowPerforming = scanResults.filter(s => s.overallScore < 55 || s.ctrSignal < 30);
  if (lowPerforming.length === 0) return null;
  
  const titles = lowPerforming.slice(0, 3).map(s => s.videoTitle).join(' | ');
  
  try {
    const { askAI } = await import('../_lib/ai-provider.js');
    const raw = await askAI(
      'You are a YouTube content strategist. Return ONLY valid JSON.',
      `Underperforming videos: ${titles}\nGoal: ${goal || 'Grow channel'}\n\nSuggest 2-3 script/format changes to improve performance.\n\nReturn JSON: {"ideas":[{"title":"...","format":"...","why":"≤60 chars"}]}`,
      { temperature: 0.7, maxTokens: 400, forceJson: true }
    );
    const p = JSON.parse(raw.replace(/```json|```/g, '').trim());
    
    return (p.ideas || []).map(idea => ({
      type: 'script',
      priority: 'medium',
      message: `💡 Script Idea: "${idea.title}" — ${idea.format}. ${idea.why}`,
      readStatus: false
    }));
  } catch (e) {
    return [{
      type: 'script',
      priority: 'low',
      message: `💡 Consider reworking hooks/intros on ${lowPerforming.length} underperforming videos to improve retention.`,
      readStatus: false
    }];
  }
}
