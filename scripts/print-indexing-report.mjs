#!/usr/bin/env node
// scripts/print-indexing-report.mjs — reads indexing report JSON, prints formatted summary
// Usage: node scripts/print-indexing-report.mjs [path]
// Default: public/indexing-report.json

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const reportPath = process.argv[2] || resolve(__dirname, '../public/indexing-report.json');

if (!existsSync(reportPath)) {
  console.log('No indexing report found. Run check-indexing.mjs first.');
  process.exit(0);
}

const d = JSON.parse(readFileSync(reportPath, 'utf-8'));
console.log('════════════════════════════════════════════');
console.log('  🔍 INDEXING CHECK REPORT');
console.log('════════════════════════════════════════════');
console.log(`  Total URLs:  ${d.total}`);
console.log(`  Checked:     ${d.checked}`);
console.log(`  ✅ Live:     ${d.live}`);
console.log(`  🔄 Redirect: ${d.redirect}`);
console.log(`  ❌ Dead:     ${d.dead}`);
console.log(`  ⚠️  Errors:  ${d.errors}`);
console.log('');
console.log('  By type:');
for (const [t, c] of Object.entries(d.byType || {}).sort()) {
  const pct = c.total > 0 ? Math.round(c.live / c.total * 100) : 0;
  const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
  console.log(`    ${t.padEnd(22)} ${bar} ${c.live}/${c.total} (${pct}%)`);
}
if (d.notFound && d.notFound.length > 0) {
  console.log('');
  console.log(`  ❌ 404 URLs (${d.notFound.length}):`);
  for (const u of d.notFound.slice(0, 10)) console.log(`    ${u}`);
  if (d.notFound.length > 10) console.log(`    ... and ${d.notFound.length - 10} more`);
}
console.log('');
console.log(`  Report timestamp: ${d.timestamp || 'N/A'}`);
