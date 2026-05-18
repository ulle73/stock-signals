import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { getYahooIntraday60mRange } from '../lib/utils/fetch-settings.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { fetchYahooIntradayCandles } from '../lib/sources/yahoo.js';
import { getActiveConstituents } from '../lib/repositories/constituents.js';
import { upsertStockIntraday60mPrices } from '../lib/repositories/intraday-prices.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';

const JOB_NAME = 'fetch_intraday_60m';
const DEFAULT_CONCURRENCY = 3;

const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

ensureEnvLoaded();

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getFetchOptions() {
  const ticker = process.env.FETCH_TICKER?.trim().toUpperCase() || null;
  const rawLimit = process.env.FETCH_TICKER_LIMIT;
  const parsedLimit = rawLimit ? Number(rawLimit) : null;
  const tickerLimit = Number.isFinite(parsedLimit) && parsedLimit > 0
    ? parsedLimit
    : null;

  return {
    ticker,
    tickerLimit,
    range: getYahooIntraday60mRange(),
  };
}

async function runWithConcurrency(items, concurrency, worker) {
  const results = [];
  let index = 0;

  async function next() {
    const currentIndex = index;
    index += 1;

    if (currentIndex >= items.length) return;

    const item = items[currentIndex];
    results[currentIndex] = await worker(item, currentIndex);
    await next();
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);

  return results;
}

async function run() {
  await failRunningFetchRuns(JOB_NAME, 'fetch:intraday-60m interrupted before completion', {
    recoveredBy: JOB_NAME,
  });
  const fetchRunId = await startFetchRun(JOB_NAME);
  fetchRunGuard.setRunId(fetchRunId);

  try {
    const options = getFetchOptions();
    let constituents = await getActiveConstituents();

    if (!constituents.length) {
      throw new Error('No active constituents found. Run npm run fetch:daily first.');
    }

    if (options.ticker) {
      constituents = constituents.filter((item) => item.ticker === options.ticker);
      if (!constituents.length) {
        throw new Error(`Ticker ${options.ticker} not found in active constituents.`);
      }
      console.log(`FETCH_TICKER=${options.ticker}; limiting 60m fetch to one ticker.`);
    } else if (options.tickerLimit) {
      constituents = constituents.slice(0, options.tickerLimit);
      console.log(`FETCH_TICKER_LIMIT=${options.tickerLimit}; limiting 60m fetch for local test.`);
    }

    console.log(`YAHOO_INTRADAY_60M_RANGE=${options.range}; fetching Yahoo 60m candles.`);

    const failedTickers = [];
    let successfulTickers = 0;
    let rowsStored = 0;

    await runWithConcurrency(constituents, DEFAULT_CONCURRENCY, async (item, index) => {
      try {
        if (index === 0 || (index + 1) % 25 === 0 || index + 1 === constituents.length) {
          console.log(`[${index + 1}/${constituents.length}] Fetching 60m ${item.ticker} (${item.yahoo_ticker})`);
        }
        const candles = await fetchYahooIntradayCandles(item.yahoo_ticker, {
          range: options.range,
          interval: '60m',
        });
        const inserted = await upsertStockIntraday60mPrices(null, item.ticker, candles);
        successfulTickers += 1;
        rowsStored += inserted;
      } catch (error) {
        console.warn(`Failed 60m ${item.ticker}: ${error.message}`);
        failedTickers.push({ ticker: item.ticker, yahoo_ticker: item.yahoo_ticker, error: error.message });
      }
    });

    const failedItems = failedTickers.length;
    const status = failedItems > 0 ? 'partial_success' : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: constituents.length,
      successfulItems: successfulTickers,
      failedItems,
      metadata: {
        range: options.range,
        interval: '60m',
        rowsStored,
        failedTickers,
      },
    });

    console.log(`Fetch intraday 60m completed with status: ${status}`);
    console.log(`Tickers: ${successfulTickers}/${constituents.length} succeeded.`);
    console.log(`Rows stored: ${rowsStored}`);
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
    console.error('fetch:intraday-60m failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
