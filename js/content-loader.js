(function initContentLoader(scope) {
  'use strict';

  const REQUIRED_PATHWAY_IDS = ['pembro', 'nivoipi', 'folfoxbev'];

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-cache', credentials: 'same-origin' });
    if (!response.ok) throw new Error(`Content request failed: ${response.status} ${url}`);
    return response.json();
  }

  function validateContent(bundle) {
    if (!bundle?.manifest || Number(bundle.manifest.schemaVersion) !== 1) throw new Error('Unsupported content manifest.');
    if (!bundle.caseData?.id || !Array.isArray(bundle.caseData.hypotheses)) throw new Error('Invalid case content.');
    const ids = new Set((bundle.pathways?.pathways || []).map((item) => item.id));
    for (const id of REQUIRED_PATHWAY_IDS) if (!ids.has(id)) throw new Error(`Missing pathway: ${id}`);
    if (!Array.isArray(bundle.evidence?.items)) throw new Error('Invalid evidence content.');
    return bundle;
  }

  async function load() {
    if (scope.__CRC_EMBEDDED_CONTENT__) return validateContent(scope.__CRC_EMBEDDED_CONTENT__);
    const manifest = await fetchJson('./data/content-manifest.json');
    const [caseData, pathways, evidence] = await Promise.all([
      fetchJson(`./data/${manifest.cases[0]}`),
      fetchJson(`./data/${manifest.pathways}`),
      fetchJson(`./data/${manifest.evidence}`)
    ]);
    return validateContent({ manifest, caseData, pathways, evidence });
  }

  scope.CRC_CONTENT_LOADER = Object.freeze({ load, validateContent });
  if (typeof module !== 'undefined' && module.exports) module.exports = { load, validateContent };
})(typeof window !== 'undefined' ? window : globalThis);
