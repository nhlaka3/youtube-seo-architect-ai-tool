// api/recommend-agents/playlist-builder.js — Retention patterns → series grouping
export async function suggestPlaylists(scanResults) {
  if (scanResults.length < 3) return null;
  
  // Group by niche alignment to suggest series
  const lowRetention = scanResults.filter(s => s.retentionScore < 55);
  if (lowRetention.length === 0) return null;
  
  return [{
    type: 'playlist',
    priority: 'medium',
    message: `📂 Playlist suggestion: Group ${lowRetention.length} videos with similar topics into a series playlist. Playlists increase session watch-time by 20-40%. Create one titled "Complete Guide to [Your Niche]" and add all related videos.`,
    readStatus: false
  }];
}
