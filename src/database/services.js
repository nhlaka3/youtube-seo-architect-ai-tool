// src/database/services.js
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { getDb } from './connection.js';
import * as schema from './schema.js';
import { withPerformanceMonitoring } from '../monitoring/performance.js';
import logger from '../monitoring/logger.js';
import { captureError } from '../monitoring/sentry.js';

class DatabaseService {
  get db() {
    return getDb();
  }

  // Retry wrapper for database operations (handles cold starts)
  async _retry(operation, name, maxRetries = 2) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt < maxRetries && (
          error.message?.includes('timeout') || 
          error.message?.includes('connection') ||
          error.message?.includes('ECONNREFUSED')
        )) {
          logger.warn(`[DB] Retry ${attempt + 1}/${maxRetries} for ${name}: ${error.message}`);
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        logger.error(`Failed to ${name}`, { error: error.message });
        captureError(error, { tags: { category: 'database', operation: name } });
        throw error;
      }
    }
  }

  // User operations
  async getUserByChannelId(channelId) {
    return this._retry(async () => {
      const result = await this.db
        .select()
        .from(schema.users)
        .where(eq(schema.users.channelId, channelId))
        .limit(1);
      return result[0] || null;
    }, 'getUserByChannelId');
  }

  async getAllUsers(limit = 100) {
    return this._retry(async () => {
      return this.db
        .select()
        .from(schema.users)
        .limit(limit);
    }, 'getAllUsers');
  }

  async updateUserMetadata(channelId, metadata) {
    return this._retry(async () => {
      const user = await this.getUserByChannelId(channelId);
      if (!user) return null;

      const newMetadata = { ...(user.metadata || {}), ...metadata };
      
      const result = await this.db
        .update(schema.users)
        .set({
          metadata: newMetadata,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.channelId, channelId))
        .returning();
      
      return result[0];
    }, 'updateUserMetadata');
  }

  async createUser(channelId, userData = {}) {
    return withPerformanceMonitoring('createUser', async () => {
      try {
        const result = await this.db
          .insert(schema.users)
          .values({
            channelId,
            email: userData.email,
            plan: userData.plan || 'free',
            credits: userData.credits || 0,
            isVerified: userData.isVerified || false,
            lastRefresh: userData.lastRefresh || null,
            planExpiresAt: userData.planExpiresAt || null,
            metadata: userData.metadata,
          })
          .returning();

        logger.business('user_created', result[0].id, { channelId, plan: userData.plan });
        return result[0];
      } catch (error) {
        logger.error('Failed to create user', { channelId, error: error.message });
        captureError(error, { tags: { category: 'database', operation: 'createUser' } });
        throw error;
      }
    })();
  }

  async updateUserCredits(channelId, credits) {
    return withPerformanceMonitoring('updateUserCredits', async () => {
      try {
        const result = await this.db
          .update(schema.users)
          .set({
            credits,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.channelId, channelId))
          .returning();

        if (result.length > 0) {
          logger.business('credits_updated', result[0].id, { channelId, credits });
        }

        return result[0] || null;
      } catch (error) {
        logger.error('Failed to update user credits', { channelId, credits, error: error.message });
        captureError(error, { tags: { category: 'database', operation: 'updateUserCredits' } });
        throw error;
      }
    })();
  }

  async atomicDeductCredits(channelId, cost) {
    return withPerformanceMonitoring('atomicDeductCredits', async () => {
      try {
        const result = await this.db
          .update(schema.users)
          .set({
            credits: sql`${schema.users.credits} - ${cost}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.users.channelId, channelId),
              gte(schema.users.credits, cost)
            )
          )
          .returning();

        if (result.length === 0) {
          const user = await this.getUserByChannelId(channelId);
          if (!user) return { success: false, error: 'User not found' };
          if (user.credits < cost) return { success: false, error: 'Insufficient credits', balance: user.credits };
          return { success: false, error: 'Atomic update failed' };
        }

        const newBalance = result[0].credits;
        logger.business('credits_atomically_deducted', result[0].id, { channelId, cost, newBalance });
        return { success: true, balance: newBalance, userId: result[0].id };
      } catch (error) {
        logger.error('Failed atomic deduct', { channelId, cost, error: error.message });
        captureError(error, { tags: { category: 'database', operation: 'atomicDeductCredits' } });
        throw error;
      }
    })();
  }

  async updateUserPlan(channelId, plan, planExpiresAt = null) {
    return withPerformanceMonitoring('updateUserPlan', async () => {
      try {
        const updateData = {
          plan,
          updatedAt: new Date(),
        };
        if (planExpiresAt) updateData.planExpiresAt = planExpiresAt;
        
        const result = await this.db
          .update(schema.users)
          .set(updateData)
          .where(eq(schema.users.channelId, channelId))
          .returning();

        if (result.length > 0) {
          logger.business('plan_updated', result[0].id, { channelId, plan, planExpiresAt });
        }

        return result[0] || null;
      } catch (error) {
        logger.error('Failed to update user plan', { channelId, plan, error: error.message });
        captureError(error, { tags: { category: 'database', operation: 'updateUserPlan' } });
        throw error;
      }
    })();
  }

  // Credit transaction operations
  async recordCreditTransaction(userId, amount, type, description = null, reference = null, metadata = null) {
    return withPerformanceMonitoring('recordCreditTransaction', async () => {
      try {
        const result = await this.db
          .insert(schema.creditTransactions)
          .values({
            userId,
            amount,
            type,
            description,
            reference,
            metadata,
          })
          .returning();

        logger.business('credit_transaction', userId, {
          amount,
          type,
          description,
          reference
        });

        return result[0];
      } catch (error) {
        logger.error('Failed to record credit transaction', {
          userId,
          amount,
          type,
          error: error.message
        });
        captureError(error, { tags: { category: 'database', operation: 'recordCreditTransaction' } });
        throw error;
      }
    })();
  }

  async getCreditTransactions(userId, limit = 50) {
    return withPerformanceMonitoring('getCreditTransactions', async () => {
      try {
        return await this.db
          .select()
          .from(schema.creditTransactions)
          .where(eq(schema.creditTransactions.userId, userId))
          .orderBy(desc(schema.creditTransactions.createdAt))
          .limit(limit);
      } catch (error) {
        logger.error('Failed to get credit transactions', { userId, error: error.message });
        captureError(error, { tags: { category: 'database', operation: 'getCreditTransactions' } });
        throw error;
      }
    })();
  }

  // API logging operations
  async logApiCall(userId, endpoint, method, statusCode, responseTime, ipAddress, userAgent, error = null, metadata = null) {
    return withPerformanceMonitoring('logApiCall', async () => {
      try {
        await this.db.insert(schema.apiLogs).values({
          userId,
          endpoint,
          method,
          statusCode,
          responseTime,
          ipAddress,
          userAgent,
          error,
          metadata,
        });
      } catch (error) {
        // Don't throw for logging failures, just log the error
        logger.error('Failed to log API call', {
          userId,
          endpoint,
          method,
          error: error.message
        });
      }
    })();
  }

  // PayPal order operations
  async createPayPalOrder(orderId, userId, plan, amount, currency = 'USD', metadata = null) {
    return withPerformanceMonitoring('createPayPalOrder', async () => {
      try {
        const result = await this.db
          .insert(schema.paypalOrders)
          .values({
            orderId,
            userId,
            plan,
            amount,
            currency,
            status: 'pending',
            metadata,
          })
          .returning();

        return result[0];
      } catch (error) {
        logger.error('Failed to create PayPal order', { orderId, userId, error: error.message });
        captureError(error, { tags: { category: 'database', operation: 'createPayPalOrder' } });
        throw error;
      }
    })();
  }

  async updatePayPalOrderStatus(orderId, status, metadata = null) {
    return withPerformanceMonitoring('updatePayPalOrderStatus', async () => {
      try {
        const updateData = {
          status,
        };

        if (status === 'completed') {
          updateData.completedAt = new Date();
        }

        if (metadata) {
          updateData.metadata = metadata;
        }

        const result = await this.db
          .update(schema.paypalOrders)
          .set(updateData)
          .where(eq(schema.paypalOrders.orderId, orderId))
          .returning();

        return result[0] || null;
      } catch (error) {
        logger.error('Failed to update PayPal order status', { orderId, status, error: error.message });
        captureError(error, { tags: { category: 'database', operation: 'updatePayPalOrderStatus' } });
        throw error;
      }
    })();
  }

  // Analytics queries
  async getUserStats(userId) {
    return withPerformanceMonitoring('getUserStats', async () => {
      try {
        // Get user data
        const user = await this.getUserByChannelId(userId);
        if (!user) return null;

        // Get recent transactions
        const transactions = await this.getCreditTransactions(user.id, 10);

        // Get API usage stats
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);

        const apiStats = await this.db
          .select()
          .from(schema.apiLogs)
          .where(and(
            eq(schema.apiLogs.userId, user.id),
            gte(schema.apiLogs.createdAt, lastWeek)
          ));

        const errorCount = apiStats.filter(log => log.statusCode >= 400).length;
        const totalRequests = apiStats.length;
        const avgResponseTime = totalRequests > 0
          ? apiStats.reduce((sum, log) => sum + (log.responseTime || 0), 0) / totalRequests
          : 0;

        return {
          user,
          recentTransactions: transactions,
          apiStats: {
            totalRequests,
            errorCount,
            avgResponseTime: Math.round(avgResponseTime),
            successRate: totalRequests > 0 ? ((totalRequests - errorCount) / totalRequests * 100).toFixed(1) : 0
          }
        };
      } catch (error) {
        logger.error('Failed to get user stats', { userId, error: error.message });
        captureError(error, { tags: { category: 'database', operation: 'getUserStats' } });
        throw error;
      }
    })();
  }

  // ---- Optimization Trials (Self-Improving Feedback Loop) ----

  async createOptimizationTrial(data) {
    return this._retry(async () => {
      const result = await this.db
        .insert(schema.optimizationTrials)
        .values({
          channelId: data.channelId,
          videoId: data.videoId,
          videoTitle: data.videoTitle,
          optimizationType: data.optimizationType,
          beforeMetrics: data.beforeMetrics || {},
          appliedData: data.appliedData || {},
          seoScoreBefore: data.seoScoreBefore,
          status: 'pending',
          measurementWindow: data.measurementWindow || 7,
          notes: data.notes,
        })
        .returning();
      return result[0];
    }, 'createOptimizationTrial');
  }

  async getPendingTrialsForMeasurement() {
    return this._retry(async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      
      return this.db
        .select()
        .from(schema.optimizationTrials)
        .where(and(
          eq(schema.optimizationTrials.status, 'pending'),
          gte(schema.optimizationTrials.appliedAt, cutoff)
        ))
        .limit(50);
    }, 'getPendingTrials');
  }

  async getOptimizationTrialsByChannel(channelId, limit = 20) {
    return this._retry(async () => {
      return this.db
        .select()
        .from(schema.optimizationTrials)
        .where(eq(schema.optimizationTrials.channelId, channelId))
        .orderBy(desc(schema.optimizationTrials.appliedAt))
        .limit(limit);
    }, 'getOptimizationTrialsByChannel');
  }

  async getOptimizationTrialById(trialId) {
    return this._retry(async () => {
      const result = await this.db
        .select()
        .from(schema.optimizationTrials)
        .where(eq(schema.optimizationTrials.id, trialId))
        .limit(1);
      return result[0] || null;
    }, 'getOptimizationTrialById');
  }

  async updateOptimizationTrial(trialId, data) {
    return this._retry(async () => {
      const result = await this.db
        .update(schema.optimizationTrials)
        .set({ ...data })
        .where(eq(schema.optimizationTrials.id, trialId))
        .returning();
      return result[0];
    }, 'updateOptimizationTrial');
  }

  async getOptimizationStats(channelId) {
    return this._retry(async () => {
      const trials = await this.db
        .select()
        .from(schema.optimizationTrials)
        .where(and(
          eq(schema.optimizationTrials.channelId, channelId),
          eq(schema.optimizationTrials.status, 'completed')
        ));

      const total = trials.length;
      const improved = trials.filter(t => (t.improvementPct || 0) > 0).length;
      const avgImprovement = total > 0
        ? Math.round(trials.reduce((s, t) => s + (t.improvementPct || 0), 0) / total)
        : 0;

      const byType = {};
      for (const t of trials) {
        if (!byType[t.optimizationType]) byType[t.optimizationType] = { total: 0, count: 0 };
        byType[t.optimizationType].total += (t.improvementPct || 0);
        byType[t.optimizationType].count++;
      }
      const bestType = Object.entries(byType)
        .map(([type, d]) => ({ type, avg: d.count > 0 ? Math.round(d.total / d.count) : 0, count: d.count }))
        .sort((a, b) => b.avg - a.avg)[0];

      return {
        total, improved,
        improvementRate: total > 0 ? Math.round((improved / total) * 100) : 0,
        avgImprovement, bestType,
        recentTrials: trials.slice(0, 5)
      };
    }, 'getOptimizationStats');
  }

  async getHighImpactTrials(channelId, minImprovement = 15, limit = 10) {
    return this._retry(async () => {
      return this.db
        .select()
        .from(schema.optimizationTrials)
        .where(and(
          eq(schema.optimizationTrials.channelId, channelId),
          eq(schema.optimizationTrials.status, 'completed'),
          gte(schema.optimizationTrials.improvementPct, minImprovement)
        ))
        .orderBy(desc(schema.optimizationTrials.improvementPct))
        .limit(limit);
    }, 'getHighImpactTrials');
  }

  async getNeuralClusters(channelId) {
    return this._retry(async () => {
      const trials = await this.db
        .select()
        .from(schema.optimizationTrials)
        .where(eq(schema.optimizationTrials.channelId, channelId));
      
      // Categorize trials into clusters for the "Strategy Grid"
      return {
        wins: trials.filter(t => (t.improvementPct || 0) >= 20),
        learnings: trials.filter(t => (t.improvementPct || 0) < 20 && (t.improvementPct || 0) > 0),
        failures: trials.filter(t => (t.improvementPct || 0) <= 0 && t.status === 'completed'),
        active: trials.filter(t => t.status === 'pending' || t.status === 'measuring'),
        byType: {
          title: trials.filter(t => t.optimizationType === 'title').length,
          description: trials.filter(t => t.optimizationType === 'description').length,
          tags: trials.filter(t => t.optimizationType === 'tags').length,
          full: trials.filter(t => t.optimizationType === 'full-metadata').length,
        }
      };
    }, 'getNeuralClusters');
  }

  // Analytics methods
  async getOptimizationTimeline(channelId, days = 30) {
    return this._retry(async () => {
      const schema = await import('./schema.js');
      const { gte, eq, sql } = await import('drizzle-orm');
      const since = new Date(Date.now() - days * 86400000);
      return this.db.select({
        day: sql`DATE(applied_at)`,
        count: sql`COUNT(*)`,
        avgLift: sql`AVG(seo_score_after - seo_score_before)`
      }).from(schema.optimizationTrials).where(and(eq(schema.optimizationTrials.channelId, channelId), gte(schema.optimizationTrials.appliedAt, since))).groupBy(sql`DATE(applied_at)`).orderBy(sql`DATE(applied_at)`);
    }, 'getOptimizationTimeline').catch(() => []);
  }
  async getQueueThroughput(channelId, days = 30) {
    return this._retry(async () => {
      const schema = await import('./schema.js');
      const { gte, eq, sql } = await import('drizzle-orm');
      const since = new Date(Date.now() - days * 86400000);
      return this.db.select({ status: schema.optimizationQueue.status, count: sql`COUNT(*)` }).from(schema.optimizationQueue).where(and(eq(schema.optimizationQueue.channelId, channelId), gte(schema.optimizationQueue.createdAt, since))).groupBy(schema.optimizationQueue.status);
    }, 'getQueueThroughput').catch(() => []);
  }
  async getChannelHealthScore(channelId) {
    return this._retry(async () => {
      const schema = await import('./schema.js');
      const { gte, eq, sql } = await import('drizzle-orm');
      const since = new Date(Date.now() - 30 * 86400000);
      const rows = await this.db.select({ avgScore: sql`AVG(seo_score_after)`, trials: sql`COUNT(*)` }).from(schema.optimizationTrials).where(and(eq(schema.optimizationTrials.channelId, channelId), gte(schema.optimizationTrials.appliedAt, since)));
      return rows[0] || { avgScore: 0, trials: 0 };
    }, 'getChannelHealthScore').catch(() => ({ avgScore: 0, trials: 0 }));
  }
  async getCreditsHistory(channelId, days = 30) {
    return this._retry(async () => {
      const schema = await import('./schema.js');
      const { gte, eq, lt, sql } = await import('drizzle-orm');
      const since = new Date(Date.now() - days * 86400000);
      return this.db.select({ day: sql`DATE(created_at)`, totalUsed: sql`SUM(ABS(amount))` }).from(schema.creditTransactions).where(and(eq(schema.creditTransactions.userId, channelId), lt(schema.creditTransactions.amount, 0), gte(schema.creditTransactions.createdAt, since))).groupBy(sql`DATE(created_at)`).orderBy(sql`DATE(created_at)`);
    }, 'getCreditsHistory').catch(() => []);
  }

  async getAbTestSummary(channelId) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      const rows = await this.db.select({ status: s.abTests.status, winner: s.abTests.winner }).from(s.abTests).where(eq(s.abTests.channelId, channelId));
      const summary = { total: rows.length, complete: 0, running: 0, bWins: 0, aWins: 0 };
      for (const r of rows) {
        if (r.status === 'completed' || r.status === 'complete') {
          summary.complete++;
          if (r.winner === 'variant_b') summary.bWins++;
          else if (r.winner === 'variant_a') summary.aWins++;
        } else if (r.status === 'running') summary.running++;
      }
      return summary;
    }, 'getAbTestSummary').catch(() => ({ total: 0, complete: 0, running: 0, bWins: 0, aWins: 0 }));
  }

  // ══ Programmatic SEO Methods (Phase 11A) ══

  async saveCompetitorPage(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.competitorPages).values({
        competitorUrl: data.competitorUrl,
        pageUrl: data.pageUrl,
        title: data.title,
        h1: data.h1,
        wordCount: data.wordCount || 0,
        keywordFocus: data.keywordFocus,
        estimatedTrafficTier: data.estimatedTrafficTier || 'Unknown',
        contentType: data.contentType || 'blog',
        weaknessScore: data.weaknessScore || 0
      }).onConflictDoUpdate({
        target: s.competitorPages.pageUrl,
        set: { title: data.title, h1: data.h1, wordCount: data.wordCount, weaknessScore: data.weaknessScore }
      }).returning();
    }, 'saveCompetitorPage');
  }

  async getWeakCompetitorPages(limit = 20) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { desc } = await import('drizzle-orm');
      return this.db.select().from(s.competitorPages)
        .orderBy(desc(s.competitorPages.weaknessScore))
        .limit(limit);
    }, 'getWeakCompetitorPages').catch(() => []);
  }

  async saveKeywordCluster(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.keywordClusters).values({
        clusterName: data.clusterName,
        pillarKeyword: data.pillarKeyword,
        supportingKeywords: data.supportingKeywords || [],
        searchIntent: data.searchIntent || 'informational',
        monthlyVolumeTier: data.monthlyVolumeTier || 'Low',
        competition: data.competition || 'High',
        opportunityScore: data.opportunityScore || 0,
        contentGap: data.contentGap || false,
        recommendedPageType: data.recommendedPageType || 'blog'
      }).returning();
    }, 'saveKeywordCluster');
  }

  async getTopClusters(limit = 50) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { desc } = await import('drizzle-orm');
      return this.db.select().from(s.keywordClusters)
        .orderBy(desc(s.keywordClusters.opportunityScore))
        .limit(limit);
    }, 'getTopClusters').catch(() => []);
  }

  async createContentOpportunity(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.contentOpportunities).values({
        keyword: data.keyword,
        clusterId: data.clusterId || null,
        pageType: data.pageType || 'blog',
        targetUrlSlug: data.targetUrlSlug,
        priority: data.priority || 5,
        status: data.status || 'pending',
        planSpec: data.planSpec || data.metadata || null
      }).returning();
    }, 'createContentOpportunity');
  }

  async getPendingOpportunities(limit = 50) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, desc } = await import('drizzle-orm');
      return this.db.select().from(s.contentOpportunities)
        .where(eq(s.contentOpportunities.status, 'pending'))
        .orderBy(desc(s.contentOpportunities.priority))
        .limit(limit);
    }, 'getPendingOpportunities').catch(() => []);
  }

  async getSeoPageBySlug(slug) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      const result = await this.db.select().from(s.seoPages)
        .where(eq(s.seoPages.slug, slug))
        .limit(1);
      return result[0] || null;
    }, 'getSeoPageBySlug');
  }

  async getAllSeoPages(status = null, limit = 100) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, desc } = await import('drizzle-orm');
      let query = this.db.select().from(s.seoPages).orderBy(desc(s.seoPages.publishedAt)).limit(limit);
      if (status) {
        query = query.where(eq(s.seoPages.status, status));
      }
      return query;
    }, 'getAllSeoPages').catch(() => []);
  }

  async saveSeoPage(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.seoPages).values({
        opportunityId: data.opportunityId || null,
        slug: data.slug,
        pageType: data.pageType || 'blog',
        title: data.title,
        metaDescription: data.metaDescription,
        h1: data.h1,
        content: data.content,
        schemaMarkup: data.schemaMarkup || null,
        internalLinks: data.internalLinks || [],
        wordCount: data.wordCount || 0,
        keywordDensity: data.keywordDensity || 0,
        status: data.status || 'draft',
        publishedAt: data.publishedAt || null
      }).onConflictDoUpdate({
        target: s.seoPages.slug,
        set: { title: data.title, content: data.content, status: data.status, publishedAt: data.publishedAt || new Date() }
      }).returning();
    }, 'saveSeoPage');
  }

  async getSeoStats() {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, sql } = await import('drizzle-orm');
      const pages = await this.db.select({ count: sql`COUNT(*)` }).from(s.seoPages).where(eq(s.seoPages.status, 'published'));
      const opps = await this.db.select({ count: sql`COUNT(*)` }).from(s.contentOpportunities).where(eq(s.contentOpportunities.status, 'pending'));
      const clusters = await this.db.select({ count: sql`COUNT(*)` }).from(s.keywordClusters);
      return {
        publishedPages: pages[0]?.count || 0,
        pendingOpportunities: opps[0]?.count || 0,
        clusters: clusters[0]?.count || 0
      };
    }, 'getSeoStats').catch(() => ({ publishedPages: 0, pendingOpportunities: 0, clusters: 0 }));
  }

  async updateContentOpportunityStatus(opportunityId, status, pageId = null) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      const updateData = { status };
      if (pageId) updateData.pageId = pageId;
      return this.db.update(s.contentOpportunities).set(updateData).where(eq(s.contentOpportunities.id, opportunityId)).returning();
    }, 'updateContentOpportunityStatus');
  }

  // ══ Content Plan Workflow (Phase 2 — Planning Spec Inbox) ══

  async saveContentPlan(planData) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const existing = await this.db.select().from(s.contentOpportunities)
        .where((await import('drizzle-orm')).eq(s.contentOpportunities.keyword, planData.keyword))
        .limit(1);
      if (existing.length) {
        // Update plan spec on existing opportunity
        return this.db.update(s.contentOpportunities).set({
          planSpec: planData.planSpec || planData,
          priority: planData.priority || 5,
          status: planData.status || 'pending_review',
          targetUrlSlug: planData.targetUrlSlug || planData.planSpec?.url_slug,
        }).where((await import('drizzle-orm')).eq(s.contentOpportunities.keyword, planData.keyword)).returning();
      }
      return this.db.insert(s.contentOpportunities).values({
        keyword: planData.keyword,
        pageType: planData.pageType || 'blog',
        targetUrlSlug: planData.targetUrlSlug || planData.planSpec?.url_slug,
        priority: planData.priority || 5,
        status: planData.status || 'pending_review',
        planSpec: planData.planSpec || planData,
      }).returning();
    }, 'saveContentPlan');
  }

  async getContentPlans(status = null, limit = 100) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, desc } = await import('drizzle-orm');
      let q = this.db.select().from(s.contentOpportunities)
        .orderBy(desc(s.contentOpportunities.priority))
        .limit(limit);
      if (status) {
        q = q.where(eq(s.contentOpportunities.status, status));
      }
      return q;
    }, 'getContentPlans').catch(() => []);
  }

  async approveContentPlan(planId) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      return this.db.update(s.contentOpportunities).set({ status: 'approved' })
        .where(eq(s.contentOpportunities.id, planId)).returning();
    }, 'approveContentPlan');
  }

  async rejectContentPlan(planId, reason = null) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      return this.db.update(s.contentOpportunities).set({
        status: 'rejected',
        planSpec: reason ? { rejectedReason: reason } : null,
      }).where(eq(s.contentOpportunities.id, planId)).returning();
    }, 'rejectContentPlan');
  }

  async getApprovedPlans(limit = 20) {
    return this.getContentPlans('approved', limit);
  }

  // ══ Optimization Queue Methods (Task 02) ══

  async createQueueItem(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.optimizationQueue).values({
        channelId: data.channelId,
        videoId: data.videoId,
        videoTitle: data.videoTitle,
        currentTitle: data.currentTitle,
        currentDescription: data.currentDescription,
        currentTags: data.currentTags || [],
        proposedTitle: data.proposedTitle,
        proposedDescription: data.proposedDescription,
        proposedTags: data.proposedTags || [],
        scoreBefore: data.scoreBefore || 0,
        scoreAfter: data.scoreAfter || 0,
        status: data.status || 'pending'
      }).returning();
    }, 'createQueueItem');
  }

  async getQueueByChannel(channelId, status = 'pending') {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, and, desc } = await import('drizzle-orm');
      return this.db.select().from(s.optimizationQueue)
        .where(and(eq(s.optimizationQueue.channelId, channelId), eq(s.optimizationQueue.status, status)))
        .orderBy(desc(s.optimizationQueue.createdAt))
        .limit(50);
    }, 'getQueueByChannel').catch(() => []);
  }

  async updateQueueItemStatus(id, status) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      const updateData = { status };
      if (status === 'approved' || status === 'skipped' || status === 'applied') {
        updateData.actionedAt = new Date();
      }
      return this.db.update(s.optimizationQueue).set(updateData).where(eq(s.optimizationQueue.id, id)).returning();
    }, 'updateQueueItemStatus');
  }

  async clearOldQueueItems(channelId) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, and, sql } = await import('drizzle-orm');
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      return this.db.delete(s.optimizationQueue)
        .where(and(eq(s.optimizationQueue.channelId, channelId), eq(s.optimizationQueue.status, 'pending'), sql`${s.optimizationQueue.createdAt} < ${weekAgo}`));
    }, 'clearOldQueueItems').catch(() => []);
  }

  async getQueueStats(channelId) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, sql } = await import('drizzle-orm');
      const result = await this.db.select({
        pending: sql`COUNT(CASE WHEN status='pending' THEN 1 END)`,
        approved: sql`COUNT(CASE WHEN status='approved' THEN 1 END)`,
        applied: sql`COUNT(CASE WHEN status='applied' THEN 1 END)`,
        skipped: sql`COUNT(CASE WHEN status='skipped' THEN 1 END)`,
      }).from(s.optimizationQueue).where(eq(s.optimizationQueue.channelId, channelId));
      return result[0] || { pending: 0, approved: 0, applied: 0, skipped: 0 };
    }, 'getQueueStats').catch(() => ({ pending: 0, approved: 0, applied: 0, skipped: 0 }));
  }

  // ══ Feedback Loop Methods (Task 03) ══

  async getTrialsReadyForMeasurement() {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, and, lt } = await import('drizzle-orm');
      const weekAgo = new Date(Date.now() - 7 * 86400000);
      return this.db.select().from(s.optimizationTrials)
        .where(and(eq(s.optimizationTrials.status, 'pending'), lt(s.optimizationTrials.appliedAt, weekAgo)))
        .limit(20);
    }, 'getTrialsReadyForMeasurement').catch(() => []);
  }

  async recordImpactMeasurement(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.impactMeasurements).values({
        trialId: data.trialId, channelId: data.channelId, videoId: data.videoId,
        viewsBefore: data.viewsBefore || 0, viewsAfter: data.viewsAfter || 0,
        viewsDelta: (data.viewsAfter || 0) - (data.viewsBefore || 0),
        likesBefore: data.likesBefore || 0, likesAfter: data.likesAfter || 0,
        commentsBefore: data.commentsBefore || 0, commentsAfter: data.commentsAfter || 0,
        engagementBefore: data.engagementBefore || 0, engagementAfter: data.engagementAfter || 0,
        measuredAt: new Date()
      }).returning();
    }, 'recordImpactMeasurement');
  }

  async upsertKeywordWin(keyword, niche, viewsLift, ctrLift) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { sql } = await import('drizzle-orm');
      return this.db.insert(s.keywordWins).values({
        keyword: keyword.toLowerCase().trim(), niche: niche || 'General',
        avgViewsLift: viewsLift || 0, avgCtrLift: ctrLift || 0, sampleCount: 1
      }).onConflictDoUpdate({
        target: [s.keywordWins.keyword, s.keywordWins.niche],
        set: {
          avgViewsLift: sql`(keyword_wins.avg_views_lift * keyword_wins.sample_count + ${viewsLift}) / (keyword_wins.sample_count + 1)`,
          avgCtrLift: sql`(keyword_wins.avg_ctr_lift * keyword_wins.sample_count + ${ctrLift}) / (keyword_wins.sample_count + 1)`,
          sampleCount: sql`keyword_wins.sample_count + 1`,
          lastUpdated: new Date()
        }
      }).returning();
    }, 'upsertKeywordWin');
  }

  async getTopKeywordWins(niche = 'General', limit = 20) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, or, desc, gte } = await import('drizzle-orm');
      return this.db.select().from(s.keywordWins)
        .where(or(eq(s.keywordWins.niche, niche), eq(s.keywordWins.niche, 'General')))
        .where(gte(s.keywordWins.sampleCount, 2))
        .orderBy(desc(s.keywordWins.avgViewsLift)).limit(limit);
    }, 'getTopKeywordWins').catch(() => []);
  }

  async getImpactStats(channelId) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, sql } = await import('drizzle-orm');
      const result = await this.db.select({
        totalMeasured: sql`COUNT(*)`,
        improved: sql`COUNT(CASE WHEN views_delta > 0 THEN 1 END)`,
        avgImprovement: sql`AVG(CASE WHEN views_delta > 0 THEN views_delta END)`,
        totalExtraViews: sql`SUM(views_delta)`
      }).from(s.impactMeasurements).where(eq(s.impactMeasurements.channelId, channelId));
      return result[0] || { totalMeasured: 0, improved: 0, avgImprovement: 0, totalExtraViews: 0 };
    }, 'getImpactStats').catch(() => ({ totalMeasured: 0, improved: 0, avgImprovement: 0, totalExtraViews: 0 }));
  }

  // ══ A/B Test Methods (Task 05) ══

  async createAbTest(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.abTests).values({
        channelId: data.channelId, videoId: data.videoId,
        originalTitle: data.originalTitle, variantA: data.variantA, variantB: data.variantB,
        variantAViewsStart: data.initialViews || 0, status: 'running'
      }).returning();
    }, 'createAbTest');
  }

  async getRunningAbTests() {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, desc } = await import('drizzle-orm');
      return this.db.select().from(s.abTests)
        .where(eq(s.abTests.status, 'running'))
        .orderBy(desc(s.abTests.createdAt));
    }, 'getRunningAbTests').catch(() => []);
  }

  async getAbTestsByChannel(channelId) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq, desc } = await import('drizzle-orm');
      return this.db.select().from(s.abTests)
        .where(eq(s.abTests.channelId, channelId))
        .orderBy(desc(s.abTests.createdAt)).limit(20);
    }, 'getAbTestsByChannel').catch(() => []);
  }

  async getAbTestById(id) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      const result = await this.db.select().from(s.abTests)
        .where(eq(s.abTests.id, id)).limit(1);
      return result[0] || null;
    }, 'getAbTestById');
  }

  async updateAbTest(id, data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      return this.db.update(s.abTests).set(data).where(eq(s.abTests.id, id)).returning();
    }, 'updateAbTest');
  }

  // ══ Coach Memory Methods (Task 07) ══

  async getCoachMemory(channelId) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      try {
        const rows = await this.db.select().from(s.coachMemory).where(eq(s.coachMemory.channelId, channelId)).limit(1);
        if (!rows.length) return null;
        const row = rows[0];
        return {
          ...row,
          contentGoals: row.contentGoals || [],
          problemVideos: row.problemVideos || [],
          focusKeywords: row.focusKeywords || [],
          painPoints: row.painPoints || [],
          wins: row.wins || []
        };
      } catch (e) {
        // Fallback: table may not exist yet
        console.warn('[CoachMemory] Drizzle query failed, table may need migration:', e.message);
        return null;
      }
    }, 'getCoachMemory').catch(() => null);
  }

  async upsertCoachMemory(channelId, data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      const existing = await this.db.select().from(s.coachMemory).where(eq(s.coachMemory.channelId, channelId)).limit(1);
      if (existing.length) {
        return this.db.update(s.coachMemory).set({
          niche: data.niche || existing[0].niche,
          contentGoals: data.contentGoals || existing[0].contentGoals,
          problemVideos: data.problemVideos || existing[0].problemVideos,
          focusKeywords: data.focusKeywords || existing[0].focusKeywords,
          uploadFrequency: data.uploadFrequency || existing[0].uploadFrequency,
          painPoints: data.painPoints || existing[0].painPoints,
          wins: data.wins || existing[0].wins,
          lastConversation: data.lastConversation || existing[0].lastConversation,
          conversationCount: (existing[0].conversationCount || 0) + 1,
          updatedAt: new Date()
        }).where(eq(s.coachMemory.channelId, channelId)).returning();
      } else {
        return this.db.insert(s.coachMemory).values({
          channelId, niche: data.niche || null,
          contentGoals: data.contentGoals || [], problemVideos: data.problemVideos || [],
          focusKeywords: data.focusKeywords || [], uploadFrequency: data.uploadFrequency || null,
          painPoints: data.painPoints || [], wins: data.wins || [],
          lastConversation: data.lastConversation || null, conversationCount: 1
        }).returning();
      }
    }, 'upsertCoachMemory');
  }

  async clearCoachMemory(channelId) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      try {
        return this.db.delete(s.coachMemory).where(eq(s.coachMemory.channelId, channelId));
      } catch (e) {
        console.warn('[CoachMemory] clear failed:', e.message);
        return [];
      }
    }, 'clearCoachMemory').catch(() => []);
  }

  // ── Agent Calibration (phronesismind.txt Layer 1 & 4) ──
  async saveCalibrationData(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.agentCalibration).values({
        actionType: data.actionType,
        videoId: data.videoId || null,
        predictedConf: data.predictedConf,
        actualSuccess: data.actualSuccess || 0,
        impactMeasured: data.impactMeasured || null,
        niche: data.niche || 'General',
        notes: data.notes || null
      }).returning();
    }, 'saveCalibrationData');
  }

  async getCalibrationHistory(actionType, limit = 50) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { desc, eq } = await import('drizzle-orm');
      try {
        return this.db.select().from(s.agentCalibration)
          .where(eq(s.agentCalibration.actionType, actionType))
          .orderBy(desc(s.agentCalibration.updatedAt))
          .limit(limit);
      } catch (e) { return []; }
    }, 'getCalibrationHistory').catch(() => []);
  }

  // ── Keyword Win Decay (phronesismind.txt Layer 4) ──
  async decayOldWins() {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { sql } = await import('drizzle-orm');
      try {
        // Apply decay: effective_win = base_lift * e^(-λ * days_since)
        // λ = 0.05 (roughly 50% weight after 14 days)
        // Uses PostgreSQL EXTRACT(EPOCH) for date diff since julianday is SQLite-only
        return this.db.update(s.keywordWins).set({
          avgViewsLift: sql`avg_views_lift * EXP(-0.05 * EXTRACT(EPOCH FROM (NOW() - last_updated)) / 86400)`,
          avgCtrLift: sql`avg_ctr_lift * EXP(-0.05 * EXTRACT(EPOCH FROM (NOW() - last_updated)) / 86400)`,
          lastUpdated: new Date()
        });
      } catch (e) { return []; }
    }, 'decayOldWins');
  }

  // ── Agent Rules CRUD (phronesismind.txt Layer 3) ──
  async getActiveRules() {
    return this._retry(async () => {
      const s = await import('./schema.js');
      const { eq } = await import('drizzle-orm');
      try {
        return this.db.select().from(s.agentRules).where(eq(s.agentRules.isActive, true));
      } catch (e) { return []; }
    }, 'getActiveRules').catch(() => []);
  }

  async insertRule(data) {
    return this._retry(async () => {
      const s = await import('./schema.js');
      return this.db.insert(s.agentRules).values({
        ruleName: data.ruleName,
        description: data.description || null,
        condition: data.condition,
        action: data.action || 'reject',
        isActive: data.isActive !== false,
        priority: data.priority || 5
      }).returning();
    }, 'insertRule');
  }
}
const dbService = new DatabaseService();

export default dbService;