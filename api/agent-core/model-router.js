// api/agent-core/model-router.js — Cost-aware model routing
// Pattern: agentic-engineering model routing
// Groq (fast/cheap) → scanning, classification, simple transforms
// Gemini (smart) → complex proposals, strategy, content generation
// Tracks per-task cost, tokens, and success rates

// Model tiers
const MODEL_TIERS = {
  fast: {
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
    maxTokens: 1024,
    temperature: 0.3,
    useCases: ['scan', 'classify', 'score', 'extract', 'format', 'validate']
  },
  balanced: {
    provider: 'groq',
    model: 'deepseek-r1-distill-llama-70b',
    costPer1kInput: 0.00075,
    costPer1kOutput: 0.00099,
    maxTokens: 2048,
    temperature: 0.5,
    useCases: ['propose', 'optimize', 'analyze', 'compare', 'suggest']
  },
  smart: {
    provider: 'gemini',
    model: 'gemini-2.0-flash',
    costPer1kInput: 0.00015,  // Gemini Flash is very cheap
    costPer1kOutput: 0.0006,
    maxTokens: 4096,
    temperature: 0.7,
    useCases: ['strategy', 'content', 'decompose', 'coach', 'generate', 'creative']
  }
};

// Per-task cost tracking
let taskCosts = [];
const MAX_COST_LOG = 100;

/**
 * Route a task to the appropriate model tier based on task type
 */
export function routeTask(taskType) {
  for (const [tier, config] of Object.entries(MODEL_TIERS)) {
    if (config.useCases.some(uc => taskType.toLowerCase().includes(uc))) {
      return { tier, ...config };
    }
  }
  // Default to balanced
  return { tier: 'balanced', ...MODEL_TIERS.balanced };
}

/**
 * Estimate cost for a task before execution
 */
export function estimateCost(taskType, estimatedInputTokens, estimatedOutputTokens) {
  const route = routeTask(taskType);
  const inputCost = (estimatedInputTokens / 1000) * route.costPer1kInput;
  const outputCost = (estimatedOutputTokens / 1000) * route.costPer1kOutput;
  return {
    tier: route.tier,
    provider: route.provider,
    model: route.model,
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCost: +(inputCost + outputCost).toFixed(6)
  };
}

/**
 * Track actual cost after task execution
 */
export function trackCost(taskType, tier, inputTokens, outputTokens, durationMs, success) {
  const route = MODEL_TIERS[tier] || MODEL_TIERS.balanced;
  const inputCost = (inputTokens / 1000) * route.costPer1kInput;
  const outputCost = (outputTokens / 1000) * route.costPer1kOutput;
  const totalCost = inputCost + outputCost;
  
  const entry = {
    timestamp: new Date().toISOString(),
    taskType,
    tier,
    provider: route.provider,
    model: route.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    cost: +totalCost.toFixed(6),
    durationMs,
    success,
    costPer1kTokens: +(totalCost / ((inputTokens + outputTokens) / 1000)).toFixed(6)
  };
  
  taskCosts.push(entry);
  if (taskCosts.length > MAX_COST_LOG) taskCosts.shift();
  
  return entry;
}

/**
 * Get cost summary for dashboard display
 */
export function getCostSummary() {
  if (taskCosts.length === 0) {
    return { totalCost: 0, totalTokens: 0, taskCount: 0, avgCostPerTask: 0, byTier: {}, byProvider: {} };
  }
  
  const totalCost = taskCosts.reduce((s, t) => s + t.cost, 0);
  const totalTokens = taskCosts.reduce((s, t) => s + t.totalTokens, 0);
  const successRate = taskCosts.filter(t => t.success).length / taskCosts.length;
  
  const byTier = {};
  const byProvider = {};
  
  for (const t of taskCosts) {
    if (!byTier[t.tier]) byTier[t.tier] = { count: 0, cost: 0, tokens: 0 };
    byTier[t.tier].count++;
    byTier[t.tier].cost += t.cost;
    byTier[t.tier].tokens += t.totalTokens;
    
    if (!byProvider[t.provider]) byProvider[t.provider] = { count: 0, cost: 0, tokens: 0 };
    byProvider[t.provider].count++;
    byProvider[t.provider].cost += t.cost;
    byProvider[t.provider].tokens += t.totalTokens;
  }
  
  return {
    totalCost: +totalCost.toFixed(6),
    totalTokens,
    taskCount: taskCosts.length,
    avgCostPerTask: +(totalCost / taskCosts.length).toFixed(6),
    successRate: +(successRate * 100).toFixed(1),
    byTier,
    byProvider,
    recentTasks: taskCosts.slice(-5).reverse()
  };
}

/**
 * Get recommended tier for growth scan operations
 */
export function getScanRoute() { return routeTask('scan classify score'); }
export function getProposeRoute() { return routeTask('propose optimize suggest'); }
export function getStrategyRoute() { return routeTask('strategy decompose generate'); }
