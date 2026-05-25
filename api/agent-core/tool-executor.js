// api/agent-core/tool-executor.js
// Bridges AI function calling → agent pipeline stages
// Handles instant queries directly, async ops via agent_jobs table

/**
 * Execute a tool selected by the AI function calling system.
 * @param {string} tool - Tool name from tool registry
 * @param {object} args - Arguments extracted by AI
 * @param {string} channelId
 * @returns {{ instant: true, response: string } | { instant: false, jobId: string, message: string }}
 */
export async function executeTool(tool, args, channelId) {
  switch (tool) {

    // ── Instant tools ──
    case 'goal_status': {
      const { getGoalStatus } = await import('./goal-engine.js');
      const goal = await getGoalStatus(channelId);
      if (!goal) return { instant: true, response: 'You haven\'t set a growth goal yet. Say something like "I want 1000 subscribers" and I\'ll help you get there.' };
      const eta = goal.progress?.eta ? ' ETA: ' + goal.progress.eta + '.' : '';
      return { instant: true, response: 'Your goal: ' + goal.current.toLocaleString() + '/' + goal.target.toLocaleString() + ' ' + goal.type + ' (' + (goal.progress?.percent || 0) + '%). Weekly rate: +' + (goal.progress?.weeklyRate || 0) + '.' + eta };
    }

    case 'set_goal': {
      if (!args.type || !args.target) return { instant: true, response: 'I need to know what type of goal (subscribers, views, or watch_hours) and the target number. For example: "I want 1000 subscribers by December".' };
      const { setGoal } = await import('./goal-engine.js');
      const goal = await setGoal({ channelId, type: args.type, target: parseInt(args.target), deadline: args.deadline || null });
      return { instant: true, response: 'Goal set! Targeting ' + parseInt(args.target).toLocaleString() + ' ' + args.type + (args.deadline ? ' by ' + args.deadline : '') + '. Current: ' + (goal.initialCurrent || 0).toLocaleString() + '. I\'m on it.' };
    }

    case 'get_inbox': {
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const s = await import('../../src/database/schema.js');
        const { eq } = await import('drizzle-orm');
        const items = await dbService.db.select().from(s.optimizationQueue).where(eq(s.optimizationQueue.status, 'pending')).limit(5);
        if (!items || !items.length) return { instant: true, response: 'Your inbox is empty — no pending optimizations. Try scanning your channel first.' };
        var summary = items.map(function(i) {
          return '• ' + ((i.videoTitle || 'Untitled').substring(0, 50)) + ': ' + (i.actionType || 'optimization') + ' (' + (i.confidence || '?') + '% confidence)';
        }).join('\n');
        return { instant: true, response: 'You have ' + items.length + ' pending proposal(s):\n' + summary + '\n\nOpen the Command Inbox in the War Room to review and apply them.' };
      } catch(e) { return { instant: true, response: 'Could not fetch inbox right now. Try again in a moment.' }; }
    }

    case 'get_activity': {
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const s = await import('../../src/database/schema.js');
        const { desc } = await import('drizzle-orm');
        var limit = Math.min(args.limit || 5, 10);
        const logs = await dbService.db.select().from(s.agentActivityLogs).orderBy(desc(s.agentActivityLogs.createdAt)).limit(limit);
        if (!logs || !logs.length) return { instant: true, response: 'No recent agent activity. Try scanning your channel to get started.' };
        var recent = logs.map(function(l) {
          return '[' + new Date(l.createdAt).toLocaleTimeString() + '] ' + l.agentName + ': ' + (l.actionTaken || '').substring(0, 80);
        }).join('\n');
        return { instant: true, response: 'Recent activity (last ' + logs.length + '):\n' + recent };
      } catch(e) { return { instant: true, response: 'Could not fetch activity right now.' }; }
    }

    // ── Async tools ──
    case 'scan_channel': {
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const existing = await dbService.getActiveJob(channelId, 'scan_channel');
        if (existing) return { instant: true, response: 'A channel scan is already running (job #' + (existing.id || '').substring(0, 8) + '). I\'ll show results when it\'s done.' };
        const job = await dbService.createJob(channelId, 'scan_channel');
        runScanJob(job.id, channelId, args);
        return { instant: false, jobId: job.id, message: 'Scanning your channel now... I\'ll update you when I find optimization opportunities. (Job #' + (job.id || '').substring(0, 8) + ')' };
      } catch(e) { return { instant: true, response: 'Could not start scan: ' + e.message }; }
    }

    case 'optimize_video': {
      var videoRef = args.videoId || args.title;
      if (!videoRef) return { instant: true, response: 'Which video should I optimize? Tell me the title or paste the video ID.' };
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const existing = await dbService.getActiveJob(channelId, 'optimize_video');
        if (existing) return { instant: true, response: 'An optimization job is already running (job #' + (existing.id || '').substring(0, 8) + ').' };
        const job = await dbService.createJob(channelId, 'optimize_video');
        runOptimizeJob(job.id, channelId, videoRef);
        var label = typeof videoRef === 'string' ? videoRef.substring(0, 60) : String(videoRef);
        return { instant: false, jobId: job.id, message: 'Analyzing "' + label + '" and generating optimizations... (Job #' + (job.id || '').substring(0, 8) + ')' };
      } catch(e) { return { instant: true, response: 'Could not start optimization: ' + e.message }; }
    }

    case 'apply_fixes': {
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const existing = await dbService.getActiveJob(channelId, 'apply_fixes');
        if (existing) return { instant: true, response: 'An apply job is already running (job #' + (existing.id || '').substring(0, 8) + ').' };
        const job = await dbService.createJob(channelId, 'apply_fixes');
        runApplyJob(job.id, channelId);
        return { instant: false, jobId: job.id, message: 'Applying approved optimizations to your channel... (Job #' + (job.id || '').substring(0, 8) + ')' };
      } catch(e) { return { instant: true, response: 'Could not start apply: ' + e.message }; }
    }

    default:
      return null; // Let coach fall back to chat response
  }
}

// ── Async Job Runners (fire-and-forget, update DB) ──

async function runScanJob(jobId, channelId, args) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'running', progress: 10 });
    const { runAutonomousLoop } = await import('../agent-workflows/orchestrator.js');
    const result = await runAutonomousLoop(channelId);
    await dbService.updateJob(jobId, {
      status: 'completed', progress: 100, completedAt: new Date(),
      result: { proposals: result.totalProposals || 0, queueItems: result.queueItemsCreated || 0, status: result.status }
    });
    const { addCoachMessage, buildMessage } = await import('./coach.js');
    addCoachMessage(channelId, buildMessage({
      type: 'success',
      title: '✅ Channel scan complete',
      body: 'Found ' + (result.totalProposals || 0) + ' optimization opportunities. ' + (result.queueItemsCreated || 0) + ' proposals in your inbox.',
      actions: [{ label: 'View Inbox', action: 'view_inbox' }, { label: 'Dismiss', action: 'dismiss' }]
    }));
  } catch(e) {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'failed', error: e.message, completedAt: new Date() }).catch(function(){});
    const { addCoachMessage, buildMessage } = await import('./coach.js');
    addCoachMessage(channelId, buildMessage({
      type: 'error',
      title: '❌ Scan failed',
      body: (e.message || 'Unknown error').substring(0, 200),
      actions: [{ label: 'Retry', action: 'retry_scan' }]
    }));
  }
}

async function runOptimizeJob(jobId, channelId, videoRef) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'running', progress: 10 });
    const { runAutonomousLoop } = await import('../agent-workflows/orchestrator.js');
    const result = await runAutonomousLoop(channelId);
    await dbService.updateJob(jobId, {
      status: 'completed', progress: 100, completedAt: new Date(),
      result: { proposals: result.totalProposals || 0, queueItems: result.queueItemsCreated || 0 }
    });
    const { addCoachMessage, buildMessage } = await import('./coach.js');
    addCoachMessage(channelId, buildMessage({
      type: 'success',
      title: '✅ Optimization analysis complete',
      body: 'Generated ' + (result.totalProposals || 0) + ' proposals. Check your inbox.',
      actions: [{ label: 'View Inbox', action: 'view_inbox' }]
    }));
  } catch(e) {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'failed', error: e.message, completedAt: new Date() }).catch(function(){});
  }
}

async function runApplyJob(jobId, channelId) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'running', progress: 20 });
    const { autoApplySweep } = await import('../agent-workflows/orchestrator.js');
    const result = await autoApplySweep();
    await dbService.updateJob(jobId, {
      status: 'completed', progress: 100, completedAt: new Date(),
      result: { applied: result.applied || 0, failed: result.failed || 0 }
    });
    const { addCoachMessage, buildMessage } = await import('./coach.js');
    addCoachMessage(channelId, buildMessage({
      type: 'success',
      title: '✅ Optimizations applied',
      body: 'Applied ' + (result.applied || 0) + ' changes to YouTube.' + (result.failed ? ' ' + result.failed + ' failed.' : ''),
      actions: [{ label: 'Dismiss', action: 'dismiss' }]
    }));
  } catch(e) {
    const { default: dbService } = await import('../../src/database/services.js');
    await dbService.updateJob(jobId, { status: 'failed', error: e.message, completedAt: new Date() }).catch(function(){});
  }
}
