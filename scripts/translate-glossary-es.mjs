#!/usr/bin/env node
/**
 * scripts/translate-glossary-es.mjs
 *
 * Backward-compatible wrapper: translates glossary to Spanish.
 * The canonical implementation is translate-glossary.mjs --lang es
 * (adds expandedDefinition translation + provider fallback).
 *
 * Usage (same as before):
 *   node scripts/translate-glossary-es.mjs             # Translate all terms
 *   node scripts/translate-glossary-es.mjs --dry-run   # Preview without saving
 */

import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const PROJECT = resolve(dirname(__filename), '..');

const args = process.argv.slice(2);
const result = spawnSync(
  process.execPath,
  [resolve(PROJECT, 'scripts', 'translate-glossary.mjs'), '--lang', 'es', ...args],
  { stdio: 'inherit', env: process.env }
);
process.exit(result.status ?? 1);
