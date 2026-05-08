import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getSwingSignalSourceRows, upsertSwingSignals } from '../lib/repositories/swing-signals.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildSwingSignalRowsFromSources } from '../lib/utils/swing-signals.js';

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
  await failRunningFetchRuns('calculate_swing_signals', 'calculate:swing-signals interrupted before completion', {
    recoveredBy: 'calculate_swing_signals',
  });
  const fetchRunId = await startFetchRun('calculate_swing_signals');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getSwingSignalSourceRows();
    const signalRows = buildSwingSignalRowsFromSources(sourceRows);
    const inserted = await upsertSwingSignals(signalRows);

    await fetchRunGuard.finish('success', {
      totalItems: signalRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        sectorSignalsRead: sourceRows.sectorSignalRows.length,
        marketSignalsRead: sourceRows.marketSignalRows.length,
        swingSignalsCalculated: signalRows.length,
      },
    });

    console.log(`Calculated ${signalRows.length} swing signal rows.`);
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
    console.error('calculate:swing-signals failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
