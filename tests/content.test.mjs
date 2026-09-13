import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateContent } from '../scripts/validate-content.mjs';

test('versioned content bundle passes production validation', () => {
  const content = validateContent();
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(content.manifest.appVersion, pkg.version);
  assert.equal(content.manifest.status, 'public-preview');
  assert.equal(content.cases[0].assessmentWeek, 8);
  assert.equal(content.evidence.items.length >= 7, true);
});

test('clinical status, mechanism and game boundaries are separate fields', () => {
  const content = validateContent();
  for (const pathway of content.pathways.pathways) {
    assert.ok(pathway.clinicalStatus);
    assert.ok(pathway.mechanism.length);
    assert.ok(pathway.gameBoundary);
  }
});
