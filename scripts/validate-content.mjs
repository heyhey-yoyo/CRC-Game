import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateContent() {
  const manifest = readJson('data/content-manifest.json');
  const pathways = readJson(`data/${manifest.pathways}`);
  const evidence = readJson(`data/${manifest.evidence}`);
  const cases = manifest.cases.map((file) => readJson(`data/${file}`));

  assert(manifest.schemaVersion === 1, 'Manifest schemaVersion must be 1.');
  assert(/^\d+\.\d+\.\d+$/.test(manifest.appVersion), 'Manifest appVersion must be semantic versioning.');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(manifest.medicalBaseline), 'medicalBaseline must be YYYY-MM-DD.');
  assert(Array.isArray(pathways.pathways) && pathways.pathways.length >= 3, 'At least three pathways are required.');

  const pathwayIds = new Set();
  for (const pathway of pathways.pathways) {
    assert(pathway.id && !pathwayIds.has(pathway.id), `Duplicate or empty pathway id: ${pathway.id}`);
    pathwayIds.add(pathway.id);
    assert(Array.isArray(pathway.schedule) && pathway.schedule.length >= 2, `Pathway ${pathway.id} needs a schedule.`);
    for (const event of pathway.schedule) assert(Number.isInteger(event.week) && event.week >= 0 && event.week <= 8, `Invalid schedule week in ${pathway.id}.`);
    assert(pathway.gameBoundary && pathway.clinicalStatus, `Pathway ${pathway.id} must separate clinical status and game boundary.`);
    assert(!/\b\d+(?:\.\d+)?\s*mg\b/i.test(JSON.stringify(pathway)), `Pathway ${pathway.id} must not expose real dose values.`);
  }
  for (const required of ['pembro', 'nivoipi', 'folfoxbev']) assert(pathwayIds.has(required), `Missing required pathway ${required}.`);

  const evidenceIds = new Set();
  for (const item of evidence.items || []) {
    assert(item.id && !evidenceIds.has(item.id), `Duplicate evidence id: ${item.id}`);
    evidenceIds.add(item.id);
    assert(/^https:\/\//.test(item.url), `Evidence URL must use HTTPS: ${item.id}`);
    assert(Array.isArray(item.supports) && item.supports.length, `Evidence item ${item.id} needs supports.`);
  }

  for (const caseData of cases) {
    assert(caseData.id && caseData.title && caseData.clinicalFrame?.disclaimer, 'Case requires id, title and disclaimer.');
    assert(Number.isInteger(caseData.seed), `Case ${caseData.id} requires an integer seed.`);
    assert(caseData.assessmentWeek === 8, `Case ${caseData.id} must retain the W8 assessment boundary.`);
    assert(Array.isArray(caseData.hypotheses) && caseData.hypotheses.length >= 3, `Case ${caseData.id} needs hypotheses.`);
    assert(Array.isArray(caseData.tests) && caseData.tests.some((test) => test.id === 'imaging' && test.returnWeek === 8), `Case ${caseData.id} needs W8 imaging.`);
    const text = JSON.stringify(caseData);
    assert(!/B2M[^。]{0,30}(必然耐药|一定失败|完全隐身)/.test(text), `Case ${caseData.id} overstates B2M certainty.`);
    assert(!/\d+(?:\.\d+)?%/.test(text), `Case ${caseData.id} must not expose exact efficacy or clone percentages.`);
  }

  return { manifest, pathways, evidence, cases };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateContent();
  console.log(`Validated content ${result.manifest.contentVersion}: ${result.cases.length} case(s), ${result.pathways.pathways.length} pathways, ${result.evidence.items.length} evidence records.`);
}
