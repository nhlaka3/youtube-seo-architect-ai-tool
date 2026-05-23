// cron-blog-posts.js — BLOG PUBLISHING PERMANENTLY DISABLED (2026-05-19)
// Previously: Daily cron that posted 2 SEO-optimised blog posts per day
// Route removed from api/index.js: GET /api/cron/daily-blog-posts
// This guard is the final kill-switch in case the route is ever re-enabled.

export async function dailyBlogCronHandler(req, res) {
  return res.status(410).json({
    error: 'Blog posts permanently disabled',
    message: 'Blog publishing has been permanently deactivated. No new blog posts will be generated.'
  });
}
