import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildRelativeStrengthRows } from '../lib/indicators/relative-strength-vs-spy.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import {
  getRelativeStrengthSourceRows,
  upsertRelativeStrengthRows,
} from '../lib/repositories/relative-strength.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';

ensureEnvLoaded();

const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getCalculationOptions() {
  const ticker = process.env.RS_TICKER?.trim().toUpperCase() || null;
  const rawLimit = process.env.RS_TICKER_LIMIT;
  const parsedLimit = rawLimit ? Number(rawLimit) : null;
  const tickerLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : null;

  return { ticker, tickerLimit };
}

async function run() {
  await failRunningFetchRuns('calculate_relative_strength', 'calculate:relative-strength interrupted before completion', {
    recoveredBy: 'calculate_relative_strength',
  });
  const fetchRunId = await startFetchRun('calculate_relative_strength');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const options = getCalculationOptions();
    const { priceRows, benchmarkRows } = await getRelativeStrengthSourceRows(options);

    if (!priceRows.length) {
      throw new Error('No stock price history found for relative strength calculation.');
    }

    if (!benchmarkRows.length) {
      throw new Error('No SPY benchmark history found for relative strength calculation.');
    }

    const rsRows = buildRelativeStrengthRows({
      priceRows,
      benchmarkRows,
      benchmarkTicker: 'SPY',
    });
    const upserted = await upsertRelativeStrengthRows(rsRows);

    await fetchRunGuard.finish('success', {
      totalItems: rsRows.length,
      successfulItems: upserted,
      failedItems: 0,
      metadata: {
        tickerCount: new Set(priceRows.map((row) => row.ticker)).size,
        stockRowsRead: priceRows.length,
        benchmarkRowsRead: benchmarkRows.length,
        rsRowsCalculated: rsRows.length,
        options,
      },
    });

    console.log(`Calculated ${rsRows.length} stock relative strength rows.`);
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
    console.error('calculate:relative-strength failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
