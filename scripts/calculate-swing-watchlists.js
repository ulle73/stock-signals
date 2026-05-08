import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getSwingWatchlistSourceRows, replaceSwingWatchlists } from '../lib/repositories/swing-watchlists.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildSwingWatchlistRowsFromSources } from '../lib/utils/swing-watchlists.js';

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
  await failRunningFetchRuns('calculate_swing_watchlists', 'calculate:swing-watchlists interrupted before completion', {
    recoveredBy: 'calculate_swing_watchlists',
  });
  const fetchRunId = await startFetchRun('calculate_swing_watchlists');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getSwingWatchlistSourceRows();
    const watchlistRows = buildSwingWatchlistRowsFromSources(sourceRows);
    const inserted = await replaceSwingWatchlists(watchlistRows);

    await fetchRunGuard.finish('success', {
      totalItems: watchlistRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        indicatorRowsRead: sourceRows.indicatorRows.length,
        sectorSignalsRead: sourceRows.sectorSignalRows.length,
        swingSignalsRead: sourceRows.swingSignalRows.length,
        watchlistRowsCalculated: watchlistRows.length,
      },
    });

    console.log(`Calculated ${watchlistRows.length} swing watchlist rows.`);
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
    console.error('calculate:swing-watchlists failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
