import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('production files and public documentation exist', () => {
  const required = [
    'index.html', '404.html', 'styles.css', 'sw.js', 'manifest.webmanifest', '_headers', '_redirects',
    'js/app.js', 'js/sim-engine.js', 'js/sim-worker.js', 'js/storage.js',
    'pages/methods.html', 'pages/references.html', 'pages/privacy.html', 'pages/accessibility.html',
    'SECURITY.md', 'CONTRIBUTING.md', 'LICENSE'
  ];
  for (const file of required) assert.ok(fs.existsSync(path.join(root, file)), file);
});

test('desktop reading order is row-major and defaults to readable typography', () => {
  const css = read('styles.css');
  assert.match(css, /font-size:\s*clamp\(18px,[^;]+19px\)/);
  assert.match(css, /grid-template-areas:\s*"case hypothesis"\s*"pathway evidence"\s*"prediction events"/s);
  assert.match(css, /@media \(max-width: 1250px\)[\s\S]*grid-template-areas:\s*"case" "hypothesis" "pathway" "evidence" "prediction" "events"/);
});

test('security headers constrain scripts, framing and browser capabilities', () => {
  const headers = read('_headers');
  for (const token of ['Content-Security-Policy', "script-src 'self'", "frame-ancestors 'none'", 'X-Content-Type-Options', 'Permissions-Policy', 'Cross-Origin-Opener-Policy']) {
    assert.match(headers, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('HTML includes privacy, accessibility and medical boundaries', () => {
  const html = read('index.html');
  assert.match(html, /Public Preview/);
  assert.match(html, /不提供剂量、处方或疗效预测/);
  assert.match(html, /pages\/privacy\.html/);
  assert.match(html, /pages\/accessibility\.html/);
  assert.match(html, /Web Worker/);
});

test('service worker does not cache cross-origin or non-GET traffic', () => {
  const sw = read('sw.js');
  assert.match(sw, /request\.method !== 'GET'/);
  assert.match(sw, /url\.origin !== self\.location\.origin/);
  assert.match(sw, /SKIP_WAITING/);
});
