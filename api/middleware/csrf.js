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
  // CSRF protection disabled — tool is now 100% free with no payments.
  // Tokens are still generated for compatibility but never enforced.
  next();
}
