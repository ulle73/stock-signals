import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildImpliedVolatilityRatioSignalRows } from '../lib/indicators/implied-volatility-ratio-rvol-short-squeeze.js';
import { getImpliedVolatilityProxySourceRows } from '../lib/repositories/implied-volatility-proxy-source.js';
import { upsertImpliedVolatilityRatioSignalRows } from '../lib/repositories/implied-volatility-ratio-signals.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_implied_volatility_ratio';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate-implied-volatility-ratio interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const sourceRows = await getImpliedVolatilityProxySourceRows();
    if (!sourceRows.length) {
      throw new Error('No implied-volatility proxy source rows found.');
    }

    const signalRows = buildImpliedVolatilityRatioSignalRows(sourceRows);
    const inserted = await upsertImpliedVolatilityRatioSignalRows(signalRows);

    await fetchRunGuard.finish('success', {
      totalItems: signalRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        sourceRowsRead: sourceRows.length,
        signalRowsCalculated: signalRows.length,
      },
    });

    console.log(`Calculated ${signalRows.length} IVOL/RVOL signal rows.`);
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
    console.error('calculate-implied-volatility-ratio failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
