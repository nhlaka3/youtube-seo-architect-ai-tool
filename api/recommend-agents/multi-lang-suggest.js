// api/recommend-agents/multi-lang-suggest.js — Translation opportunity alerts
export async function suggestMultiLang(scanResults) {
  const highViewers = scanResults.filter(s => s.views > 500);
  if (highViewers.length === 0) return null;
  
  return [{
    type: 'multilang',
    priority: 'low',
    message: `🌐 Multi-language tip: ${highViewers.length} videos have good traction. Consider adding subtitles in Spanish, Hindi, or Portuguese — YouTube auto-translates and expands your TAM. Start with your top 3 videos.`,
    readStatus: false
  }];
}
