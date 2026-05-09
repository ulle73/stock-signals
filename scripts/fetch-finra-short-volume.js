import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getLatestFinraShortVolumeDate, upsertFinraShortVolumeRows } from '../lib/repositories/finra-short-volume.js';
import { fetchFinraShortVolumeRow } from '../lib/sources/finra-short-volume.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { addDaysToIsoDate, enumerateWeekdayIsoDates, getTodayIsoDate } from '../lib/utils/report-dates.js';

ensureEnvLoaded();

const JOB_NAME = 'fetch_finra_short_volume';
const SYMBOL = 'PLCE';
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

function resolveFinraDates(latestStoredDate) {
  const reportDate = getTrimmedEnv('FINRA_SHORT_VOLUME_DATE');
  const startDate = getTrimmedEnv('FINRA_SHORT_VOLUME_START_DATE');
  const endDate = getTrimmedEnv('FINRA_SHORT_VOLUME_END_DATE');

  if (reportDate && (startDate || endDate)) {
    throw new Error('Use either FINRA_SHORT_VOLUME_DATE or FINRA_SHORT_VOLUME_START_DATE/FINRA_SHORT_VOLUME_END_DATE, not both.');
  }

  if (reportDate) {
    return [reportDate];
  }

  if (startDate || endDate) {
    if (!startDate || !endDate) {
      throw new Error('Both FINRA_SHORT_VOLUME_START_DATE and FINRA_SHORT_VOLUME_END_DATE are required when using a range.');
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
  await failRunningFetchRuns(JOB_NAME, 'fetch-finra-short-volume interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const latestStoredDate = await getLatestFinraShortVolumeDate(SYMBOL);
    const dates = resolveFinraDates(latestStoredDate);

    if (!dates.length) {
      await fetchRunGuard.finish('success', {
        totalItems: 0,
        successfulItems: 0,
        failedItems: 0,
        metadata: {
          symbol: SYMBOL,
          latestStoredDate,
          rowsInserted: 0,
          skippedDates: [],
        },
      });
      console.log('No FINRA report dates to fetch.');
      return;
    }

    const skippedDates = [];
    const failedDates = [];
    let successfulDates = 0;
    let rowsInserted = 0;

    for (const date of dates) {
      try {
        console.log(`Fetching FINRA short volume for ${SYMBOL} on ${date}`);
        const row = await fetchFinraShortVolumeRow(date, SYMBOL);

        if (!row) {
          skippedDates.push(date);
          continue;
        }

        rowsInserted += await upsertFinraShortVolumeRows([row]);
        successfulDates += 1;
      } catch (error) {
        console.warn(`Failed FINRA report date ${date}: ${error.message}`);
        failedDates.push({ date, error: error.message });
      }
    }

    const status = failedDates.length ? 'partial_success' : 'success';
    await fetchRunGuard.finish(status, {
      totalItems: dates.length,
      successfulItems: successfulDates,
      failedItems: failedDates.length,
      metadata: {
        symbol: SYMBOL,
        latestStoredDate,
        dates,
        skippedDates,
        failedDates,
        rowsInserted,
      },
    });

    console.log(`fetch-finra-short-volume completed with status: ${status}`);
    console.log(`Successful report dates: ${successfulDates}/${dates.length}`);
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
    console.error('fetch-finra-short-volume failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
