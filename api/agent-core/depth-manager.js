// api/agent-core/depth-manager.js — Depth Isolation & Resource Caps
// phronesismind.txt: caps reasoning depth, concurrent branches, memory, and batch size
// Reads config from agent_settings (max_active_branches, memory_limit_mb, batch_size, reasoning_depth)

let _enforcementState = {
  activeBranches: 0,
  estimatedMemoryMb: 0,
  currentDepth: 0,
  lastResetAt: Date.now(),
};

/**
 * Read depth config from the DB agent_settings row.
 * Returns defaults if the row or columns don't exist yet.
 */
export async function getDepthConfig() {
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const s = await import('../../src/database/schema.js');
    const row = await dbService.db
      .select({
        maxActiveBranches: s.agentSettings.maxActiveBranches,
        memoryLimitMb: s.agentSettings.memoryLimitMb,
        batchSize: s.agentSettings.batchSize,
        reasoningDepth: s.agentSettings.reasoningDepth,
      })
      .from(s.agentSettings)
      .limit(1);
    const cfg = row[0] || {};
    return {
      maxActiveBranches: cfg.maxActiveBranches ?? 3,
      memoryLimitMb: cfg.memoryLimitMb ?? 512,
      batchSize: cfg.batchSize ?? 25,
      reasoningDepth: cfg.reasoningDepth ?? 2,
    };
  } catch (e) {
    return { maxActiveBranches: 3, memoryLimitMb: 512, batchSize: 25, reasoningDepth: 2 };
  }
}

/**
 * Reset the in-process enforcement counters (call at start of each orchestrator run)
 */
export function resetDepthCounters() {
  _enforcementState = {
    activeBranches: 0,
    estimatedMemoryMb: 0,
    currentDepth: 0,
    lastResetAt: Date.now(),
  };
}

/**
 * Claim a branch slot (called when starting a scan/propose/recommend sub-cycle).
 * Returns false if we're at the cap.
 */
export function claimBranch(estimatedMb = 64) {
  const cfg = { maxActiveBranches: 3, memoryLimitMb: 512 }; // fast path — config read is async
  if (_enforcementState.activeBranches >= cfg.maxActiveBranches) return false;
  if (_enforcementState.estimatedMemoryMb + estimatedMb > cfg.memoryLimitMb) return false;
  _enforcementState.activeBranches++;
  _enforcementState.estimatedMemoryMb += estimatedMb;
  return true;
}

/**
 * Release a branch slot (call when sub-cycle finishes or is aborted)
 */
export function releaseBranch(estimatedMb = 64) {
  _enforcementState.activeBranches = Math.max(0, _enforcementState.activeBranches - 1);
  _enforcementState.estimatedMemoryMb = Math.max(0, _enforcementState.estimatedMemoryMb - estimatedMb);
}

/**
 * Depth guard: increment current nesting depth. Call before recursive/iterative sub-calls.
 * Returns false if we've hit the limit.
 */
export function enterDepth() {
  const cfg = { reasoningDepth: 2 }; // sync read; config refreshed per run
  if (_enforcementState.currentDepth >= cfg.reasoningDepth) return false;
  _enforcementState.currentDepth++;
  return true;
}

/**
 * Depth guard: decrement nesting depth on exit
 */
export function exitDepth() {
  _enforcementState.currentDepth = Math.max(0, _enforcementState.currentDepth - 1);
}

/**
 * Return current enforcement snapshot for logging / dashboard
 */
export function getDepthState() {
  return { ..._enforcementState };
}

/**
 * Validate a batch size against the configured cap, and trim if needed.
 * Returns the (possibly trimmed) items array + a flag whether trimming happened.
 */
export function enforceBatchSize(items, requestedSize) {
  return getDepthConfig().then(cfg => {
    const cap = Math.min(requestedSize, cfg.batchSize);
    const trimmed = items.slice(0, cap);
    return { items: trimmed, wasTrimmed: trimmed.length < items.length, cap };
  });
}

/**
 * Full enforcement check — call at top of runAutonomousLoop to refresh config
 * and reset counters for this run cycle.
 */
export async function refreshDepthConfig() {
  const cfg = await getDepthConfig();
  resetDepthCounters();
  return cfg;
}
