import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const engine = require('../js/sim-engine.js');
const caseData = JSON.parse(fs.readFileSync(new URL('../data/cases/case-b2m-escape.json', import.meta.url)));
const pathways = JSON.parse(fs.readFileSync(new URL('../data/pathways.json', import.meta.url)));

function complete(pathwayId, seed = caseData.seed, selectedTests = ['ctdna', 'b2m', 'imaging']) {
  return engine.simulateComplete({
    caseData,
    pathways,
    pathwayId,
    hypotheses: ['presentation', 'selection'],
    selectedTests,
    predictions: ['disease_control', 'ecology_risk', 'toxicity'],
    seed
  }, pathways);
}

test('simulation is deterministic for the same seed and plan', () => {
  const first = complete('pembro');
  const second = complete('pembro');
  assert.deepEqual(first.outcome, second.outcome);
  assert.deepEqual(first.snapshots, second.snapshots);
});

test('the release case keeps B2M alteration nuanced rather than deterministic failure', () => {
  const traits = engine.deriveHiddenTraits(caseData.seed);
  assert.equal(traits.b2mAltered, true);
  assert.equal(traits.mhcRetained, true);
  const current = complete('pembro');
  assert.match(current.outcome.imaging, /控制|稳定/);
  const altered = [];
  for (let seed = 1000; seed < 1160; seed += 1) {
    if (engine.deriveHiddenTraits(seed).b2mAltered) altered.push(complete('pembro', seed).outcome.imaging);
  }
  assert.ok(altered.some((value) => /控制|稳定/.test(value)));
  assert.ok(altered.some((value) => /进展/.test(value)));
});

test('ctDNA can be detected or false negative and never returns an exact clone percentage', () => {
  const labels = [];
  for (let seed = 2000; seed < 2140; seed += 1) {
    const evidence = complete('pembro', seed).state.evidence.ctdna;
    labels.push(evidence.status);
    assert.doesNotMatch(JSON.stringify(evidence), /\d+(?:\.\d+)?%/);
  }
  assert.ok(labels.some((value) => value.includes('检出')));
  assert.ok(labels.some((value) => value.includes('未检出')));
});

test('pathways use constrained schedules and the assessment occurs at W8', () => {
  const byId = Object.fromEntries(pathways.pathways.map((item) => [item.id, item]));
  assert.deepEqual(byId.pembro.schedule.map((item) => item.week), [0, 3, 6, 8]);
  assert.deepEqual(byId.nivoipi.schedule.map((item) => item.week), [0, 3, 6, 8]);
  assert.deepEqual(byId.folfoxbev.schedule.map((item) => item.week), [0, 2, 4, 6, 8]);
  assert.equal(caseData.assessmentWeek, 8);
});

test('same-seed pathways produce interpretable trade-offs rather than a universal score', () => {
  const outcomes = Object.fromEntries(pathways.pathways.map((pathway) => [pathway.id, complete(pathway.id).outcome]));
  assert.notDeepEqual(outcomes.pembro.internal, outcomes.nivoipi.internal);
  assert.notDeepEqual(outcomes.pembro.internal, outcomes.folfoxbev.internal);
  assert.ok(outcomes.nivoipi.iraeEvent || outcomes.nivoipi.sustainability !== '可持续');
});
