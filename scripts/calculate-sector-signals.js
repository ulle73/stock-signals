import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { getSectorSignalSourceRows, upsertSectorSignals } from '../lib/repositories/sector-signals.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildSectorSignalRowsFromSources } from '../lib/utils/sector-signals.js';

ensureEnvLoaded();

const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns('calculate_sector_signals', 'calculate:sector-signals interrupted before completion', {
    recoveredBy: 'calculate_sector_signals',
  });
  const fetchRunId = await startFetchRun('calculate_sector_signals');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getSectorSignalSourceRows();
    const signalRows = buildSectorSignalRowsFromSources(sourceRows);
    const inserted = await upsertSectorSignals(signalRows);

    await fetchRunGuard.finish('success', {
      totalItems: signalRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        sectorBreadthRowsRead: sourceRows.sectorBreadthRows.length,
        sectorSignalsCalculated: signalRows.length,
      },
    });

    console.log(`Calculated ${signalRows.length} sector signal rows.`);
  } catch (error) {
    await fetchRunGuard.finish('failure', {
      errorMessage: error.message,
      metadata: { stack: error.stack },
    });
    throw error;
  }
}

run()
  .catch((error) => {
    console.error('calculate:sector-signals failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
