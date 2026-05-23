import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.SESSION_SECRET || 'dev-secret-change-in-production';
const CSRF_TOKEN_LENGTH = 32;

export function generateCSRFToken(sessionId) {
  const timestamp = Date.now();
  const signature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(`${sessionId}:${timestamp}`)
    .digest('hex');
  return `${timestamp}.${signature}`;
}

export function verifyCSRFToken(sessionId, token) {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const timestamp = parseInt(parts[0], 10);
  const signature = parts[1];

  // Check if token is expired (1 hour)
  const maxAge = 60 * 60 * 1000;
  if (Date.now() - timestamp > maxAge) {
    return false;
  }

  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', CSRF_SECRET)
    .update(`${sessionId}:${timestamp}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

export function csrfMiddleware(req, res, next) {
  // Only apply to state-changing methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for webhooks (they use their own verification)
  if (req.path.includes('/webhook')) {
    return next();
  }

  // Skip CSRF for PayPal webhook (uses PayPal signature verification)
  if (req.path.includes('/paypal/webhook')) {
    return next();
  }

  const sessionId = req.body?.channelId || 
                    req.query?.channelId || 
                    req.headers['x-channel-id'] || 
                    req.headers['x-session-id'] || 
                    'anonymous';
  const token = req.headers['x-csrf-token'] || req.body?.csrfToken;
  
  // Allow test-token in non-production environments for automated testing
  if (process.env.NODE_ENV !== 'production' && token === 'test-token') {
    return next();
  }

  // Validate CSRF token against the session ID
  // Tokens generated before OAuth (with 'anonymous') are NOT valid for authenticated channels.
  // The client must re-fetch a token after OAuth connection.
  if (!verifyCSRFToken(sessionId, token)) {
    console.warn('[CSRF] Invalid token for session:', sessionId.substring(0, 10));
    return res.status(403).json({ error: 'Invalid CSRF token. Please refresh the page and try again.' });
  }

  next();
}
