# main.js Decomposition Phase 3 — Implementation Plan

> Execute immediately using bridge pattern (same as Phase 2)

**Goal:** Create 6 module boundary files for advanced tools. Bridge pattern — re-export from legacy `window.*` globals. Aliased imports in main.js to avoid name collisions.

**Modules:**

| File | Exports |
|------|---------|
| `js/modules/growth.js` | `GrowthEngine`, `loadGrowthReport`, `OptimizationInbox` |
| `js/modules/dashboard.js` | `loadPhronesis`, `loadScanResults`, `loadRecommendations`, `loadNeuralStrategy` |
| `js/modules/tools.js` | `runThumbnailRedesign`, `sidebarSniper`, `scriptToShorts`, `generateChapters` |
| `js/modules/pipeline.js` | `runAutoFlow`, `PIPELINE_CONFIG`, `generateWeave`, `generateCollusionTags` |
| `js/modules/retention.js` | `loadRetentionData`, `reorderPlaylistOnYoutube`, `toggleCoachDrawer`, `sendArchitectMessage` |
| `js/modules/ai-tools.js` | `loadTrendPulse`, `generateCommunityPost`, `generateMultiLanguageSEO`, `generateAILabel` |
