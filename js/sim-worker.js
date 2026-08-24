'use strict';
importScripts('./sim-engine.js');

self.addEventListener('message', (event) => {
  const message = event.data || {};
  try {
    if (message.type === 'INIT') {
      const run = self.CRC_SIM_ENGINE.initializeRun(message.payload);
      self.postMessage({ id: message.id, ok: true, type: 'INIT_RESULT', payload: run });
      return;
    }
    if (message.type === 'ADVANCE') {
      const { run, pathways, targetWeek } = message.payload;
      const result = self.CRC_SIM_ENGINE.advanceRun(run, pathways, targetWeek);
      self.postMessage({ id: message.id, ok: true, type: 'ADVANCE_RESULT', payload: result });
      return;
    }
    if (message.type === 'SIMULATE_COMPLETE') {
      const { input, pathways } = message.payload;
      const result = self.CRC_SIM_ENGINE.simulateComplete(input, pathways);
      self.postMessage({ id: message.id, ok: true, type: 'COMPLETE_RESULT', payload: result });
      return;
    }
    throw new Error(`Unknown worker message: ${message.type}`);
  } catch (error) {
    self.postMessage({
      id: message.id,
      ok: false,
      type: 'ERROR',
      error: { name: error?.name || 'Error', message: error?.message || String(error) }
    });
  }
});
