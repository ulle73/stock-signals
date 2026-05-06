import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildMarketSignalRowsFromSources } from '../lib/utils/divergence-signals.js';
import { getMarketSignalSourceRows, upsertMarketSignals } from '../lib/repositories/market-signals.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';

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
  await failRunningFetchRuns('calculate_signals', 'calculate:signals interrupted before completion', {
    recoveredBy: 'calculate_signals',
  });
  const fetchRunId = await startFetchRun('calculate_signals');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getMarketSignalSourceRows();
    const signalRows = buildMarketSignalRowsFromSources(sourceRows);
    const inserted = await upsertMarketSignals(signalRows);

    await fetchRunGuard.finish('success', {
      totalItems: signalRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        breadthRowsRead: sourceRows.breadthRows.length,
        spxRowsRead: sourceRows.spxRows.length,
        vixRowsRead: sourceRows.vixRows.length,
        signalRowsCalculated: signalRows.length,
      },
    });

    console.log(`Calculated ${signalRows.length} market signal rows.`);
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
    console.error('calculate:signals failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
