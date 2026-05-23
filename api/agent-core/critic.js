// api/agent-core/critic.js — LAYER 3: Multi-Agent Architecture — Critic Sub-agent
// Reviews PROPOSE items before they hit the inbox
// Checks against agent_rules table, rejects redundant or high-risk proposals
// Integrates: phronesismind.txt Phase 3

/**
 * Validate a proposal before it reaches the inbox
 * Returns { approved, rejected, warnings, flags }
 */
export async function validateProposal(proposal, existingProposals = []) {
  const result = {
    approved: true,
    rejected: false,
    warnings: [],
    flags: [],
    rejectionReason: null
  };

  // ── CHECK 1: Redundancy — is this a duplicate of an existing proposal? ──
  const isDuplicate = existingProposals.some(p => 
    p.videoId === proposal.videoId && 
    p.actionType === proposal.actionType &&
    p.status !== 'skipped'
  );

  if (isDuplicate) {
    result.rejected = true;
    result.rejectionReason = `Duplicate: Already have a ${proposal.actionType} proposal for video ${proposal.videoId}`;
    result.flags.push('duplicate');
    return result;
  }

  // ── CHECK 2: Same video recently skipped? ──
  const recentlySkipped = existingProposals.some(p =>
    p.videoId === proposal.videoId &&
    p.actionType === proposal.actionType &&
    p.status === 'skipped' &&
    (Date.now() - new Date(p.updatedAt || p.createdAt).getTime()) < 7 * 86400000 // 7 days
  );

  if (recentlySkipped) {
    result.warnings.push(`Similar proposal for ${proposal.videoId} was skipped within 7 days — user may not want this`);
    result.flags.push('recently_skipped');
  }

  // ── CHECK 3: Confidence too low? ──
  if (proposal.confidence < 25) {
    result.rejected = true;
    result.rejectionReason = `Confidence too low: ${proposal.confidence}% (minimum: 25%)`;
    result.flags.push('low_confidence');
    return result;
  } else if (proposal.confidence < 40) {
    result.warnings.push(`Low confidence (${proposal.confidence}%) — consider manual review`);
    result.flags.push('low_confidence_warn');
  }

  // ── CHECK 4: Proposed text identical to current? ──
  if (proposal.proposedText && proposal.currentText && 
      proposal.proposedText.trim() === proposal.currentText.trim()) {
    result.rejected = true;
    result.rejectionReason = 'No change: Proposed text is identical to current';
    result.flags.push('no_change');
    return result;
  }

  // ── CHECK 5: Title length compliance ──
  if (proposal.actionType === 'title' && proposal.proposedText) {
    if (proposal.proposedText.length > 100) {
      result.rejected = true;
      result.rejectionReason = `Title too long: ${proposal.proposedText.length} chars (max 100)`;
      result.flags.push('title_too_long');
      return result;
    }
    if (proposal.proposedText.length < 15) {
      result.warnings.push(`Title very short (${proposal.proposedText.length} chars) — may lack keyword coverage`);
      result.flags.push('title_short');
    }
  }

  // ── CHECK 6: Tag count compliance ──
  if (proposal.actionType === 'tags' && Array.isArray(proposal.proposedText)) {
    if (proposal.proposedText.length < 3) {
      result.warnings.push('Very few tags — should have at least 5 for optimal reach');
      result.flags.push('few_tags');
    }
    if (proposal.proposedText.some(t => /\s/.test(t))) {
      result.rejected = true;
      result.rejectionReason = 'Tags contain spaces — YouTube tags cannot have spaces';
      result.flags.push('invalid_tags');
      return result;
    }
    if (proposal.proposedText.some(t => t.length > 50)) {
      result.warnings.push('Some tags exceed 50 characters — may be truncated');
      result.flags.push('long_tags');
    }
  }

  // ── CHECK 7: Description length ──
  if (proposal.actionType === 'description' && proposal.proposedText) {
    if (proposal.proposedText.length < 100) {
      result.warnings.push('Description very short — YouTube recommends 200+ words for SEO');
      result.flags.push('short_description');
    }
    if (proposal.proposedText.length > 5000) {
      result.rejected = true;
      result.rejectionReason = 'Description exceeds 5000 byte YouTube limit';
      result.flags.push('description_too_long');
      return result;
    }
  }

  // ── CHECK 8: Sensitive content check ──
  const sensitivePatterns = [
    /\b(?:hate|violence|explicit|nsfw|gambling|casino)\b/i,
  ];
  for (const pattern of sensitivePatterns) {
    if (pattern.test(proposal.proposedText || '') || pattern.test(proposal.videoTitle || '')) {
      result.warnings.push('Content may contain sensitive topics — review manually');
      result.flags.push('sensitive_content');
      break;
    }
  }

  // ── CHECK 9: Load dynamic rules from agent_rules table ──
  try {
    const { default: dbService } = await import('../../src/database/services.js');
    const rules = await dbService.getActiveRules();
    
    for (const rule of rules) {
      try {
        // Evaluate simple conditions
        const conditionMet = evaluateRuleCondition(rule.condition, proposal);
        if (conditionMet) {
          if (rule.action === 'reject') {
            result.rejected = true;
            result.rejectionReason = `Rule violation: ${rule.ruleName}`;
            result.flags.push(`rule_${rule.ruleName}`);
            return result;
          } else if (rule.action === 'warn') {
            result.warnings.push(`Rule check: ${rule.ruleName} — ${rule.description || ''}`);
            result.flags.push(`rule_${rule.ruleName}`);
          }
        }
      } catch (e) { /* skip malformed rules */ }
    }
  } catch (e) { /* rules table may not exist yet */ }

  return result;
}

/**
 * Evaluate a simple rule condition against a proposal
 * Supports basic comparisons: confidence>80, actionType==title, etc.
 */
function evaluateRuleCondition(condition, proposal) {
  if (!condition) return false;

  // Parse: "confidence<30"
  const match = condition.match(/^(\w+)([<>=!]+)(.+)$/);
  if (!match) return false;

  const [, field, operator, value] = match;
  const proposalValue = proposal[field];

  const numValue = parseFloat(value);
  const numProposal = parseFloat(proposalValue);

  switch (operator) {
    case '>': return numProposal > numValue;
    case '<': return numProposal < numValue;
    case '>=': return numProposal >= numValue;
    case '<=': return numProposal <= numValue;
    case '==': return String(proposalValue) === value.trim();
    case '!=': return String(proposalValue) !== value.trim();
    default: return false;
  }
}

/**
 * Batch validate multiple proposals
 * Returns only approved ones with warnings attached
 */
export async function batchValidate(proposals, existingProposals = []) {
  const results = [];
  for (const proposal of proposals) {
    const validation = await validateProposal(proposal, existingProposals);
    if (validation.approved && !validation.rejected) {
      results.push({
        ...proposal,
        criticWarnings: validation.warnings,
        criticFlags: validation.flags
      });
    }
    // Rejected proposals are silently dropped
  }
  return results;
}

/**
 * Seed default critic rules into the database
 */
export async function seedDefaultRules() {
  const defaultRules = [
    {
      ruleName: 'min_confidence',
      description: 'Reject proposals with confidence below 25%',
      condition: 'confidence<25',
      action: 'reject',
      priority: 1
    },
    {
      ruleName: 'title_max_length',
      description: 'Reject titles exceeding 100 characters',
      condition: 'proposedText.length>100',
      action: 'reject',
      priority: 1
    },
    {
      ruleName: 'no_change_proposals',
      description: 'Warn when proposed text matches current',
      condition: 'isIdentical==true',
      action: 'reject',
      priority: 2
    },
    {
      ruleName: 'low_confidence_warning',
      description: 'Flag proposals below 40% confidence for review',
      condition: 'confidence<40',
      action: 'warn',
      priority: 3
    },
    {
      ruleName: 'sensitive_content_alert',
      description: 'Flag proposals containing sensitive topics',
      condition: 'hasSensitiveContent==true',
      action: 'warn',
      priority: 2
    }
  ];

  try {
    const { default: dbService } = await import('../../src/database/services.js');
    for (const rule of defaultRules) {
      await dbService.insertRule(rule).catch(() => {}); // Ignore duplicates
    }
    return { seeded: defaultRules.length };
  } catch (e) {
    return { error: e.message };
  }
}
