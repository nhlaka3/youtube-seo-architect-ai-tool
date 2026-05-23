// api/_lib/persona-wrapper.js — Drop-in askAI replacement with persona injection
import { AGENT_PERSONA } from '../../config/agent-persona.js';

export async function askAIWithPersona(prompt, options = {}) {
  const { askAI } = await import('./ai-provider.js');
  const fullPrompt = `${AGENT_PERSONA.systemPrefix}\n\nTASK:\n${prompt}`;
  const mergedOptions = {
    temperature: options.temperature ?? 0.6,
    maxTokens: options.maxTokens ?? 800,
    ...options,
  };
  return await askAI('You are a YouTube growth & optimization expert.', fullPrompt, mergedOptions);
}
