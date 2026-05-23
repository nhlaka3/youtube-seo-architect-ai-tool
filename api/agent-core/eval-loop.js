// api/agent-core/eval-loop.js — Eval-first execution loop
// Pattern: continuous-agent-loop + agentic-engineering eval-first
// Pre-scan baseline → execute → post-scan measurement → compare deltas

import { captureScanSnapshot, measureImpactDelta } from './memory-engine.js';

/**
 * Run the full eval-first loop:
 * 1. Capture pre-scan baseline
 * 2. Execute scan + propose + recommend
 * 3. Measure post-execution delta
 * 4. Return impact report
 */
export async function runEvalLoop(channelId, videos, executeFn) {
  const report = {
    phase: 'eval-loop',
    channelId,
    startedAt: new Date().toISOString(),
    baseline: null,
    execution: null,
    impact: null,
    verdict: 'pending'
  };

  // Phase 1: Capture baseline
  try {
    report.baseline = await captureScanSnapshot(channelId, videos);
  } catch (e) {
    report.baseline = { error: e.message };
    console.error('[EVAL] Baseline capture failed:', e.message);
  }

  // Phase 2: Execute
  try {
    report.execution = await executeFn();
  } catch (e) {
    report.execution = { error: e.message };
    console.error('[EVAL] Execution failed:', e.message);
  }

  // Phase 3: Measure delta
  try {
    if (report.baseline && !report.baseline.error) {
      const currentMetrics = {
        avgEngagement: videos.length ? videos.reduce((s,v) => s + (v.engagementRate||0), 0) / videos.length : 0,
        avgViews: videos.length ? Math.round(videos.reduce((s,v) => s + (v.views||0), 0) / videos.length) : 0,
        totalIssues: videos.reduce((s,v) => s + (v.issues?.length||0), 0)
      };
      report.impact = await measureImpactDelta(channelId, report.baseline, currentMetrics);
    }
  } catch (e) {
    report.impact = { error: e.message };
    console.error('[EVAL] Impact measurement failed:', e.message);
  }

  // Verdict
  if (report.execution?.error) {
    report.verdict = 'execution_failed';
  } else if (report.impact?.direction === 'negative' && report.impact?.significant) {
    report.verdict = 'negative_impact_warning';
    report.recommendation = 'Consider rolling back recent changes and reviewing agent decisions';
  } else if (report.impact?.direction === 'positive') {
    report.verdict = 'positive_impact';
    report.recommendation = 'Continue. Current strategy is working.';
  } else {
    report.verdict = 'neutral';
    report.recommendation = 'Monitor closely. Impact not yet measurable.';
  }

  report.completedAt = new Date().toISOString();
  report.durationMs = new Date(report.completedAt) - new Date(report.startedAt);

  return report;
}

/**
 * Quick pre-flight check before autonomous execution
 */
export async function preflightCheck(settings, dailyStats) {
  const checks = [];
  
  // Check 1: Autonomous mode enabled
  checks.push({
    name: 'autonomous_mode',
    passed: settings?.isAutonomous === true,
    detail: settings?.isAutonomous ? 'Agent is active' : 'Agent is paused'
  });

  // Check 2: Daily limits
  const withinLimits = (dailyStats?.used || 0) < (dailyStats?.max || 10);
  checks.push({
    name: 'daily_limits',
    passed: withinLimits,
    detail: `${dailyStats?.used || 0}/${dailyStats?.max || 10} actions used today`
  });

  // Check 3: Goal set
  checks.push({
    name: 'goal_set',
    passed: !!settings?.goal,
    detail: settings?.goal || 'No growth goal set — using opportunistic mode'
  });

  // Check 4: Dry run mode
  if (settings?.dryRunMode) {
    checks.push({
      name: 'dry_run',
      passed: true,
      detail: 'Dry-run mode active — changes will be queued, not applied'
    });
  }

  const allPassed = checks.filter(c => c.name !== 'dry_run' && c.name !== 'goal_set').every(c => c.passed);
  const warnings = checks.filter(c => !c.passed && c.name !== 'goal_set');
  
  return {
    cleared: allPassed,
    checks,
    warnings,
    shouldProceed: allPassed || (warnings.length === 0)
  };
}

/**
 * Generate an eval report summary for UI display
 */
export function formatEvalReport(report) {
  if (!report) return 'No eval data available';
  const lines = [];
  lines.push(`📊 Eval Loop Report — ${report.verdict.replace(/_/g, ' ').toUpperCase()}`);
  if (report.baseline) lines.push(`   Baseline: ${report.baseline.videoCount} videos, ${report.baseline.avgEngagement?.toFixed(2)}% engagement`);
  if (report.impact) {
    const arrow = report.impact.direction === 'positive' ? '📈' : report.impact.direction === 'negative' ? '📉' : '➡️';
    lines.push(`   Impact: ${arrow} ${report.impact.delta >= 0 ? '+' : ''}${report.impact.delta}% engagement delta`);
    lines.push(`   Issues resolved: ${report.impact.issuesResolved}`);
  }
  if (report.execution?.error) lines.push(`   ⚠️ Execution error: ${report.execution.error}`);
  lines.push(`   Duration: ${report.durationMs}ms`);
  if (report.recommendation) lines.push(`   💡 ${report.recommendation}`);
  return lines.join('\n');
}
