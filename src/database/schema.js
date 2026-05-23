// src/database/schema.js
import { pgTable, text, integer, timestamp, boolean, jsonb, real, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id').unique().notNull(), // YouTube channel ID
  email: text('email'),
  plan: text('plan').default('free').notNull(), // free, pro, agency
  credits: integer('credits').default(0).notNull(),
  planExpiresAt: timestamp('plan_expires_at'), // When paid plan expires (null = free/no expiry)
  nurtureStep: integer('nurture_step').default(0),
  nurtureUpdatedAt: timestamp('nurture_updated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastRefresh: timestamp('last_refresh'),
  isVerified: boolean('is_verified').default(false).notNull(),
  metadata: jsonb('metadata'), // Additional user data
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').references(() => users.id).notNull(),
  sessionToken: text('session_token').unique().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: jsonb('metadata'), // Session data like IP, user agent
});

export const creditTransactions = pgTable('credit_transactions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').references(() => users.id).notNull(),
  amount: integer('amount').notNull(), // Positive for credits added, negative for used
  type: text('type').notNull(), // purchase, usage, refund, bonus
  description: text('description'),
  reference: text('reference'), // Order ID, operation ID, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  metadata: jsonb('metadata'), // Additional transaction data
});

export const apiLogs = pgTable('api_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').references(() => users.id),
  endpoint: text('endpoint').notNull(),
  method: text('method').notNull(),
  statusCode: integer('status_code').notNull(),
  responseTime: integer('response_time'), // in milliseconds
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  error: text('error'),
  metadata: jsonb('metadata'), // Request/response data (sanitized)
});

export const paypalOrders = pgTable('paypal_orders', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  orderId: text('order_id').unique().notNull(),
  userId: text('user_id').references(() => users.id).notNull(),
  plan: text('plan').notNull(),
  amount: integer('amount').notNull(), // Amount in cents
  currency: text('currency').default('USD').notNull(),
  status: text('status').notNull(), // pending, completed, failed, refunded
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  metadata: jsonb('metadata'), // Full PayPal response data
});

// Indexes for performance
export const indexes = {
  users_channel_id: 'users_channel_id_idx',
  sessions_user_id: 'sessions_user_id_idx',
  sessions_token: 'sessions_session_token_idx',
  credit_transactions_user_id: 'credit_transactions_user_id_idx',
  api_logs_user_id: 'api_logs_user_id_idx',
  api_logs_created_at: 'api_logs_created_at_idx',
  paypal_orders_order_id: 'paypal_orders_order_id_idx',
};

// ---- Self-Improving Feedback Loop ----
export const optimizationTrials = pgTable('optimization_trials', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').references(() => users.id),
  channelId: text('channel_id').notNull(),
  videoId: text('video_id').notNull(),
  videoTitle: text('video_title'),
  optimizationType: text('optimization_type').notNull(), // 'title', 'tags', 'description', 'full-metadata', 'thumbnail'
  beforeMetrics: jsonb('before_metrics'), // { views, ctr, avgViewDuration, ranking }
  afterMetrics: jsonb('after_metrics'), // Same shape, populated after measurement
  appliedData: jsonb('applied_data'), // What was changed: { oldTitle, newTitle, oldTags, newTags, etc. }
  seoScoreBefore: integer('seo_score_before'), // 0-100
  seoScoreAfter: integer('seo_score_after'),
  status: text('status').default('pending').notNull(), // 'pending', 'measuring', 'completed', 'failed'
  appliedAt: timestamp('applied_at').defaultNow().notNull(),
  measuredAt: timestamp('measured_at'), // When after-metrics were fetched
  measurementWindow: integer('measurement_window').default(7), // Days to wait before measuring
  improvementPct: integer('improvement_pct'), // Computed improvement percentage
  notes: text('notes'),
  metadata: jsonb('metadata'),
});

// Optimization queue — auto-generated proposals from cron
// ---- Self-Improving Feedback Loop ----
export const optimizationQueue = pgTable('optimization_queue', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id').notNull(),
  videoId: text('video_id').notNull(),
  videoTitle: text('video_title'),
  currentTitle: text('current_title'),
  currentDescription: text('current_description'),
  currentTags: jsonb('current_tags').default([]),
  proposedTitle: text('proposed_title'),
  proposedDescription: text('proposed_description'),
  proposedTags: jsonb('proposed_tags').default([]),
  scoreBefore: integer('score_before').default(0),
  scoreAfter: integer('score_after').default(0),
  actionType: text('action_type'),
  confidence: integer('confidence'),
  evScore: real('ev_score'),
  rationale: text('rationale'),
  status: text('status').default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  actionedAt: timestamp('actioned_at'),
});

// Feedback loop — keyword wins + impact measurements
export const keywordWins = pgTable('keyword_wins', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  keyword: text('keyword').notNull(),
  niche: text('niche').default('General'),
  patternType: text('pattern_type').default('title_word'),
  avgViewsLift: real('avg_views_lift').default(0),
  avgCtrLift: real('avg_ctr_lift').default(0),
  sampleCount: integer('sample_count').default(0),
  lastUpdated: timestamp('last_updated').defaultNow(),
}, (table) => ({
  keywordNicheUnique: uniqueIndex('keyword_niche_unique_idx').on(table.keyword, table.niche),
}));

export const impactMeasurements = pgTable('impact_measurements', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  trialId: text('trial_id').notNull(),
  channelId: text('channel_id').notNull(),
  videoId: text('video_id').notNull(),
  viewsBefore: integer('views_before').default(0),
  viewsAfter: integer('views_after').default(0),
  viewsDelta: integer('views_delta').default(0),
  likesBefore: integer('likes_before').default(0),
  likesAfter: integer('likes_after').default(0),
  commentsBefore: integer('comments_before').default(0),
  commentsAfter: integer('comments_after').default(0),
  engagementBefore: real('engagement_before').default(0),
  engagementAfter: real('engagement_after').default(0),
  measuredAt: timestamp('measured_at').defaultNow(),
});

export const abTests = pgTable('ab_tests', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id').notNull(),
  videoId: text('video_id').notNull(),
  originalTitle: text('original_title'),
  variantA: text('variant_a').notNull(),
  variantB: text('variant_b').notNull(),
  phase: text('phase').default('variant_a'),
  phaseStartedAt: timestamp('phase_started_at').defaultNow(),
  variantAViewsStart: integer('variant_a_views_start').default(0),
  variantAViewsEnd: integer('variant_a_views_end').default(0),
  variantBViewsStart: integer('variant_b_views_start').default(0),
  variantBViewsEnd: integer('variant_b_views_end').default(0),
  winner: text('winner'),
  status: text('status').default('running'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Programmatic SEO tables
export const competitorPages = pgTable('competitor_pages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  competitorUrl: text('competitor_url').notNull(),
  pageUrl: text('page_url').notNull().unique(),
  title: text('title'),
  h1: text('h1'),
  wordCount: integer('word_count').default(0),
  keywordFocus: text('keyword_focus'),
  estimatedTrafficTier: text('estimated_traffic_tier').default('Unknown'),
  contentType: text('content_type').default('blog'),
  weaknessScore: integer('weakness_score').default(0),
  scrapedAt: timestamp('scraped_at').defaultNow(),
});

export const keywordClusters = pgTable('keyword_clusters', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  clusterName: text('cluster_name').notNull(),
  pillarKeyword: text('pillar_keyword').notNull(),
  supportingKeywords: jsonb('supporting_keywords').default([]),
  searchIntent: text('search_intent').default('informational'),
  monthlyVolumeTier: text('monthly_volume_tier').default('Low'),
  competition: text('competition').default('High'),
  opportunityScore: integer('opportunity_score').default(0),
  contentGap: boolean('content_gap').default(false),
  recommendedPageType: text('recommended_page_type').default('blog'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const contentOpportunities = pgTable('content_opportunities', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  keyword: text('keyword').notNull(),
  clusterId: text('cluster_id'),
  pageType: text('page_type').default('blog'),
  targetUrlSlug: text('target_url_slug'),
  priority: integer('priority').default(5),
  status: text('status').default('pending'),
  pageId: text('page_id'),
  planSpec: jsonb('plan_spec').default(null),
  createdAt: timestamp('created_at').defaultNow(),
});

export const seoPages = pgTable('seo_pages', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  opportunityId: text('opportunity_id'),
  slug: text('slug').notNull().unique(),
  pageType: text('page_type').default('blog'),
  title: text('title').notNull(),
  metaDescription: text('meta_description'),
  h1: text('h1'),
  content: text('content'),
  schemaMarkup: text('schema_markup'),
  internalLinks: jsonb('internal_links').default([]),
  wordCount: integer('word_count').default(0),
  keywordDensity: real('keyword_density').default(0),
  status: text('status').default('draft'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow(),
});
export const contentSeries = pgTable('content_series', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  seriesName: text('series_name').notNull(), niche: text('niche'), goal: text('goal').default('growth'), totalVideos: integer('total_videos').default(5), status: text('status').default('active'), createdAt: timestamp('created_at').defaultNow(),
});
export const contentPlanItems = pgTable('content_plan_items', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  seriesId: text('series_id'), title: text('title').notNull(), angle: text('angle'), targetKeyword: text('target_keyword'), plannedDate: timestamp('planned_date'), status: text('status').default('planned'), videoId: text('video_id'), orderInSeries: integer('order_in_series'), createdAt: timestamp('created_at').defaultNow(),
});
export const agentSettings = pgTable('agent_settings', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id'), // Per-channel isolation (nullable for global singleton)
  isAutonomous: boolean('is_autonomous').default(false),
  autoPublishPseo: boolean('auto_publish_pseo').default(false),
  autoApplySeoThreshold: integer('auto_apply_seo_score_threshold').default(90),
  maxDailyOptimizations: integer('max_daily_optimizations').default(10),
  dryRunMode: boolean('dry_run_mode').default(false),
  confidenceThresholdAuto: integer('confidence_threshold_auto').default(85),
  enableRollback: boolean('enable_rollback').default(true),
  goal: text('goal'),
  personaStyle: text('persona_style').default('architect'),
  communicationDetail: text('communication_detail').default('structured'),
  lastRunAt: timestamp('last_run_at'),
  isRunning: boolean('is_running').default(false),
  notifyEmail: text('notify_email'),
  webhookUrl: text('webhook_url'),
  // Depth isolation (phronesismind.txt — reasoning depth & resource caps)
  maxActiveBranches: integer('max_active_branches').default(3),
  memoryLimitMb: integer('memory_limit_mb').default(512),
  batchSize: integer('batch_size').default(25),
  reasoningDepth: integer('reasoning_depth').default(2),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const agentActivityLogs = pgTable('agent_activity_logs', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id'), // Associate with specific channel
  agentName: text('agent_name').notNull(),
  actionTaken: text('action_taken').notNull(),
  impactDescription: text('impact_description'),
  status: text('status').default('success'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Agent Learning (Phase 4)
export const agentLearning = pgTable('agent_learning', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  actionType: text('action_type').notNull(),
  niche: text('niche').default('General'),
  successRate: real('success_rate').default(0.5),
  avgLift: real('avg_lift').default(0),
  sampleSize: integer('sample_size').default(0),
  recentSkips: integer('recent_skips').default(0),
  recentSuccesses: integer('recent_successes').default(0),
  lastUpdated: timestamp('last_updated').defaultNow(),
});

// Coach Memory (Task 07)
export const coachMemory = pgTable('coach_memory', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id').notNull().unique(),
  niche: text('niche'),
  contentGoals: jsonb('content_goals').default([]),
  problemVideos: jsonb('problem_videos').default([]),
  focusKeywords: jsonb('focus_keywords').default([]),
  uploadFrequency: text('upload_frequency'),
  painPoints: jsonb('pain_points').default([]),
  wins: jsonb('wins').default([]),
  lastConversation: text('last_conversation'),
  conversationCount: integer('conversation_count').default(0),
  updatedAt: timestamp('updated_at').defaultNow(),
});


// Phronesis Scan Results (Phase 1 — persistent scan scores)
export const scanResults = pgTable('scan_results', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id').notNull(),
  videoId: text('video_id').notNull(),
  videoTitle: text('video_title'),
  titleScore: integer('title_score').default(0),
  descScore: integer('desc_score').default(0),
  tagScore: integer('tag_score').default(0),
  overallScore: integer('overall_score').default(0),
  ctrSignal: real('ctr_signal').default(0),
  retentionScore: integer('retention_score').default(0),
  nicheAlignment: integer('niche_alignment').default(0),
  views: integer('views').default(0),
  engagement: real('engagement').default(0),
  issues: jsonb('issues').default([]),
  currentDescription: text('current_description'),
  currentTags: jsonb('current_tags').default([]),
  scannedAt: timestamp('scanned_at').defaultNow(),
});

// Phronesis Recommendations (Phase 3 — strategic alerts)
export const agentRecommendations = pgTable('agent_recommendations', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  channelId: text('channel_id').notNull(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  priority: text('priority').default('medium'),
  readStatus: boolean('read_status').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Agent Calibration (phronesismind.txt Layer 1) — predicted vs actual tracking
export const agentCalibration = pgTable('agent_calibration', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  actionType: text('action_type').notNull(),
  videoId: text('video_id'),
  predictedConf: real('predicted_conf').notNull(),
  actualSuccess: real('actual_success').default(0),
  impactMeasured: real('impact_measured'),
  niche: text('niche').default('General'),
  notes: text('notes'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Agent Rules (phronesismind.txt Layer 3) — critic validation rules
export const agentRules = pgTable('agent_rules', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  ruleName: text('rule_name').notNull().unique(),
  description: text('description'),
  condition: text('condition').notNull(),
  action: text('action').default('reject'),
  isActive: boolean('is_active').default(true),
  priority: integer('priority').default(5),
  createdAt: timestamp('created_at').defaultNow(),
});
