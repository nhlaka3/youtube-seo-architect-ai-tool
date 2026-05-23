// api/[...path].js — Vercel-native catch-all for all /api/* sub-paths
// This is the OFFICIAL Vercel pattern for Express sub-path routing.
// It receives ALL requests under /api/ and forwards them to the Express app.
// The `path` param captures the full sub-path (e.g., "agent/trigger").

import app from './index.js';

// Vercel invokes this as a serverless function handler.
// Express app handles the actual routing internally.
export default app;
