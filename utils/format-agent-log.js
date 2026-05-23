// utils/format-agent-log.js — Standardized log formatter with icons, confidence, first-person
import { AGENT_PERSONA } from '../config/agent-persona.js';

export function formatAgentLog(agentName, action, confidence, impact, style = 'architect') {
  const icons = {
    optimizer: '🔧', trend_scanner: '⚡', pseo_engine: '📝',
    ab_tester: '🧪', coach: '🎯', content_planner: '📋', default: '🤖'
  };
  const icon = icons[agentName] || icons.default;
  const confStr = confidence !== undefined ? `Confidence: ${confidence}%` : '';
  const impactStr = impact ? `Impact: ${impact}` : '';
  return `${icon} [${agentName}] ${action} ${confStr} | ${impactStr}`.trim();
}

// First-person log generator (acceptance criteria)
export function firstPersonLog(template, ...args) {
  const templates = AGENT_PERSONA.firstPersonTemplates;
  if (typeof templates[template] === 'function') {
    return templates[template](...args);
  }
  return args.join(' ');
}

// Get persona style for UI
export function getPersonaStyle(styleName = 'architect') {
  return AGENT_PERSONA.styles[styleName] || AGENT_PERSONA.styles.architect;
}
