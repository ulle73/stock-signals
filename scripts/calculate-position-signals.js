import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildPositionSignalRowsFromSources } from '../lib/utils/position-signals.js';
import { getPositionSignalSourceRows, upsertPositionSignals } from '../lib/repositories/position-signals.js';
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
  await failRunningFetchRuns('calculate_position_signals', 'calculate:position-signals interrupted before completion', {
    recoveredBy: 'calculate_position_signals',
  });
  const fetchRunId = await startFetchRun('calculate_position_signals');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getPositionSignalSourceRows();
    const signalRows = buildPositionSignalRowsFromSources(sourceRows);
    const inserted = await upsertPositionSignals(signalRows);

    await fetchRunGuard.finish('success', {
      totalItems: signalRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        positionFactsRead: sourceRows.positionFactRows.length,
        marketSignalsRead: sourceRows.marketSignalRows.length,
        positionSignalsCalculated: signalRows.length,
      },
    });

    console.log(`Calculated ${signalRows.length} position signal rows.`);
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
    console.error('calculate:position-signals failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
