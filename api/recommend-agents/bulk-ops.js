// api/recommend-agents/bulk-ops.js — Batch strategy recommendations
export async function suggestBulkOps(scanResults) {
  const total = scanResults.length;
  if (total < 2) return null;
  
  const weakTitles = scanResults.filter(s => s.titleScore < 50).length;
  const weakTags = scanResults.filter(s => s.tagScore < 50).length;
  const weakDesc = scanResults.filter(s => s.descScore < 50).length;
  
  const items = [];
  
  if (weakTitles > 2) {
    items.push({
      type: 'bulk',
      priority: 'high',
      message: `📊 Bulk opportunity: ${weakTitles}/${total} videos have weak titles (score <50). Consider bulk title optimization using the Bulk Injector — review each one before applying.`,
      readStatus: false
    });
  }
  
  if (weakTags > 3) {
    items.push({
      type: 'bulk',
      priority: 'medium',
      message: `📊 ${weakTags}/${total} videos need tag improvements. Check the Tag Generator tool to batch-optimize your tag strategy.`,
      readStatus: false
    });
  }
  
  return items.length > 0 ? items : null;
}
