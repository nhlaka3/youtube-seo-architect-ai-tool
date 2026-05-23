// api/middleware/admin-guard.js — Admin isolation middleware
export function requireAdmin(req, res, next) {
  const adminToken = req.headers['x-admin-token'] || req.query.admin;
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return res.status(500).json({ error: 'Admin system not configured' });
  if (adminToken !== secret) return res.status(401).json({ error: 'Admin authorization required' });
  req.isAdmin = true;
  next();
}
