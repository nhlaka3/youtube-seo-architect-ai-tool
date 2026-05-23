// api/agent-core/planner.js — LAYER 3: Multi-Agent Architecture — Planner Sub-agent
// Breaks high-level goals into dependency-aware, sequenced steps
// Integrates: phronesismind.txt Phase 3

/**
 * Generate a dependency-aware action plan from a high-level goal
 * Returns ordered list of actions with dependencies
 */
export async function generatePlan(goalId, goalText, niche) {
  const plan = {
    goalId,
    goalText,
    niche,
    generatedAt: new Date().toISOString(),
    phases: [],
    totalSteps: 0,
    estimatedWeeksToGoal: null
  };

  // Phase 1: Audit & Baseline (always first)
  plan.phases.push({
    phase: 1,
    name: 'AUDIT',
    description: 'Establish baseline metrics and identify highest-leverage opportunities',
    steps: [
      {
        step: 1,
        agent: 'scan_agents',
        action: 'Run full channel scan — score all videos for SEO health',
        dependency: null,
        rationale: 'Cannot optimize what you haven\'t measured',
        expectedOutcome: 'Ranked list of videos by optimization potential',
        estimatedDuration: '1 scan cycle'
      },
      {
        step: 2,
        agent: 'content_planner',
        action: 'Analyze content gaps and trending topics in niche',
        dependency: 1,
        rationale: 'Content strategy needs both current performance data and market signals',
        expectedOutcome: 'List of content opportunities with trend velocity',
        estimatedDuration: '1 scan cycle'
      }
    ]
  });

  const lowerGoal = goalText.toLowerCase();

  // Phase 2: Immediate Wins — depends on goal type
  const phase2Steps = [];

  if (/sub|subscriber|subs/i.test(lowerGoal)) {
    phase2Steps.push({
      step: 3,
      agent: 'optimizer',
      action: 'Optimize titles and thumbnails on 5 lowest-CTR videos',
      dependency: 1,
      rationale: 'CTR is the #1 driver of subscriber conversion — fix worst first',
      expectedOutcome: '+15-25% CTR improvement on targeted videos',
      estimatedDuration: '1-2 days'
    });
    phase2Steps.push({
      step: 4,
      agent: 'optimizer',
      action: 'Optimize descriptions and tags on all underperforming videos',
      dependency: 3,
      rationale: 'Better metadata → better search ranking → more impressions → more subs',
      expectedOutcome: 'Improved search visibility across channel',
      estimatedDuration: '2-3 days'
    });
  }

  if (/view|impression|traffic/i.test(lowerGoal)) {
    phase2Steps.push({
      step: 3,
      agent: 'trend_scanner',
      action: 'Identify and capture 3 surging trends in niche',
      dependency: 2,
      rationale: 'Trend exploitation drives the fastest view spikes',
      expectedOutcome: '3 trend-aligned content pieces within 48h',
      estimatedDuration: '2 days'
    });
    phase2Steps.push({
      step: 4,
      agent: 'pseo_engine',
      action: 'Publish SEO-optimized pages for top 5 keywords',
      dependency: 1,
      rationale: 'Programmatic SEO captures long-tail search traffic',
      expectedOutcome: '5 new indexed pages driving organic traffic',
      estimatedDuration: '1 day'
    });
  }

  if (/ctr|click|thumbnail/i.test(lowerGoal)) {
    phase2Steps.push({
      step: 3,
      agent: 'ab_tester',
      action: 'Set up A/B tests on 3 worst-performing thumbnails',
      dependency: 1,
      rationale: 'A/B testing removes guesswork from CTR optimization',
      expectedOutcome: '2-3 winning variants identified within 72h',
      estimatedDuration: '3 days'
    });
  }

  // Default immediate wins
  if (phase2Steps.length === 0) {
    phase2Steps.push({
      step: 3,
      agent: 'optimizer',
      action: 'Optimize 5 lowest-scoring videos (titles + descriptions + tags)',
      dependency: 1,
      rationale: 'Quick wins build momentum and validate the optimization approach',
      expectedOutcome: 'Measurable SEO score improvements across 5 videos',
      estimatedDuration: '1-2 days'
    });
  }

  plan.phases.push({
    phase: 2,
    name: 'IMMEDIATE_WINS',
    description: 'Quick, high-confidence optimizations for early momentum',
    steps: phase2Steps
  });

  // Phase 3: Strategic Build (always included)
  plan.phases.push({
    phase: 3,
    name: 'STRATEGIC_BUILD',
    description: 'Systematic improvements that compound over time',
    steps: [
      {
        step: phase2Steps.length + 4,
        agent: 'content_planner',
        action: 'Create 4-week content calendar based on scan results and trends',
        dependency: 2,
        rationale: 'Consistent publishing schedule amplifies all other optimizations',
        expectedOutcome: '4-week content roadmap with titles, keywords, and publishing dates',
        estimatedDuration: '1 day'
      },
      {
        step: phase2Steps.length + 5,
        agent: 'coach',
        action: 'Review retention data and suggest content pacing improvements',
        dependency: phase2Steps.length + 4,
        rationale: 'Better retention → longer watch time → algorithm promotion',
        expectedOutcome: 'Retention improvement recommendations for top 10 videos',
        estimatedDuration: '1 day'
      }
    ]
  });

  // Phase 4: Measure & Iterate
  plan.phases.push({
    phase: 4,
    name: 'MEASURE_ITERATE',
    description: 'Evaluate impact, calibrate, and refine strategy',
    steps: [
      {
        step: phase2Steps.length + 6,
        agent: 'system',
        action: 'Run impact measurement — compare pre/post optimization metrics',
        dependency: 'all_previous',
        rationale: 'Data-driven decisions require measuring what worked',
        expectedOutcome: 'Impact delta report with per-action results',
        estimatedDuration: '1 scan cycle'
      },
      {
        step: phase2Steps.length + 7,
        agent: 'system',
        action: 'Calibrate confidence thresholds based on measured impact',
        dependency: phase2Steps.length + 6,
        rationale: 'Self-calibration improves future decision accuracy',
        expectedOutcome: 'Updated confidence engine with historical accuracy data',
        estimatedDuration: 'Ongoing'
      }
    ]
  });

  plan.totalSteps = plan.phases.reduce((sum, p) => sum + p.steps.length, 0);
  plan.estimatedWeeksToGoal = plan.phases.length * 1.5; // ~1.5 weeks per phase

  return plan;
}

/**
 * Check for dependency cycles (max_depth safety)
 */
export function validatePlanDependencies(plan, maxDepth = 10) {
  const visited = new Set();
  const stepMap = new Map();
  
  for (const phase of plan.phases) {
    for (const step of phase.steps) {
      stepMap.set(step.step, step);
    }
  }

  function hasCycle(stepNum, depth = 0) {
    if (depth > maxDepth) return true; // Cycle or too deep
    if (visited.has(stepNum)) return false;
    visited.add(stepNum);
    
    const step = stepMap.get(stepNum);
    if (!step || !step.dependency || step.dependency === 'all_previous') return false;
    if (typeof step.dependency === 'number') {
      return hasCycle(step.dependency, depth + 1);
    }
    return false;
  }

  for (const stepNum of stepMap.keys()) {
    if (hasCycle(stepNum)) return { valid: false, reason: `Cycle or max depth exceeded at step ${stepNum}` };
  }

  return { valid: true };
}
