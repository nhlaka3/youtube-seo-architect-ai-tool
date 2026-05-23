// api/_lib/growth-agent.js
import dbService from '../../src/database/services.js';

/**
 * Neural Strategy Agent: 
 * Analyzes previous optimization trials to provide "Few-Shot" examples 
 * and winning patterns to the AI Metadata Generator.
 */
export class GrowthAgent {
  /**
   * Generates a context string for the AI prompt based on previous successful trials.
   * @param {string} channelId - The YouTube Channel ID
   * @returns {Promise<string>} - A formatted string for the AI prompt
   */
  static async getHistoricalStrategyContext(channelId) {
    try {
      // Get the top 5 most successful trials (>15% improvement)
      const highImpact = await dbService.getHighImpactTrials(channelId, 15, 5);
      
      if (!highImpact || highImpact.length === 0) {
        return '';
      }

      let strategyPrompt = '\n\n--- NEURAL STRATEGY CONTEXT (Apply these winning patterns) ---\n';
      strategyPrompt += 'The following metadata optimizations previously led to significant growth for this channel. ';
      strategyPrompt += 'Analyze these "wins" and replicate their successful tone, keyword density, and formatting:\n\n';

      highImpact.forEach((trial) => {
        const type = trial.optimizationType.toUpperCase();
        const improvement = trial.improvementPct > 0 ? `+${trial.improvementPct}%` : 'N/A';
        
        strategyPrompt += `[SUCCESSFUL ${type} OPTIMIZATION] (${improvement} improvement)\n`;
        if (trial.appliedData?.newTitle) {
          strategyPrompt += `Pattern: ${trial.appliedData.newTitle}\n`;
        }
        if (trial.notes) {
          strategyPrompt += `Insight: ${trial.notes}\n`;
        }
        strategyPrompt += '\n';
      });

      strategyPrompt += '\nMaintain this momentum by using similar SEO semantic structures in the current proposal.\n';
      
      return strategyPrompt;
    } catch (error) {
      console.warn('[Growth Agent] Error fetching strategy context:', error.message);
      return '';
    }
  }

  /**
   * Classifies a video into a "Neural Strategy Grid" category
   * @param {Object} videoData 
   * @returns {string}
   */
  static classifyStrategy(videoData) {
    const views = videoData.views || 0;
    const engagement = videoData.engagementRate || 0;
    
    if (views > 10000 && engagement > 5) return 'Evergreen Star';
    if (views > 1000 && engagement < 2) return 'Retention Blocker';
    if (views < 500 && engagement > 10) return 'Viral Potential';
    if (views < 100) return 'Underserved Search';
    
    return 'Stable Growth';
  }
}

export default GrowthAgent;
