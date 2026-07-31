/**
 * scripts/affiliate-mapper-lib.mjs
 *
 * Shared library for affiliate link injection.
 * Used by both affiliate-mapper.js (batch processing) and
 * auto-blog-generator.mjs (single-post injection).
 *
 * Exported: injectAffiliateLinks(html, config)
 */

/**
 * Inject affiliate links into HTML content.
 * @param {string} html - The blog post HTML
 * @param {Object} config - The affiliate-mapper.json config
 * @returns {{ html: string, linksAdded: number, addedKeywords: string[] }}
 */
export function injectAffiliateLinks(html, config) {
  const settings = config.settings;
  const keywords = Object.keys(config.keywords);
  const maxLinks = settings.maxLinksPerPost || 5;
  const minDistance = settings.minWordDistance || 50;

  // Sort keywords by length (longest first) to match "editing software" before "editing"
  const sorted = keywords.sort((a, b) => b.length - a.length);

  let linksAdded = 0;
  let lastLinkPosition = -minDistance * 8;
  const addedKeywords = new Set();

  for (const keyword of sorted) {
    if (linksAdded >= maxLinks) break;
    if (addedKeywords.has(keyword.toLowerCase())) continue;

    const mapping = config.keywords[keyword];
    const anchor = mapping.anchor || keyword;

    // Build regex: match keyword case-insensitively
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');

    let match;
    while ((match = regex.exec(html)) !== null) {
      if (linksAdded >= maxLinks) break;

      const pos = match.index;

      // Check minimum distance from last link (rough word-count heuristic)
      if (pos - lastLinkPosition < minDistance * 8) continue;

      // Check if already inside an <a> tag
      const beforeTag = html.slice(Math.max(0, pos - 200), pos);
      const lastOpenA = beforeTag.lastIndexOf('<a ');
      const lastCloseA = beforeTag.lastIndexOf('</a>');
      if (lastOpenA > lastCloseA) continue;

      // Check if inside a heading (h1, h2, h3)
      const beforeHeading = html.slice(Math.max(0, pos - 500), pos);
      const lastH2 = beforeHeading.lastIndexOf('<h2');
      const lastH3 = beforeHeading.lastIndexOf('<h3');
      const lastH1 = beforeHeading.lastIndexOf('<h1');
      const lastCloseH = beforeHeading.lastIndexOf('</h');
      if ((lastH2 > lastCloseH || lastH3 > lastCloseH || lastH1 > lastCloseH) &&
          !html.slice(pos).includes('</h')) continue;

      // Check if inside <title> or <meta>
      const beforeMeta = html.slice(Math.max(0, pos - 1000), pos);
      if (beforeMeta.includes('<title>') && !beforeMeta.includes('</title>')) continue;

      // Check if already linked (this keyword)
      if (addedKeywords.has(keyword.toLowerCase())) continue;

      // Check surrounding context for existing href
      const surrounding = html.slice(Math.max(0, pos - 10), pos + match[0].length + 10);
      if (surrounding.includes('href=')) continue;

      // Inject the link
      const rel = [
        settings.nofollow ? 'nofollow' : '',
        settings.sponsored ? 'sponsored' : '',
      ].filter(Boolean).join(' ');

      const linkClass = settings.linkClass || 'affiliate-link';
      const replacement = `<a href="${mapping.url}" class="${linkClass}" rel="${rel}" title="${mapping.product}">${match[0]}</a>`;

      html = html.slice(0, pos) + replacement + html.slice(pos + match[0].length);

      linksAdded++;
      lastLinkPosition = pos;
      addedKeywords.add(keyword.toLowerCase());

      // Update regex position after insertion
      regex.lastIndex = pos + replacement.length;

      break; // Move to next keyword (only first occurrence per keyword)
    }
  }

  return { html, linksAdded, addedKeywords: [...addedKeywords] };
}
