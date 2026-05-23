// src/monitoring/logger.js
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { captureMessage, captureError } from './sentry.js';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };

    if (stack) {
      logEntry.stack = stack;
    }

    return JSON.stringify(logEntry);
  })
);

// Create log directory if it doesn't exist (only if not on Vercel)
import fs from 'fs';
const logDir = 'logs';
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL;

if (!isVercel && !fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (e) {
    console.warn('Failed to create log directory:', e.message);
  }
}

const transports = [
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${level}: ${message}${metaStr}`;
      })
    )
  })
];

// Only add file rotation if not on Vercel
if (!isVercel) {
  transports.push(
    new DailyRotateFile({
      filename: `${logDir}/app-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'info',
      format: logFormat
    }),
    new DailyRotateFile({
      filename: `${logDir}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error',
      format: logFormat
    })
  );
}


const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports,
  exceptionHandlers: isVercel ? [] : [
    new DailyRotateFile({
      filename: `${logDir}/exceptions-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ],
  rejectionHandlers: isVercel ? [] : [
    new DailyRotateFile({
      filename: `${logDir}/rejections-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});


// Custom logging methods with Sentry integration
logger.request = (req, res, extra = {}) => {
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || '';
  const channelId = req.channelId || req.body?.channelId || req.query?.channelId;

  logger.info('API Request', {
    method,
    url,
    ip,
    userAgent: userAgent.substring(0, 200), // Truncate long user agents
    channelId,
    ...extra
  });
};

logger.apiCall = (service, operation, success, duration, extra = {}) => {
  const level = success ? 'info' : 'error';
  const message = success ? 'API Call Success' : 'API Call Failed';

  logger.log(level, message, {
    service,
    operation,
    success,
    duration: `${duration}ms`,
    ...extra
  });

  // Send to Sentry for errors
  if (!success) {
    captureMessage(`${service} ${operation} failed`, 'error', {
      extra: {
        service,
        operation,
        duration,
        ...extra
      }
    });
  }
};

logger.business = (event, userId, extra = {}) => {
  logger.info('Business Event', {
    event,
    userId,
    ...extra
  });
};

logger.security = (event, severity = 'info', extra = {}) => {
  const level = severity === 'critical' ? 'error' : severity === 'warning' ? 'warn' : 'info';

  logger.log(level, 'Security Event', {
    event,
    severity,
    ...extra
  });

  // Send security events to Sentry
  if (severity === 'critical' || severity === 'high') {
    captureMessage(`Security: ${event}`, 'error', {
      tags: { category: 'security', severity },
      extra
    });
  }
};

export default logger;