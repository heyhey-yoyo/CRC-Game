import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('build script defines a clean deploy directory and standalone output', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/build.mjs'), 'utf8');
  assert.match(script, /fs\.rmSync\(dist, \{ recursive: true, force: true \}\)/);
  assert.match(script, /standalone-demo\.html/);
  assert.doesNotMatch(script, /node_modules/);
});


test('standalone build preserves double-dollar identifiers and adds canonicals only for production URLs', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/build.mjs'), 'utf8');
  assert.match(script, /\.replace\([^\n]+, \(\) =>/);
  assert.match(script, /rel=\"canonical\"/);
});

test('deployed pages and offline cache share versioned CSS while standalone stays self-contained', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { cwd: root, stdio: 'pipe' });
  const pages = ['index.html', '404.html', ...fs.readdirSync(path.join(root, 'pages')).filter(file => file.endsWith('.html')).map(file => `pages/${file}`)];
  const versions = new Set();
  for (const file of pages) {
    const html = fs.readFileSync(path.join(root, 'dist', file), 'utf8');
    const match = html.match(/styles\.css\?v=([a-f0-9]{12})/);
    assert.ok(match, `${file} must bypass stale CDN stylesheet entries`);
    versions.add(match[1]);
  }
  assert.equal(versions.size, 1);
  const [version] = versions;
  const worker = fs.readFileSync(path.join(root, 'dist/sw.js'), 'utf8');
  assert.ok(worker.includes(`'./styles.css?v=${version}'`));
  assert.ok(worker.includes(`-css-${version}`));
  const standalone = fs.readFileSync(path.join(root, 'dist/standalone-demo.html'), 'utf8');
  assert.doesNotMatch(standalone, /<link[^>]+rel="stylesheet"/);
  assert.match(standalone, /<style>/);
});
