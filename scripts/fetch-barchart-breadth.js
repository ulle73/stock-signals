import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { BARCHART_BREADTH_SERIES, upsertExternalBreadthRows } from '../lib/repositories/barchart-breadth.js';
import { fetchBarchartBreadthSeries } from '../lib/sources/barchart-breadth.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { getTodayIsoDate } from '../lib/utils/report-dates.js';

ensureEnvLoaded();

const JOB_NAME = 'fetch_barchart_breadth';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getSnapshotDate() {
  const configured = process.env.BARCHART_BREADTH_DATE?.trim();
  return configured || getTodayIsoDate();
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'fetch-barchart-breadth interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const snapshotDate = getSnapshotDate();
    const rows = [];
    const failedSeries = [];

    for (const series of BARCHART_BREADTH_SERIES) {
      try {
        console.log(`Fetching Barchart breadth ${series.seriesKey}`);
        rows.push(await fetchBarchartBreadthSeries({
          ...series,
          snapshotDate,
        }));
      } catch (error) {
        console.warn(`Failed Barchart breadth ${series.seriesKey}: ${error.message}`);
        failedSeries.push({ seriesKey: series.seriesKey, error: error.message });
      }
    }

    const inserted = await upsertExternalBreadthRows(rows);
    const status = failedSeries.length ? 'partial_success' : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: BARCHART_BREADTH_SERIES.length,
      successfulItems: rows.length,
      failedItems: failedSeries.length,
      metadata: {
        snapshotDate,
        rowsInserted: inserted,
        failedSeries,
      },
    });

    console.log(`fetch-barchart-breadth completed with status: ${status}`);
    console.log(`Successful breadth series: ${rows.length}/${BARCHART_BREADTH_SERIES.length}`);
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
    console.error('fetch-barchart-breadth failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
