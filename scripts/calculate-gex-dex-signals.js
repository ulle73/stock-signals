import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildGexDexRegimeRows } from '../lib/indicators/gex-dex-regime.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getGexDexSnapshotsWithoutSignals } from '../lib/repositories/gex-dex-snapshots.js';
import { upsertGexDexSignalRows } from '../lib/repositories/gex-dex-signals.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_gex_dex_signals';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getLimit() {
  const value = Number(process.env.GEX_DEX_CALCULATION_LIMIT ?? 100);
  return Number.isInteger(value) && value > 0 ? value : 100;
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate-gex-dex-signals interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const snapshots = await getGexDexSnapshotsWithoutSignals(getLimit());
    const rows = buildGexDexRegimeRows(snapshots);
    const inserted = await upsertGexDexSignalRows(rows);

    await fetchRunGuard.finish('success', {
      totalItems: snapshots.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: { processedSnapshots: snapshots.length },
    });

    console.log(`Calculated ${inserted} GEX/DEX contextual signal rows.`);
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
    console.error('calculate-gex-dex-signals failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
