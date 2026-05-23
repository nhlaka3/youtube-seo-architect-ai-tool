// api/cron-agent-loop.js
// Cron-triggered autonomous agent loop — runs every 6 hours
// Scan → score → prioritize → coach notify

export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { default: dbService } = await import('../src/database/services.js');
    const users = await dbService.getAllUsers(100).catch(() => []);
    const results = [];

    for (const user of users) {
      if (!user.channelId) continue;
      
      try {
        const { getGoalStatus } = await import('./agent-core/goal-engine.js');
        const goal = await getGoalStatus(user.channelId);

        // Run scan
        let issues = [];
        try {
          const { runChannelScan } = await import('./agent-workflows/orchestrator.js');
          const scanResult = await runChannelScan(user.channelId, { accessToken: user.accessToken });
          issues = scanResult?.issues || [];
        } catch(e) { /* scan non-critical */ }

        // Prioritize by goal contribution
        if (issues.length > 0) {
          const { prioritizeActions } = await import('./agent-core/contribution-scorer.js');
          const prioritized = prioritizeActions(issues, goal);

          const { buildRankingAlert, addCoachMessage } = await import('./agent-core/coach.js');
          for (const issue of prioritized.slice(0, 3)) {
            addCoachMessage(user.channelId, buildRankingAlert(issue, goal));
          }
        }

        // Daily progress summary (run once per day — check if last summary was > 23h ago)
        const { buildProgressSummary, addCoachMessage: addMsg } = await import('./agent-core/coach.js');
        if (goal) {
          addMsg(user.channelId, buildProgressSummary(goal));
        }

        results.push({ channelId: user.channelId, issues: issues.length, goalActive: !!goal });
      } catch(userErr) {
        console.error(`[Cron Agent] Error for ${user.channelId}:`, userErr.message);
      }
    }

    res.json({ success: true, channelsProcessed: results.length, results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
