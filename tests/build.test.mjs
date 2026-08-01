import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
