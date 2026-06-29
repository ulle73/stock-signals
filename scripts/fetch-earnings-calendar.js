import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import {
  buildStockEarningsCalendarErrorRow,
  buildStockEarningsCalendarRow,
  upsertStockEarningsCalendarRows,
} from '../lib/repositories/stock-earnings-calendar.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { getActiveConstituents } from '../lib/repositories/constituents.js';
import { fetchEarningsWhispersCalendar } from '../lib/sources/earnings-whispers.js';
import { fetchYahooEarningsCalendar } from '../lib/sources/yahoo-earnings.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { getExpectedLatestUsEquityMarketDate } from '../lib/utils/us-market-calendar.js';

ensureEnvLoaded();

const JOB_NAME = 'fetch_earnings_calendar';
const DEFAULT_CONCURRENCY = 1;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_REQUEST_DELAY_MS = 250;
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

const unregisterSignalHandlers = fetchRunGuard.register(process);

function sleep(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getTickerLimit() {
  const raw = process.env.FETCH_TICKER_LIMIT;
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getPositiveIntegerEnv(name, fallback) {
  const raw = process.env[name];
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isRetryableEarningsError(error) {
  return /\b(429|503)\b/.test(error.message);
}

async function fetchYahooEarningsCalendarWithRetry(yahooTicker, maxAttempts = DEFAULT_MAX_ATTEMPTS) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetchYahooEarningsCalendar(yahooTicker);
    } catch (error) {
      const shouldRetry = attempt < maxAttempts && isRetryableEarningsError(error);

      if (!shouldRetry) {
        throw error;
      }

      const delayMilliseconds = attempt * 1000;
      console.warn(
        `Retrying earnings ${yahooTicker} after transient failure (${error.message}) [attempt ${attempt + 1}/${maxAttempts}]`
      );
      await sleep(delayMilliseconds);
    }
  }

  throw new Error(`Exhausted earnings retries for ${yahooTicker}`);
}

async function fetchEarningsCalendarWithFallback(constituent) {
  try {
    const whispersData = await fetchEarningsWhispersCalendar(constituent.ticker);

    if (whispersData.source_status === 'active') {
      return whispersData;
    }

    const yahooData = await fetchYahooEarningsCalendarWithRetry(constituent.yahoo_ticker);
    return yahooData.source_status === 'active' ? yahooData : whispersData;
  } catch (whispersError) {
    try {
      return await fetchYahooEarningsCalendarWithRetry(constituent.yahoo_ticker);
    } catch (yahooError) {
      throw new Error(
        `EarningsWhispers=${whispersError.message}; Yahoo=${yahooError.message}`
      );
    }
  }
}

function normalizeSnapshotEarningsData(snapshotDate, earningsData) {
  if (!earningsData?.earnings_date || earningsData.earnings_date >= snapshotDate) {
    return earningsData;
  }

  return {
    ...earningsData,
    earnings_date: null,
    confirmed: null,
    source_status: 'missing',
    details: {
      ...(earningsData.details ?? {}),
      stale_earnings_date: earningsData.earnings_date,
      stale_snapshot_date: snapshotDate,
    },
  };
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = [];
  let index = 0;

  async function next() {
    const currentIndex = index;
    index += 1;

    if (currentIndex >= items.length) {
      return;
    }

    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    await next();
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'fetch-earnings-calendar interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  const snapshotDate = getExpectedLatestUsEquityMarketDate();
  const concurrency = getPositiveIntegerEnv('EARNINGS_FETCH_CONCURRENCY', DEFAULT_CONCURRENCY);
  const requestDelayMilliseconds = getPositiveIntegerEnv('EARNINGS_FETCH_DELAY_MS', DEFAULT_REQUEST_DELAY_MS);
  let constituents = await getActiveConstituents();
  const tickerLimit = getTickerLimit();

  if (tickerLimit !== null) {
    console.log(`FETCH_TICKER_LIMIT=${tickerLimit}; limiting earnings fetch for local test.`);
    constituents = constituents.slice(0, tickerLimit);
  }

  const rows = [];
  const failedTickers = [];

  try {
    await runWithConcurrency(constituents, concurrency, async (constituent, index) => {
      if (index > 0) {
        await sleep(requestDelayMilliseconds);
      }

      console.log(`[${index + 1}/${constituents.length}] Fetching earnings ${constituent.ticker} (${constituent.yahoo_ticker})`);

      try {
        const earningsData = normalizeSnapshotEarningsData(
          snapshotDate,
          await fetchEarningsCalendarWithFallback(constituent)
        );
        rows[index] = buildStockEarningsCalendarRow({
          snapshotDate,
          constituent,
          earningsData,
        });
      } catch (error) {
        console.warn(`Failed earnings fetch for ${constituent.ticker}: ${error.message}`);
        failedTickers.push({
          ticker: constituent.ticker,
          yahoo_ticker: constituent.yahoo_ticker,
          error: error.message,
        });
        rows[index] = buildStockEarningsCalendarErrorRow(snapshotDate, constituent, error);
      }
    });

    const insertedRows = await upsertStockEarningsCalendarRows(rows.filter(Boolean));
    const activeRows = rows.filter((row) => row?.source_status === 'active').length;
    const missingRows = rows.filter((row) => row?.source_status === 'missing').length;
    const errorRows = rows.filter((row) => row?.source_status === 'error').length;
    const status = activeRows === 0
      ? 'failure'
      : errorRows > 0
        ? 'partial_success'
        : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: constituents.length,
      successfulItems: activeRows + missingRows,
      failedItems: errorRows,
      metadata: {
        snapshotDate,
        insertedRows,
        concurrency,
        requestDelayMilliseconds,
        activeRows,
        missingRows,
        errorRows,
        failedTickers,
      },
    });

    if (status === 'failure') {
      throw new Error('No stock earnings calendar rows could be fetched.');
    }

    console.log(
      `Fetched ${insertedRows} stock earnings calendar rows for ${snapshotDate} (${activeRows} active, ${missingRows} missing, ${errorRows} errors).`
    );
  } catch (error) {
    await fetchRunGuard.finish('failure', {
      errorMessage: error.message,
      metadata: {
        snapshotDate,
        concurrency,
        requestDelayMilliseconds,
        failedTickers,
        stack: error.stack,
      },
    });
    throw error;
  }
}

run()
  .catch((error) => {
    console.error('fetch-earnings-calendar failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
