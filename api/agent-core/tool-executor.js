// api/agent-core/tool-executor.js
// Bridges AI function calling → agent pipeline stages
// Handles instant queries directly, async ops via agent_jobs table

export async function executeTool(tool, args, channelId) {
  switch (tool) {

    case 'dashboard': {
      return buildDashboard(channelId);
    }

    case 'goal_status': {
      const { getGoalStatus } = await import('./goal-engine.js');
      const goal = await getGoalStatus(channelId);
      if (!goal) return { instant: true, response: 'You haven\'t set a growth goal yet. Click 🎯 Set Goal below to get started.' };
      const eta = goal.progress?.eta ? ' ETA: ' + goal.progress.eta + '.' : '';
      var msg = '🎯 Goal: ' + goal.current.toLocaleString() + '/' + goal.target.toLocaleString() + ' ' + goal.type + ' (' + (goal.progress?.percent || 0) + '%). ';
      msg += 'Weekly pace: +' + (goal.progress?.weeklyRate || 0) + '.' + eta;
      if (goal.phases && goal.phases.length) {
        var pending = goal.phases.filter(function(p) { return p.status === 'pending'; });
        if (pending.length) msg += '\n\n📋 Next phase: ' + pending[0].name + ' — ' + (pending[0].estimatedImpact || '');
      }
      return { instant: true, response: msg };
    }

    case 'set_goal': {
      if (!args.type || !args.target) return { instant: true, response: 'I need to know your goal type (subscribers, views, or watch hours) and target number.' };
      const { setGoal } = await import('./goal-engine.js');
      const goal = await setGoal({ channelId, type: args.type, target: parseInt(args.target), deadline: args.deadline || null });
      var msg = '✅ Goal set! Targeting ' + parseInt(args.target).toLocaleString() + ' ' + args.type;
      if (args.deadline) msg += ' by ' + args.deadline;
      msg += '.\n\nCurrent: ' + (goal.initialCurrent || 0).toLocaleString() + '. I\'ll track your progress and suggest optimizations to help you get there.\n\nNext: Click 🔍 to analyze your channel.';
      return { instant: true, response: msg };
    }

    case 'get_inbox': {
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const s = await import('../../src/database/schema.js');
        const { eq, and } = await import('drizzle-orm');
        const items = await dbService.db.select().from(s.optimizationQueue).where(and(eq(s.optimizationQueue.status, 'pending'), eq(s.optimizationQueue.channelId, channelId))).limit(5);
        if (!items || !items.length) return { instant: true, response: '📭 Your inbox is empty. No pending optimizations right now.\n\nRun a channel scan (⚡ TRIGGER SCAN in Phronesis) to discover opportunities, then come back here.' };
        var lines = items.map(function(i) {
          var vid = (i.videoTitle || 'Untitled').substring(0, 45);
          var type = i.actionType || 'optimization';
          var conf = i.confidence || '?';
          return '• ' + vid + ' — ' + type + ' (' + conf + '% confidence)';
        });
        return { instant: true, response: '📥 ' + items.length + ' pending proposal(s):\n\n' + lines.join('\n') + '\n\nGo to the Phronesis Agent Command Inbox to review and apply them.' };
      } catch(e) { return { instant: true, response: 'Could not access inbox right now.' }; }
    }

    case 'get_activity': {
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const s = await import('../../src/database/schema.js');
        const { desc, eq } = await import('drizzle-orm');
        var limit = Math.min(args.limit || 5, 10);
        const logs = await dbService.db.select().from(s.agentActivityLogs).where(eq(s.agentActivityLogs.channelId, channelId)).orderBy(desc(s.agentActivityLogs.createdAt)).limit(limit);
        if (!logs || !logs.length) return { instant: true, response: 'No recent agent activity yet. Run ⚡ TRIGGER SCAN in Phronesis to start analyzing your channel.' };
        var recent = logs.slice(0, 5).map(function(l) {
          var time = new Date(l.createdAt).toLocaleString('en-US', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
          return '[' + time + '] ' + l.agentName + ': ' + (l.actionTaken || '').substring(0, 90);
        }).join('\n');
        return { instant: true, response: '📊 Recent activity:\n\n' + recent };
      } catch(e) { return { instant: true, response: 'Could not fetch activity.' }; }
    }

    case 'scan_channel': {
      // First check if there are recent scan results
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const s = await import('../../src/database/schema.js');
        const { desc, eq } = await import('drizzle-orm');

        // Check for recent scan results (last 24h) for THIS channel
        const recentScans = await dbService.db.select().from(s.scanResults)
          .where(eq(s.scanResults.channelId, channelId))
          .orderBy(desc(s.scanResults.scannedAt)).limit(5);
        
        // Check for pending proposals for THIS channel
        const proposals = await dbService.db.select().from(s.optimizationQueue)
          .where(and(eq(s.optimizationQueue.status, 'pending'), eq(s.optimizationQueue.channelId, channelId))).limit(5);

        if (recentScans && recentScans.length > 0) {
          var newestScan = new Date(recentScans[0].scannedAt);
          var hoursAgo = Math.round((Date.now() - newestScan.getTime()) / 3600000);
          var timeAgo = hoursAgo < 1 ? 'just now' : hoursAgo + 'h ago';
          
          var lowScoreVideos = recentScans.filter(function(v) { return (v.overallScore || 100) < 60; });
          
          var msg = '🔍 Last scan: ' + timeAgo + ' — analyzed ' + recentScans.length + ' videos.\n\n';
          if (lowScoreVideos.length > 0) {
            msg += '⚠️ ' + lowScoreVideos.length + ' video(s) need attention:\n';
            lowScoreVideos.slice(0, 3).forEach(function(v) {
              msg += '• ' + (v.videoTitle || 'Untitled').substring(0, 40) + ' — Score: ' + (v.overallScore || '?') + '/100\n';
            });
          } else {
            msg += '✅ All scanned videos look good.\n';
          }
          
          if (proposals && proposals.length > 0) {
            msg += '\n📥 ' + proposals.length + ' proposal(s) in your inbox.\n';
          }
          
          msg += '\nRun ⚡ TRIGGER SCAN in Phronesis for a fresh analysis.';
          return { instant: true, response: msg };
        }

        if (proposals && proposals.length > 0) {
          return { instant: true, response: '📥 You have ' + proposals.length + ' pending proposals in your inbox, but no recent scan data. Run ⚡ TRIGGER SCAN in Phronesis for fresh analysis.' };
        }

      } catch(e) { /* fall through to queued message */ }

      // No scan data — queue and suggest
      try {
        const { default: dbService } = await import('../../src/database/services.js');
        const existing = await dbService.getActiveJob(channelId, 'scan_channel');
        if (existing) {
          var age = Date.now() - new Date(existing.createdAt).getTime();
          if (age > 5 * 60 * 1000) {
            await dbService.updateJob(existing.id, { status: 'failed', error: 'Timed out', completedAt: new Date() }).catch(function(){});
          } else {
            return { instant: true, response: 'A scan is already queued. Run ⚡ TRIGGER SCAN in Phronesis for immediate analysis.' };
          }
        }
        var job = await dbService.createJob(channelId, 'scan_channel');
        await dbService.updateJob(job.id, { status: 'completed', completedAt: new Date(), result: { note: 'Queued' } }).catch(function(){});
        return { instant: true, response: '🔍 No recent scan data available. Here\'s what to do:\n\n1. Go to the Phronesis tab\n2. Make sure Agent Mode is 👁 MONITOR or ⚡ AUTO\n3. Click ⚡ TRIGGER SCAN\n\nThis analyzes your videos and generates optimization proposals. I\'ll summarize the results here once complete.' };
      } catch(e) { return { instant: true, response: 'Could not access scan system. Try ⚡ TRIGGER SCAN in Phronesis.' }; }
    }

    case 'optimize_video': {
      return { instant: true, response: 'Run ⚡ TRIGGER SCAN in Phronesis to analyze and generate optimization proposals for all your videos. I\'ll summarize the results here.' };
    }

    case 'apply_fixes': {
      return { instant: true, response: 'Go to the Phronesis Agent Command Inbox to review and apply proposals. Each proposal shows the exact changes before they\'re pushed to YouTube.' };
    }

    default:
      return null;
  }
}

// ── Dashboard — comprehensive channel state summary ──
async function buildDashboard(channelId) {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const { desc, eq } = await import('drizzle-orm');

    var parts = [];

    // 1. Goal
    try {
      const { getGoalStatus } = await import('./goal-engine.js');
      const goal = await getGoalStatus(channelId);
      if (goal) {
        parts.push('🎯 Goal: ' + goal.current.toLocaleString() + '/' + goal.target.toLocaleString() + ' ' + goal.type + ' (' + (goal.progress?.percent || 0) + '%)');
        if (goal.progress?.weeklyRate) parts.push('   Pace: +' + goal.progress.weeklyRate + '/week · ETA: ' + (goal.progress.eta || '...'));
      }
    } catch(e) {}

    // 2. Recent activity (this channel only)
    try {
      const logs = await dbService.db.select().from(s.agentActivityLogs)
        .where(eq(s.agentActivityLogs.channelId, channelId))
        .orderBy(desc(s.agentActivityLogs.createdAt)).limit(5);
      if (logs && logs.length) {
        parts.push('\n📊 Recent activity:');
        logs.slice(0, 3).forEach(function(l) {
          parts.push('   • ' + (l.actionTaken || '').substring(0, 80));
        });
      }
    } catch(e) {}

    // 3. Scan results (this channel only)
    try {
      const scans = await dbService.db.select().from(s.scanResults)
        .where(eq(s.scanResults.channelId, channelId))
        .orderBy(desc(s.scanResults.scannedAt)).limit(10);
      if (scans && scans.length) {
        var low = scans.filter(function(v) { return (v.overallScore || 100) < 60; });
        parts.push('\n🔍 Last scan: ' + scans.length + ' videos analyzed');
        if (low.length) parts.push('   ⚠️ ' + low.length + ' need optimization');
      }
    } catch(e) {}

    // 4. Pending proposals
    try {
      const proposals = await dbService.db.select().from(s.optimizationQueue)
        .where(and(eq(s.optimizationQueue.status, 'pending'), eq(s.optimizationQueue.channelId, channelId))).limit(5);
      if (proposals && proposals.length) {
        parts.push('\n📥 ' + proposals.length + ' proposal(s) waiting in inbox');
      }
    } catch(e) {}

    // 5. Intelligence: channel baselines (30-day trends)
    try {
      const { getChannelBaselines } = await import('../context-enricher.js');
      const bl = await getChannelBaselines(channelId);
      if (bl && bl.rolling30d && !bl.error) {
        parts.push('\n🧠 30-Day Intelligence:');
        if (bl.rolling30d.viewVelocity !== undefined) parts.push('   • View Velocity: ' + bl.rolling30d.viewVelocity + ' views/day (' + (bl.trend?.direction || 'stable') + ')');
        if (bl.rolling30d.successRate !== undefined) parts.push('   • Optimization Success Rate: ' + bl.rolling30d.successRate + '%');
        if (bl.rolling30d.appliedOptimizations) parts.push('   • Applied Optimizations: ' + bl.rolling30d.appliedOptimizations + ' in last 30 days');
      }
    } catch(e) {}

    if (!parts.length) {
      return { instant: true, response: '👋 Welcome to Phronesis! I\'m your AI growth coach.\n\nHere\'s how to get started:\n• Click 🎯 Set Goal to define your target\n• Run ⚡ TRIGGER SCAN in Phronesis to analyze your channel\n• I\'ll summarize results and guide your next moves\n\nWhat would you like to do first?' };
    }

    parts.push('\n\nWhat would you like to do? Use the chips below or ask me anything.');
    return { instant: true, response: parts.join('\n') };

  } catch(e) {
    return { instant: true, response: '👋 Welcome! Set a goal and run a scan to get started.' };
  }
}
