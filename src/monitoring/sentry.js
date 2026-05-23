// src/monitoring/sentry.js
import * as Sentry from '@sentry/node';


export const initSentry = () => {
  const dsn = process.env.SENTRY_DSN;
  const environment = process.env.NODE_ENV || 'development';

  if (!dsn) {
    console.warn('[Sentry] SENTRY_DSN not configured, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,
    profilesSampleRate: environment === 'production' ? 0.1 : 1.0,
    beforeSend(event, hint) {
      // Securely filter out sensitive data and log errors without it
      if (event.request?.data) {
        // Remove API keys, tokens, etc.
        const data = event.request.data;
        if (typeof data === 'string') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.accessToken) parsed.accessToken = '[REDACTED]';
            if (parsed.apiKey) parsed.apiKey = '[REDACTED]';
            event.request.data = JSON.stringify(parsed);
          } catch (e) {
            // Not JSON, leave as is
          }
        }
      }
      return event;
    },
  });

  // Sentry initialized
};

export const captureError = (error, context = {}) => {
  Sentry.withScope((scope) => {
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    if (context.extra) {
      Object.entries(context.extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    Sentry.captureException(error);
  });
};

export const captureMessage = (message, level = 'info', context = {}) => {
  Sentry.withScope((scope) => {
    scope.setLevel(level);
    if (context.userId) scope.setUser({ id: context.userId });
    if (context.tags) {
      Object.entries(context.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }
    Sentry.captureMessage(message);
  });
};

export const setUser = (user) => {
  Sentry.setUser(user);
};

export const addBreadcrumb = (breadcrumb) => {
  Sentry.addBreadcrumb(breadcrumb);
};