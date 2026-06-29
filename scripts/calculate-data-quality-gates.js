import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import {
  getSignalDataQualitySourceSnapshot,
  upsertSignalDataQualityRows,
} from '../lib/repositories/signal-data-quality.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { buildSignalDataQualityRows } from '../lib/utils/data-quality-gates.js';
import {
  getExpectedLatestUsEquityMarketDate,
  isUsEquityMarketDate,
} from '../lib/utils/us-market-calendar.js';

ensureEnvLoaded();

const JOB_NAME = 'calculate_data_quality_gates';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getCalculationOptions() {
  const requestedDate = process.env.DATA_QUALITY_DATE?.trim() || null;
  const timeZone = 'America/New_York';
  const closeHour = 17;
  const closeMinute = 30;

  if (requestedDate && !isUsEquityMarketDate(requestedDate)) {
    throw new Error(`DATA_QUALITY_DATE must be a US equity market date: ${requestedDate}`);
  }

  const expectedDate = requestedDate ?? getExpectedLatestUsEquityMarketDate({
    now: new Date(),
    timeZone,
    closeHour,
    closeMinute,
  });

  return {
    requestedDate,
    expectedDate,
    timeZone,
    closeHour,
    closeMinute,
  };
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'calculate:data-quality-gates interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const options = getCalculationOptions();
    const snapshot = await getSignalDataQualitySourceSnapshot(options.expectedDate);
    const gateRows = buildSignalDataQualityRows(snapshot, { expectedDate: options.expectedDate });
    const inserted = await upsertSignalDataQualityRows(gateRows);

    await fetchRunGuard.finish('success', {
      totalItems: gateRows.length,
      successfulItems: inserted,
      failedItems: 0,
      metadata: {
        expectedDate: options.expectedDate,
        activeTickerCount: snapshot.activeTickerCount,
        priceCoverageCount: snapshot.priceTickerCountForDate,
        relativeStrengthCoverageCount: snapshot.relativeStrengthTickerCountForDate,
        intradayCoverageCount: snapshot.intradayTickerCountForDate,
      },
    });

    console.log(`Calculated ${gateRows.length} signal data quality gate rows for ${options.expectedDate}.`);
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
    console.error('calculate:data-quality-gates failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
