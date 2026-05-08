import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildSectorBreadthRows } from '../lib/utils/sector-breadth.js';
import { getSectorBreadthSourceRows, upsertSectorBreadthDaily } from '../lib/repositories/sector-breadth.js';
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
  await failRunningFetchRuns('calculate_sector_breadth', 'calculate:sector-breadth interrupted before completion', {
    recoveredBy: 'calculate_sector_breadth',
  });
  const fetchRunId = await startFetchRun('calculate_sector_breadth');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getSectorBreadthSourceRows();
    const sectorBreadthRows = buildSectorBreadthRows(sourceRows);
    const inserted = await upsertSectorBreadthDaily(sectorBreadthRows);

    await fetchRunGuard.finish('success', {
      totalItems: sectorBreadthRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        sourceRowsRead: sourceRows.length,
        sectorBreadthRowsCalculated: sectorBreadthRows.length,
      },
    });

    console.log(`Calculated ${sectorBreadthRows.length} sector breadth rows.`);
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
    console.error('calculate:sector-breadth failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
