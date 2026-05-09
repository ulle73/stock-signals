import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getLatestOccReportDate, upsertOccDailyVolumeRows } from '../lib/repositories/occ-volume-totals.js';
import { fetchOccDailyVolumeTotals } from '../lib/sources/occ.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { addDaysToIsoDate, enumerateWeekdayIsoDates, getTodayIsoDate } from '../lib/utils/report-dates.js';

ensureEnvLoaded();

const JOB_NAME = 'fetch_occ_volume_totals';
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getTrimmedEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function resolveOccReportDates(latestStoredDate) {
  const reportDate = getTrimmedEnv('OCC_REPORT_DATE');
  const startDate = getTrimmedEnv('OCC_START_DATE');
  const endDate = getTrimmedEnv('OCC_END_DATE');

  if (reportDate && (startDate || endDate)) {
    throw new Error('Use either OCC_REPORT_DATE or OCC_START_DATE/OCC_END_DATE, not both.');
  }

  if (reportDate) {
    return [reportDate];
  }

  if (startDate || endDate) {
    if (!startDate || !endDate) {
      throw new Error('Both OCC_START_DATE and OCC_END_DATE are required when using a range.');
    }

    return enumerateWeekdayIsoDates(startDate, endDate);
  }

  const today = getTodayIsoDate();

  if (!latestStoredDate) {
    return [today];
  }

  return enumerateWeekdayIsoDates(addDaysToIsoDate(latestStoredDate, 1), today);
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'fetch-occ-volume-totals interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const latestStoredDate = await getLatestOccReportDate();
    const reportDates = resolveOccReportDates(latestStoredDate);

    if (!reportDates.length) {
      await fetchRunGuard.finish('success', {
        totalItems: 0,
        successfulItems: 0,
        failedItems: 0,
        metadata: {
          latestStoredDate,
          skippedDates: [],
          rowsInserted: 0,
        },
      });
      console.log('No OCC report dates to fetch.');
      return;
    }

    const skippedDates = [];
    const failedDates = [];
    let successfulDates = 0;
    let rowsInserted = 0;

    for (const reportDate of reportDates) {
      try {
        console.log(`Fetching OCC daily volume totals for ${reportDate}`);
        const rows = await fetchOccDailyVolumeTotals(reportDate);

        if (!rows.length) {
          skippedDates.push(reportDate);
          continue;
        }

        rowsInserted += await upsertOccDailyVolumeRows(rows);
        successfulDates += 1;
      } catch (error) {
        console.warn(`Failed OCC report date ${reportDate}: ${error.message}`);
        failedDates.push({ reportDate, error: error.message });
      }
    }

    const status = failedDates.length ? 'partial_success' : 'success';
    await fetchRunGuard.finish(status, {
      totalItems: reportDates.length,
      successfulItems: successfulDates,
      failedItems: failedDates.length,
      metadata: {
        latestStoredDate,
        reportDates,
        skippedDates,
        failedDates,
        rowsInserted,
      },
    });

    console.log(`fetch-occ-volume-totals completed with status: ${status}`);
    console.log(`Successful report dates: ${successfulDates}/${reportDates.length}`);
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
    console.error('fetch-occ-volume-totals failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
