// ── Multi-Brain AI Provider: Groq (Primary) → Gemini (Failover) ──
import Groq from 'groq-sdk';

let genAI = null;
let geminiAvailable = false;

// Lazy-load Gemini to avoid cold start impact when not needed
async function getGemini() {
  if (genAI) return genAI;
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key') {
      genAI = new GoogleGenerativeAI(apiKey);
      geminiAvailable = true;
      // Gemini initialized
    } else {
      console.warn('[AI Provider] GEMINI_API_KEY not configured');
    }
  } catch (e) {
    console.warn('[AI Provider] Failed to load Gemini:', e.message);
  }
  return genAI;
}

// Groq call
async function callGroq(systemPrompt, userPrompt, options = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('Groq API key not configured');
  }

  const groq = new Groq({ apiKey });
  const { temperature = 0.7, maxTokens = 2000, forceJson = false } = options;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: 'llama-3.1-8b-instant',
    temperature,
    max_tokens: maxTokens,
    ...(forceJson && { response_format: { type: 'json_object' } })
  });

  return completion.choices[0].message.content;
}

// Gemini call
async function callGemini(systemPrompt, userPrompt, options = {}) {
  const g = await getGemini();
  if (!g) throw new Error('Gemini not available');

  const { temperature = 0.7, maxTokens = 2000 } = options;
  const model = g.getGenerativeModel({ 
    model: 'gemini-2.0-flash',
    generationConfig: { temperature, maxOutputTokens: maxTokens }
  });

  // Gemini uses a combined prompt format
  const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`;
  const result = await model.generateContent(fullPrompt);
  const response = result.response;
  return response.text();
}

// Main failover function — tries Groq first, falls back to Gemini (agentic-engineering: retry + cost tracking)
// ── LAYER 2: Chain-of-Thought reasoning suffix (phronesismind.txt Phase 2) ──
export async function askAI(systemPrompt, userPrompt, options = {}) {
  const maxRetries = options.maxRetries || 2;
  let lastError = null;
  
  // ── Inject Chain-of-Thought reasoning prompt when forceJson or addReasoning is set ──
  // NOTE: Do NOT say "before returning JSON" — Groq json_object mode requires output to start with {
  const enrichedUserPrompt = (options.forceJson || options.addReasoning)
    ? userPrompt + '\n\nInclude a "reasoning" array with 3 steps inside your JSON: {"reasoning":["step1","step2","step3"], ...}'
    : userPrompt;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await callGroq(systemPrompt, enrichedUserPrompt, options);
      trackCost('groq', systemPrompt.length + enrichedUserPrompt.length);
      return result;
    } catch (groqError) {
      lastError = groqError;
      console.warn(`[AI Provider] Groq attempt ${attempt + 1} failed:`, groqError.message);
      
      // Fallback to Gemini
      try {
        const result = await callGemini(systemPrompt, enrichedUserPrompt, options);
        trackCost('gemini', systemPrompt.length + enrichedUserPrompt.length);
        return result;
      } catch (geminiError) {
        lastError = geminiError;
        console.warn('[AI Provider] Gemini also failed:', geminiError.message);
        
        if (attempt < maxRetries) {
          const delay = (attempt + 1) * 1000;
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
  }
  
  // All retries exhausted — fallback to mock in dev
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[AI Provider] All providers exhausted → Mock fallback');
    if (options.forceJson || (systemPrompt + userPrompt).toLowerCase().includes('json')) {
      return JSON.stringify({
        tips: ["Analyze competitor thumbnail patterns", "Review audience retention dips", "Optimize keyword density"],
        score: 85, relevant: true
      });
    }
    return `[MOCK] Simulated response. Prompt: ${userPrompt.length} chars.`;
  }
  
  throw new Error(`All AI providers unavailable after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

// Check which providers are available
export async function checkProviders() {
  const status = { groq: false, gemini: false };
  
  // Check Groq
  if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    status.groq = true;
  }
  
  // Check Gemini
  const g = await getGemini();
  status.gemini = geminiAvailable;
  
  return status;
}

// ── Cost tracking (agentic-engineering skill) ──
let _totalCost = 0; let _totalCalls = 0; let _costByProvider = { groq: 0, gemini: 0 };

function trackCost(provider, tokenCount) {
  _totalCalls++;
  // Rough cost estimation: Groq ~\/bin/bash.0002/1K tokens, Gemini ~\/bin/bash.0005/1K tokens (approx)
  const rate = provider === 'groq' ? 0.0002 : 0.0005;
  const cost = (tokenCount / 4 / 1000) * rate; // ~4 chars per token
  _totalCost += cost;
  _costByProvider[provider] = (_costByProvider[provider] || 0) + cost;
}

export function getAICostStats() { return { totalCost: +_totalCost.toFixed(4), totalCalls: _totalCalls, byProvider: _costByProvider }; }
