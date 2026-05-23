// src/monitoring/health.js
import { checkDatabaseHealth } from '../database/connection.js';
import logger from './logger.js';
import { performanceMonitor } from './performance.js';

export const healthChecks = {
  database: async () => {
    try {
      return await checkDatabaseHealth();
    } catch (error) {
      logger.error('Health check failed: database', { error: error.message });
      return { status: 'unhealthy', message: `Database error: ${error.message}` };
    }
  },

  external: async () => {
    const checks = [];

    // YouTube API check
    try {
      const response = await fetch('https://www.googleapis.com/youtube/v3/search?part=id&q=test&type=video&maxResults=1&key=' + (process.env.YOUTUBE_API_KEY || 'test'));
      checks.push({
        service: 'youtube_api',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: response.headers.get('x-response-time') || 'unknown'
      });
    } catch (error) {
      checks.push({
        service: 'youtube_api',
        status: 'unhealthy',
        error: error.message
      });
    }

    // Groq API check
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY || 'test'}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      checks.push({
        service: 'groq_api',
        status: response.ok ? 'healthy' : 'degraded',
        responseTime: response.headers.get('x-response-time') || 'unknown'
      });
    } catch (error) {
      checks.push({
        service: 'groq_api',
        status: 'unhealthy',
        error: error.message
      });
    }

    const allHealthy = checks.every(check => check.status === 'healthy');
    const anyUnhealthy = checks.some(check => check.status === 'unhealthy');

    return {
      status: anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded',
      message: `${checks.filter(c => c.status === 'healthy').length}/${checks.length} services healthy`,
      details: checks
    };
  },

  system: async () => {
    try {
      const metrics = performanceMonitor.getMetrics();

      // Check memory usage
      const memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
      const memoryStatus = memoryUsagePercent > 90 ? 'critical' :
                          memoryUsagePercent > 75 ? 'warning' : 'healthy';

      // Check uptime (should be reasonable)
      const uptimeHours = metrics.uptime / 3600;
      const uptimeStatus = uptimeHours < 0.01 ? 'warning' : 'healthy'; // Less than 36 seconds

      const overallStatus = [memoryStatus, uptimeStatus].includes('critical') ? 'unhealthy' :
                           [memoryStatus, uptimeStatus].includes('warning') ? 'degraded' : 'healthy';

      return {
        status: overallStatus,
        message: `System resources: ${memoryStatus}, uptime: ${uptimeStatus}`,
        details: {
          memory: {
            usagePercent: memoryUsagePercent.toFixed(1) + '%',
            status: memoryStatus
          },
          uptime: {
            hours: uptimeHours.toFixed(2),
            status: uptimeStatus
          },
          ...metrics
        }
      };
    } catch (error) {
      logger.error('Health check failed: system', { error: error.message });
      return { status: 'unhealthy', message: `System check error: ${error.message}` };
    }
  },

  application: async () => {
    try {
      const requiredEnvVars = [
        'GROQ_API_KEY',
        'YOUTUBE_API_KEY',
        ...(process.env.NODE_ENV === 'production' ? ['PAYPAL_CLIENT_ID', 'PAYPAL_SECRET'] : [])
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      const hasAllVars = missingVars.length === 0;

      return {
        status: hasAllVars ? 'healthy' : 'unhealthy',
        message: hasAllVars ? 'All required environment variables present' :
                 `Missing environment variables: ${missingVars.join(', ')}`,
        details: {
          requiredVars: requiredEnvVars,
          missingVars,
          envStatus: hasAllVars ? 'complete' : 'incomplete'
        }
      };
    } catch (error) {
      logger.error('Health check failed: application', { error: error.message });
      return { status: 'unhealthy', message: `Application check error: ${error.message}` };
    }
  }
};

export const runHealthCheck = async (checkType = 'all') => {
  const startTime = Date.now();

  if (checkType === 'all') {
    const results = await Promise.allSettled([
      healthChecks.database(),
      healthChecks.external(),
      healthChecks.system(),
      healthChecks.application()
    ]);

    const details = {
      database: results[0].status === 'fulfilled' ? results[0].value : { status: 'error', message: results[0].reason?.message },
      external: results[1].status === 'fulfilled' ? results[1].value : { status: 'error', message: results[1].reason?.message },
      system: results[2].status === 'fulfilled' ? results[2].value : { status: 'error', message: results[2].reason?.message },
      application: results[3].status === 'fulfilled' ? results[3].value : { status: 'error', message: results[3].reason?.message }
    };

    const statuses = Object.values(details).map(d => d.status);
    const overallStatus = statuses.includes('unhealthy') ? 'unhealthy' :
                         statuses.includes('degraded') ? 'degraded' :
                         statuses.includes('error') ? 'unhealthy' : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      details
    };
  } else if (healthChecks[checkType]) {
    const result = await healthChecks[checkType]();
    return {
      status: result.status,
      timestamp: new Date().toISOString(),
      responseTime: `${Date.now() - startTime}ms`,
      [checkType]: result
    };
  } else {
    throw new Error(`Unknown health check type: ${checkType}`);
  }
};

export default healthChecks;