#!/usr/bin/env node
// scripts/submit-sitemap-gsc.mjs — corrected Search Console API v3

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createSign } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

function loadKey() {
  const p = resolve(ROOT, 'config/google-indexing-key.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : null;
}

async function getToken(key, scope) {
  const now = Math.floor(Date.now() / 1000);
  const b64 = s => Buffer.from(JSON.stringify(s)).toString('base64url');
  const jwt = [b64({ alg: 'RS256', typ: 'JWT' }), b64({ iss: key.client_email, scope, aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })].join('.');
  const sign = createSign('RSA-SHA256');
  sign.update(jwt);
  const sig = sign.sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}.${sig}`,
  });
  const d = await res.json();
  if (!d.access_token) throw new Error(`Auth failed: ${JSON.stringify(d)}`);
  return d.access_token;
}

async function main() {
  const key = loadKey();
  if (!key) { console.log('❌ No key'); return; }

  const token = await getToken(key, 'https://www.googleapis.com/auth/webmasters');
  console.log('✅ Authenticated\n');

  // List all sites in Search Console
  const sitesRes = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const sites = await sitesRes.json();
  console.log(`📋 Search Console sites (HTTP ${sitesRes.status}):`);
  if (sites.siteEntry) {
    for (const s of sites.siteEntry) {
      console.log(`   ${s.siteUrl} — ${s.permissionLevel || 'N/A'}`);
    }
  } else {
    console.log(`   ${JSON.stringify(sites).slice(0, 300)}`);
  }

  // For each listed site, try submitting the sitemap
  const SITEMAP = 'https://yt-seo-architect.vercel.app/sitemap.xml';
  if (sites.siteEntry) {
    for (const s of sites.siteEntry) {
      const siteUrl = s.siteUrl;
      const feedpath = encodeURIComponent(SITEMAP);
      const encodedSite = encodeURIComponent(siteUrl);

      console.log(`\n📡 Submitting sitemap to ${siteUrl}...`);
      const res = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps/${feedpath}`,
        { method: 'PUT', headers: { Authorization: `Bearer ${token}` } }
      );
      console.log(`   HTTP ${res.status} ${res.statusText}`);

      if (res.ok) {
        console.log('   ✅ Sitemap submitted!');
        // Check status
        const listRes = await fetch(
          `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/sitemaps`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const list = await listRes.json();
        if (list.sitemap) {
          for (const sm of list.sitemap) {
            console.log(`   📊 ${sm.path}: ${sm.contents || 0} URLs submitted, ${sm.warnings || 0} warnings, ${sm.errors || 0} errors`);
          }
        }
      } else {
        const err = await res.text().catch(() => '');
        console.log(`   ❌ ${err.slice(0, 200)}`);
      }
    }
  }
}

main().catch(e => { console.error('Fatal:', e); });
