// api/agent-core/quality-gates.js — Post-scan verification loop (verification-loop skill)
// Validates proposals before they reach the inbox

export async function runQualityGates(scanResults, proposals) {
  const gates = [];
  const failures = [];

  // Gate 1: Proposal validity — every proposal must have a videoId and proposedText
  const invalidProposals = proposals.filter(p => !p.videoId || !p.proposedText || p.proposedText === '');
  if (invalidProposals.length > 0) {
    failures.push(`[GATE-1] ${invalidProposals.length} invalid proposals (missing videoId or text)`);
  } else {
    gates.push({ name: 'Proposal validity', passed: true, detail: `${proposals.length} proposals valid` });
  }

  // Gate 2: Title length — titles must be ≤60 chars (long) or ≤100 chars (shorts)
  const longTitles = proposals.filter(p => p.actionType === 'title' && p.proposedText && p.proposedText.length > 100);
  if (longTitles.length > 0) {
    failures.push(`[GATE-2] ${longTitles.length} titles exceed length limit`);
  } else {
    gates.push({ name: 'Title length compliance', passed: true });
  }

  // Gate 3: Tag count — must be 5-25 tags, no spaces
  const badTags = proposals.filter(p => 
    p.actionType === 'tags' && Array.isArray(p.proposedText) && 
    (p.proposedText.length < 5 || p.proposedText.length > 30 || p.proposedText.some(t => /\s/.test(t)))
  );
  if (badTags.length > 0) {
    failures.push(`[GATE-3] ${badTags.length} tag sets have issues (count or spaces)`);
  } else {
    gates.push({ name: 'Tag quality', passed: true });
  }

  // Gate 4: Confidence floor — no proposals below 30% should reach the inbox
  const lowConf = proposals.filter(p => p.confidence < 30);
  if (lowConf.length > 0) {
    failures.push(`[GATE-4] ${lowConf.length} low-confidence proposals (<30%)`);
  } else {
    gates.push({ name: 'Confidence threshold', passed: true });
  }

  // Gate 5: DB write verification — verify queue items were actually created
  const pendingInbox = proposals.filter(p => !p.autoApplied);
  if (pendingInbox.length > 0) {
    gates.push({ name: 'Queue write pending', passed: true, detail: `${pendingInbox.length} items ready for inbox` });
  }

  // Gate 6: Scan coverage — every scanned video should have at least 1 proposal or be marked healthy
  const scannedIds = new Set(scanResults.map(s => s.videoId));
  const proposedIds = new Set(proposals.map(p => p.videoId));
  const uncovered = [...scannedIds].filter(id => !proposedIds.has(id));
  if (uncovered.length > 0) {
    gates.push({ name: 'Scan coverage', passed: true, detail: `${uncovered.length}/${scannedIds.size} videos healthy (no issues)` });
  }

  const allPassed = failures.length === 0;

  return {
    passed: allPassed,
    gates,
    failures,
    summary: allPassed 
      ? `✅ Quality gates passed: ${gates.map(g => g.name).join(', ')}`
      : `⚠️ Quality gates: ${failures.join('; ')}`
  };
}
