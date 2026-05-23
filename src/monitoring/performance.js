// src/monitoring/performance.js
import { captureMessage } from './sentry.js';
import logger from './logger.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.requestCounts = new Map();
    this.errorCounts = new Map();
  }

  startTimer(name, id = null) {
    const timerId = id || `${name}_${Date.now()}`;
    this.metrics.set(timerId, {
      name,
      startTime: process.hrtime.bigint(),
      startMemory: process.memoryUsage()
    });
    return timerId;
  }

  endTimer(timerId) {
    const metric = this.metrics.get(timerId);
    if (!metric) return null;

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    const duration = Number(endTime - metric.startTime) / 1_000_000; // Convert to milliseconds
    const memoryDelta = endMemory.heapUsed - metric.startMemory.heapUsed;

    const result = {
      name: metric.name,
      duration,
      memoryDelta,
      timestamp: Date.now()
    };

    this.metrics.delete(timerId);

    // Log slow operations
    if (duration > 1000) { // 1 second
      logger.warn('Slow Operation Detected', {
        operation: metric.name,
        duration: `${duration.toFixed(2)}ms`,
        memoryDelta: `${(memoryDelta / 1024 / 1024).toFixed(2)}MB`
      });

      captureMessage(`Slow operation: ${metric.name}`, 'warning', {
        extra: {
          duration,
          memoryDelta
        }
      });
    }

    return result;
  }

  recordRequest(endpoint, method, statusCode, duration) {
    const key = `${method}_${endpoint}`;
    this.requestCounts.set(key, (this.requestCounts.get(key) || 0) + 1);

    // Track response time percentiles
    if (!this.metrics.has(`${key}_responses`)) {
      this.metrics.set(`${key}_responses`, []);
    }
    const responses = this.metrics.get(`${key}_responses`);
    responses.push({ statusCode, duration, timestamp: Date.now() });

    // Keep only last 100 responses for memory efficiency
    if (responses.length > 100) {
      responses.shift();
    }

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      logger.warn('Slow Request Detected', {
        endpoint,
        method,
        statusCode,
        duration: `${duration.toFixed(2)}ms`
      });
    }
  }

  recordError(endpoint, method, error, context = {}) {
    const key = `${method}_${endpoint}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);

    logger.error('API Error Recorded', {
      endpoint,
      method,
      error: error.message,
      stack: error.stack?.substring(0, 500), // Truncate stack traces
      ...context
    });
  }

  getMetrics() {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();

    return {
      uptime,
      memory: {
        rss: `${(memoryUsage.rss / 1024 / 1024).toFixed(2)}MB`,
        heapTotal: `${(memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`,
        heapUsed: `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
        external: `${(memoryUsage.external / 1024 / 1024).toFixed(2)}MB`
      },
      activeRequests: this.metrics.size,
      errorRates: Object.fromEntries(this.errorCounts)
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Express middleware for request performance monitoring
export const performanceMiddleware = (req, res, next) => {
  const timerId = performanceMonitor.startTimer(`request_${req.method}_${req.path}`);

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function(...args) {
    const result = performanceMonitor.endTimer(timerId);
    if (result) {
      performanceMonitor.recordRequest(
        req.path,
        req.method,
        res.statusCode,
        result.duration
      );
    }
    originalEnd.apply(this, args);
  };

  // Capture errors
  const originalSend = res.send;
  res.send = function(body) {
    // If response body contains error, record it
    if (res.statusCode >= 400 && body) {
      try {
        const errorData = typeof body === 'string' ? JSON.parse(body) : body;
        if (errorData.error) {
          performanceMonitor.recordError(req.path, req.method, new Error(errorData.error), {
            statusCode: res.statusCode,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    return originalSend.call(this, body);
  };

  next();
};

// Database operation performance wrapper
export const withPerformanceMonitoring = (operationName, operation) => {
  return async (...args) => {
    const timerId = performanceMonitor.startTimer(`db_${operationName}`);
    try {
      const result = await operation(...args);
      const metrics = performanceMonitor.endTimer(timerId);
      logger.apiCall('database', operationName, true, metrics?.duration || 0, {
        args: args.map(arg => typeof arg === 'object' ? '[OBJECT]' : arg)
      });
      return result;
    } catch (error) {
      const metrics = performanceMonitor.endTimer(timerId);
      logger.apiCall('database', operationName, false, metrics?.duration || 0, {
        error: error.message,
        args: args.map(arg => typeof arg === 'object' ? '[OBJECT]' : arg)
      });
      throw error;
    }
  };
};

export default performanceMonitor;