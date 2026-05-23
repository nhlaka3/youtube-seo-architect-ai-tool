// api/war-room/orchestrator.js
// Compatibility shim — re-exports the real orchestrator at api/agent-workflows/orchestrator.js
// phronesismind.txt references this path; the actual implementation lives one level up.
export * from '../agent-workflows/orchestrator.js';
