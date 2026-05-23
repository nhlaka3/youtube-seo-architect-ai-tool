// api/propose-agents/pre-upload-check.js — Validation checks before publishing (or for recent uploads)
export async function runPreUploadCheck(scanResult) {
  const issues = [];
  const { titleScore, descScore, tagScore, retentionScore, ctrSignal } = scanResult;
  
  if (titleScore < 50) issues.push('Title needs optimization (score: ' + titleScore + '/100)');
  if (descScore < 40) issues.push('Description too short — need 200+ words');
  if (tagScore < 40) issues.push('Tags insufficient — need 10-25 optimized tags');
  if (retentionScore < 50) issues.push('Add chapter timestamps for better retention');
  if (ctrSignal < 30) issues.push('CTR signal weak — consider thumbnail redesign');
  
  const passed = issues.length === 0;
  const confidence = passed ? 90 : Math.round(100 - issues.length * 20);
  
  return {
    videoId: scanResult.videoId,
    passed,
    issues,
    confidence,
    actionType: 'preupload',
    proposedText: passed ? 'Ready to publish' : issues.join('; '),
    rationale: passed ? 'All checks passed' : issues.length + ' issues found'
  };
}
