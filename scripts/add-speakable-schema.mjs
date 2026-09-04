#!/usr/bin/env node
/**
 * add-speakable-schema.mjs
 * Post-processor for static HTML: (1) inject SpeakableSpecification into
 * target schema blocks, (2) rewrite legacy /public/* nav links to the new
 * clean routes. Idempotent — safe to re-run. Deterministic.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { resolve, join } from 'path';

const ROOT = resolve(import.meta.dirname ?? '.', '..');
const TARGET_TYPES = new Set(['Article', 'FAQPage', 'WebApplication', 'SoftwareApplication', 'CollectionPage', 'Blog']);
const SPEAKABLE = {
  '@type': 'SpeakableSpecification',
  xpath: ['//h1', "//meta[@name='description']/@content"],
};

function walk(dir, out = []) {
  for (const e of readdirSync(dir).sort()) {
    if (e === '.git' || e === 'node_modules' || e === 'dist') continue;
    const p = join(dir, e);
    const s = statSyncQuiet(p);
    if (!s) continue;
    if (s.isDirectory()) walk(p, out);
    else if (e.endsWith('.html')) out.push(p);
  }
  return out;
}
const statSyncQuiet = (p) => { try { return statSync(p); } catch { return null; } };

function addSpeakable(node) {
  const t = node['@type'];
  const types = Array.isArray(t) ? t : [t];
  if (!types.some((x) => TARGET_TYPES.has(x))) return false;
  if (node.speakable) return false;
  node.speakable = SPEAKABLE;
  return true;
}

function processBlock(raw) {
  let data;
  try { data = JSON.parse(raw); } catch { return null; }
  let changed = false;
  if (Array.isArray(data)) {
    for (const item of data) if (item && typeof item === 'object') changed = addSpeakable(item) || changed;
  } else if (data && typeof data === 'object') {
    if (Array.isArray(data['@graph'])) {
      for (const n of data['@graph']) changed = addSpeakable(n) || changed;
    } else {
      changed = addSpeakable(data);
    }
  }
  return changed ? JSON.stringify(data, null, 2) : null;
}

const LINK_FIXES = [
  ['/public/guides', '/tools'],
  ['/public/glossary', '/glossary'],
  ['/public/niches', '/blog'],
  ['/public/vs', '/vs'],
  ['/public/tools', '/tools'],
  ['/public/blog', '/blog'],
];

function rewriteLinks(html) {
  let out = html, changed = false;
  for (const [from, to] of LINK_FIXES) {
    const re = new RegExp(`(href|src)=["']${from}/?["']`, 'g');
    const next = out.replace(re, (_m, attr) => { changed = true; return `${attr}="${to}/"`; });
    out = next;
  }
  return changed ? out : null;
}

let files = 0, blocks = 0, links = 0;
const targets = [...walk(resolve(ROOT, 'public')), ...walk(resolve(ROOT)).filter((p) => !p.includes('/public/') && p.endsWith('.html'))];
for (const file of targets) {
  let html = readFileSync(file, 'utf8');
  let dirty = false;
  // 1. speakable injection
  html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (_m, raw) => {
    const out = processBlock(raw);
    if (out) { blocks++; dirty = true; }
    return out ? `<script type="application/ld+json">\n${out}\n</script>` : _m;
  });
  // 2. /public/* link rewrite
  const relinked = rewriteLinks(html);
  if (relinked) { html = relinked; links++; dirty = true; }
  if (dirty) writeFileSync(file, html);
  files++;
}
console.log(`scanned ${files} html files · speakable injected in ${blocks} blocks · links fixed in ${links} files`);