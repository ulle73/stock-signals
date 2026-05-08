import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildPositionFactRowsFromSources } from '../lib/utils/position-facts.js';
import { getPositionFactSourceRows, upsertPositionFacts } from '../lib/repositories/position-facts.js';
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
  await failRunningFetchRuns('calculate_position_facts', 'calculate:position-facts interrupted before completion', {
    recoveredBy: 'calculate_position_facts',
  });
  const fetchRunId = await startFetchRun('calculate_position_facts');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getPositionFactSourceRows('SPY');
    const positionFacts = buildPositionFactRowsFromSources(sourceRows);
    const inserted = await upsertPositionFacts(positionFacts);

    await fetchRunGuard.finish('success', {
      totalItems: positionFacts.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        benchmarkRowsRead: sourceRows.benchmarkRows.length,
        marketSeriesRowsRead: sourceRows.marketSeriesRows.length,
        positionFactsCalculated: positionFacts.length,
      },
    });

    console.log(`Calculated ${positionFacts.length} position fact rows.`);
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
    console.error('calculate:position-facts failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
