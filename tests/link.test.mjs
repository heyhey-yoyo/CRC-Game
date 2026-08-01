import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlFiles = ['index.html', '404.html', 'pages/methods.html', 'pages/references.html', 'pages/privacy.html', 'pages/accessibility.html'];

test('all local HTML links and asset references resolve', () => {
  const missing = [];
  for (const relative of htmlFiles) {
    const full = path.join(root, relative);
    const source = fs.readFileSync(full, 'utf8');
    for (const match of source.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const value = match[1];
      if (!value || value.startsWith('#') || value.startsWith('http:') || value.startsWith('https:') || value.startsWith('mailto:') || value.startsWith('data:') || value.startsWith('/')) continue;
      const clean = value.split(/[?#]/)[0];
      if (!clean) continue;
      const target = path.resolve(path.dirname(full), clean);
      if (!fs.existsSync(target)) missing.push(`${relative} -> ${value}`);
    }
  }
  assert.deepEqual(missing, []);
});
