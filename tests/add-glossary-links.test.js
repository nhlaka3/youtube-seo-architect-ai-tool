// Regression test for add-glossary-links.mjs
// Guards against the RangeError: Invalid string length bug where string
// replacements expanded "$1,000"-style text into capture group 1 (the whole
// article), corrupting dollar figures and exploding output past V8's ~536MB
// string limit on large posts.
// Run with: node --test tests/add-glossary-links.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addGlossaryLinks } from '../scripts/add-glossary-links.mjs';

function makePost(size = 20000) {
  // Article with glossary terms AND dollar figures (the bug trigger)
  const sentence =
    'Watch Time and CTR drive YouTube Algorithm impressions. ' +
    'Creators earn $1,000/mo or $10,000/yr from Ad Revenue. ';
  let body = '';
  while (body.length < size) body += sentence;
  return (
    '<!DOCTYPE html><html><head><title>Test Post</title></head><body>' +
    '<article>' +
    body +
    '<a href="/blog/other">see the $1,000 plan</a>' +
    '</article></body></html>'
  );
}

describe('addGlossaryLinks', () => {
  it('adds glossary links and preserves dollar figures', () => {
    const out = addGlossaryLinks(makePost());
    assert.ok(out.includes('glossary-link'), 'should add glossary links');
    assert.ok(out.includes('$1,000'), 'should preserve $1,000');
    assert.ok(out.includes('$10,000'), 'should preserve $10,000');
    assert.ok(out.includes('</html>'), 'should keep valid structure');
  });

  it('preserves dollar figures inside existing links (restore loop)', () => {
    const out = addGlossaryLinks(makePost(1000));
    assert.ok(
      out.includes('>see the $1,000 plan</a>'),
      'link text containing $1,000 must survive untouched'
    );
  });

  it('handles a large post without throwing (RangeError regression)', () => {
    // ~400KB article with thousands of dollar patterns — crashed the old code
    assert.doesNotThrow(() => addGlossaryLinks(makePost(400000)));
  });

  it('is idempotent-ish: no crash when post already has glossary links', () => {
    const once = addGlossaryLinks(makePost(20000));
    assert.doesNotThrow(() => addGlossaryLinks(once));
  });
});
