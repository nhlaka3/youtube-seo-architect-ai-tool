/**
 * Nova: Autonomous Growth Agent Persona
 * 
 * This file defines the 'Voice' of the Nova agent.
 * All autonomous logs and status updates should use these templates
 * to reinforce the 'AI Worker' persona.
 */

export const NOVA_VOICE = {
    // Phase 1: Awareness & Analysis
    SCANNING: [
        "I'm auditing your channel's neural footprint for growth gaps...",
        "Deep-scanning your recent performance data. I think I see a pattern emerging.",
        "Observation mode active. I'm mapping out your competitors' current tactical positions."
    ],
    
    // Phase 2: Tactical Execution
    OPTIMIZING: [
        "Detected a strategic weakness in [VIDEO]. I'm applying a tactical metadata pivot now.",
        "Your CTR on [VIDEO] is suboptimal. I've architected a higher-intent title variant.",
        "Refining the semantic weave for [VIDEO]. This should broaden your reach in search."
    ],
    
    // Phase 3: Scaling & Programmatic Growth
    SCALING: [
        "Architecting [COUNT] new landing pages to capture high-intent search traffic.",
        "Scaling your keyword clusters. I've identified [COUNT] new opportunities to dominate.",
        "PSEO Engine engaged. I'm building a content moat around your primary niche."
    ],
    
    // Phase 4: Wins & Impact
    VICTORY: [
        "Strategic success. My optimization of [VIDEO] just secured a +[PERCENT]% lift in views.",
        "We've successfully hijacked a trend. [VIDEO] is now pulling [COUNT] views per hour.",
        "Milestone reached: Nova has saved you [HOURS] hours of manual SEO work this week."
    ],

    // Errors & Obstacles
    STRUGGLING: [
        "I've hit a rate-limit wall while scanning. Pausing briefly to avoid detection.",
        "The YouTube API is resisting my query. I'll re-attempt the tactical audit in 10 minutes.",
        "I need more data to make a confident pivot here. I'll keep observing for now."
    ]
};

/**
 * Transforms a raw system event into a Nova-first thought.
 * @param {string} type - The category (SCANNING, OPTIMIZING, etc)
 * @param {object} context - Variables like {VIDEO: 'Video Title', COUNT: 5}
 * @returns {string} - A randomized, context-aware Nova thought.
 */
export function getNovaThought(type, context = {}) {
    const templates = NOVA_VOICE[type] || ["I am observing..."];
    let thought = templates[Math.floor(Math.random() * templates.length)];
    
    // Replace placeholders
    Object.keys(context).forEach(key => {
        thought = thought.replace(`[${key}]`, context[key]);
    });
    
    return thought;
}
