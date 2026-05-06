import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { DEFAULT_YAHOO_DAILY_RANGE, getYahooDailyRange } from '../lib/utils/fetch-settings.js';
import {
  buildYahooFetchRequest,
  filterIncrementalRows,
  hasYahooDailyRangeOverride,
} from '../lib/utils/incremental-fetch.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { fetchFredSeries } from '../lib/sources/fred.js';
import { fetchSp500Constituents } from '../lib/sources/wikipedia.js';
import { fetchYahooDailyCandles } from '../lib/sources/yahoo.js';
import { upsertConstituents, getActiveConstituents } from '../lib/repositories/constituents.js';
import { getLatestPriceDatesByTicker, upsertStockDailyPrices } from '../lib/repositories/prices.js';
import { getLatestMarketSeriesDates, upsertMarketSeries } from '../lib/repositories/market-series.js';
import { finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';

const FRED_SERIES = ['SP500', 'VIXCLS', 'BAMLH0A0HYM2'];
const DEFAULT_CONCURRENCY = 5;
const fetchRunGuard = createFetchRunGuard({
  finishRun: finishFetchRun,
  closePool,
  setExitCode(code) {
    process.exitCode = code;
  },
});

ensureEnvLoaded();

const unregisterSignalHandlers = fetchRunGuard.register(process);

function getTickerLimit() {
  const raw = process.env.FETCH_TICKER_LIMIT;
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

async function fetchYahooForConstituents(constituents, latestPriceDatesByTicker) {
  const failedTickers = [];
  let successfulTickers = 0;
  let totalCandles = 0;
  const yahooDailyRange = getYahooDailyRange();
  const rangeOverrideEnabled = hasYahooDailyRangeOverride();

  await runWithConcurrency(constituents, DEFAULT_CONCURRENCY, async (item, index) => {
    try {
      console.log(`[${index + 1}/${constituents.length}] Fetching ${item.ticker} (${item.yahoo_ticker})`);
      const request = buildYahooFetchRequest({
        latestDate: latestPriceDatesByTicker[item.ticker] || null,
        fallbackRange: yahooDailyRange,
        hasRangeOverride: rangeOverrideEnabled,
      });
      const candles = await fetchYahooDailyCandles(item.yahoo_ticker, request);
      const inserted = await upsertStockDailyPrices(item.ticker, candles);
      successfulTickers += 1;
      totalCandles += inserted;
      return { ticker: item.ticker, ok: true, candles: inserted };
    } catch (error) {
      console.warn(`Failed ${item.ticker}: ${error.message}`);
      failedTickers.push({ ticker: item.ticker, yahoo_ticker: item.yahoo_ticker, error: error.message });
      return { ticker: item.ticker, ok: false, error: error.message };
    }
  });

  return { failedTickers, successfulTickers, totalCandles };
}

async function fetchFredData(latestMarketSeriesDates) {
  const failedSeries = [];
  const successfulSeries = [];
  let totalRows = 0;

  for (const seriesId of FRED_SERIES) {
    try {
      console.log(`Fetching FRED series ${seriesId}`);
      const rows = await fetchFredSeries(seriesId);
      const incrementalRows = filterIncrementalRows(rows, latestMarketSeriesDates[seriesId] || null);
      const inserted = await upsertMarketSeries(seriesId, incrementalRows);
      successfulSeries.push({ seriesId, rows: inserted });
      totalRows += inserted;
    } catch (error) {
      console.warn(`Failed FRED series ${seriesId}: ${error.message}`);
      failedSeries.push({ seriesId, error: error.message });
    }
  }

  return { failedSeries, successfulSeries, totalRows };
}

async function run() {
  const fetchRunId = await startFetchRun('fetch_daily');
  fetchRunGuard.setRunId(fetchRunId);

  try {
    console.log('Fetching S&P 500 constituents...');
    const constituents = await fetchSp500Constituents();
    await upsertConstituents(constituents);
    const yahooDailyRange = getYahooDailyRange();
    const latestPriceDatesByTicker = await getLatestPriceDatesByTicker();
    const latestMarketSeriesDates = await getLatestMarketSeriesDates();

    let activeConstituents = await getActiveConstituents();
    const tickerLimit = getTickerLimit();

    if (yahooDailyRange !== DEFAULT_YAHOO_DAILY_RANGE) {
      console.log(`YAHOO_DAILY_RANGE=${yahooDailyRange}; extending Yahoo history backfill.`);
    }

    if (tickerLimit) {
      console.log(`FETCH_TICKER_LIMIT=${tickerLimit}; limiting Yahoo fetch for local test.`);
      activeConstituents = activeConstituents.slice(0, tickerLimit);
    }

    const yahooResult = await fetchYahooForConstituents(activeConstituents, latestPriceDatesByTicker);
    const fredResult = await fetchFredData(latestMarketSeriesDates);

    const failedItems = yahooResult.failedTickers.length + fredResult.failedSeries.length;
    const status = failedItems > 0 ? 'partial_success' : 'success';

    await fetchRunGuard.finish(status, {
      totalItems: activeConstituents.length + FRED_SERIES.length,
      successfulItems: yahooResult.successfulTickers + fredResult.successfulSeries.length,
      failedItems,
      metadata: {
        constituentsParsed: constituents.length,
        tickersAttempted: activeConstituents.length,
        yahoo: yahooResult,
        fred: fredResult,
      },
    });

    console.log(`Fetch daily completed with status: ${status}`);
    console.log(`Yahoo: ${yahooResult.successfulTickers}/${activeConstituents.length} tickers succeeded.`);
    console.log(`FRED: ${fredResult.successfulSeries.length}/${FRED_SERIES.length} series succeeded.`);
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
    console.error('fetch:daily failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    unregisterSignalHandlers();
    await closePool();
  });
