import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildDailyPriceCoverageDecision } from '../lib/utils/daily-price-coverage.js';
import { DEFAULT_YAHOO_DAILY_RANGE, getYahooDailyRange } from '../lib/utils/fetch-settings.js';
import { FRED_SERIES_DEFINITIONS, FRED_SERIES_IDS, filterFredRowsForUpsert } from '../lib/utils/fred-series.js';
import {
  buildYahooFetchRequest,
  hasYahooDailyRangeOverride,
} from '../lib/utils/incremental-fetch.js';
import { createFetchRunGuard } from '../lib/utils/fetch-run-guard.js';
import { fetchFredSeries } from '../lib/sources/fred.js';
import { fetchSp500Constituents } from '../lib/sources/wikipedia.js';
import { fetchYahooDailyCandles } from '../lib/sources/yahoo.js';
import { getLatestBenchmarkDates, upsertBenchmarkDailyPrices } from '../lib/repositories/benchmark-prices.js';
import { upsertConstituents, getActiveConstituents } from '../lib/repositories/constituents.js';
import { getLatestPriceDatesByTicker, upsertStockDailyPrices } from '../lib/repositories/prices.js';
import { getLatestMarketSeriesDates, upsertMarketSeries } from '../lib/repositories/market-series.js';
import { failRunningFetchRuns, finishFetchRun, startFetchRun } from '../lib/repositories/fetch-runs.js';
import { fetchAndStoreEuropeGrowthIndicators } from '../lib/repositories/europe-growth-indicators.js';
import { fetchAndStoreGlobalManufacturingPmi } from '../lib/repositories/global-manufacturing-pmi.js';
import { buildFetchRunCompletionDetails, fetchBenchmarkData } from '../lib/utils/fetch-benchmark.js';
import {
  createYahooFetchCircuit,
  runWithYahooFetchCircuit,
} from '../lib/utils/yahoo-fetch-circuit.js';

const BENCHMARK_TICKERS = ['SPY'];
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

async function fetchYahooForConstituents(constituents, latestPriceDatesByTicker) {
  const failedTickers = [];
  let successfulTickers = 0;
  let totalCandles = 0;
  const yahooDailyRange = getYahooDailyRange();
  const rangeOverrideEnabled = hasYahooDailyRangeOverride();
  const circuit = createYahooFetchCircuit();

  const { results, suppressedCount } = await runWithYahooFetchCircuit(constituents, {
    concurrency: DEFAULT_CONCURRENCY,
    circuit,
    worker: async (item, index) => {
      console.log(`[${index + 1}/${constituents.length}] Fetching ${item.ticker} (${item.yahoo_ticker})`);
      const request = buildYahooFetchRequest({
        latestDate: latestPriceDatesByTicker[item.ticker] || null,
        fallbackRange: yahooDailyRange,
        hasRangeOverride: rangeOverrideEnabled,
      });
      const candles = await fetchYahooDailyCandles(item.yahoo_ticker, request);
      const inserted = await upsertStockDailyPrices(item.ticker, candles);
      return { ticker: item.ticker, candles: inserted };
    },
  });

  for (const [index, result] of results.entries()) {
    if (!result) continue;

    if (result.status === 'fulfilled') {
      successfulTickers += 1;
      totalCandles += result.value.candles;
      continue;
    }

    const item = constituents[index];
    console.warn(`Failed ${item.ticker}: ${result.reason.message}`);
    failedTickers.push({
      ticker: item.ticker,
      yahoo_ticker: item.yahoo_ticker,
      error: result.reason.message,
    });
  }

  return {
    failedTickers,
    successfulTickers,
    totalCandles,
    suppressedTickers: suppressedCount,
    rateLimitError: circuit.error,
  };
}

async function fetchFredData(latestMarketSeriesDates) {
  const failedSeries = [];
  const successfulSeries = [];
  let totalRows = 0;

  for (const definition of FRED_SERIES_DEFINITIONS) {
    const { seriesId } = definition;

    try {
      console.log(`Fetching FRED series ${seriesId}`);
      const rows = await fetchFredSeries(seriesId);
      const incrementalRows = filterFredRowsForUpsert(
        definition,
        rows,
        latestMarketSeriesDates[seriesId] || null
      );
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

async function fetchGlobalPmiData() {
  try {
    console.log('Fetching global manufacturing PMI from Trading Economics HTML pages...');
    const result = await fetchAndStoreGlobalManufacturingPmi();
    return {
      successfulRows: result.inserted,
      failedSeries: result.failures,
      periodDate: result.periodDate,
    };
  } catch (error) {
    console.warn(`Failed global manufacturing PMI scrape: ${error.message}`);
    return {
      successfulRows: 0,
      failedSeries: [{ seriesId: 'GLOBAL_MANUFACTURING_PMI', error: error.message }],
      periodDate: null,
    };
  }
}

async function fetchEuropeGrowthData() {
  try {
    console.log('Fetching Europe growth indicators from Trading Economics HTML pages...');
    const result = await fetchAndStoreEuropeGrowthIndicators();
    return {
      successfulRows: result.inserted,
      failedSeries: result.failures,
      periodDate: result.periodDate,
    };
  } catch (error) {
    console.warn(`Failed Europe growth scrape: ${error.message}`);
    return {
      successfulRows: 0,
      failedSeries: [{ seriesId: 'EUROPE_GROWTH_INDICATORS', error: error.message }],
      periodDate: null,
    };
  }
}

async function run() {
  await failRunningFetchRuns('fetch_daily', 'fetch:daily interrupted before completion', {
    recoveredBy: 'fetch_daily',
  });
  const fetchRunId = await startFetchRun('fetch_daily');
  fetchRunGuard.setRunId(fetchRunId);

  let activeConstituents = [];
  let yahooResult = null;
  let benchmarkResult = null;
  let coverageDecision = null;

  try {
    console.log('Fetching S&P 500 constituents...');
    const constituents = await fetchSp500Constituents();
    await upsertConstituents(constituents);
    const yahooDailyRange = getYahooDailyRange();
    const latestPriceDatesByTicker = await getLatestPriceDatesByTicker();
    const latestBenchmarkDatesByTicker = await getLatestBenchmarkDates();
    const latestMarketSeriesDates = await getLatestMarketSeriesDates();

    activeConstituents = await getActiveConstituents();
    const tickerLimit = getTickerLimit();

    if (yahooDailyRange !== DEFAULT_YAHOO_DAILY_RANGE) {
      console.log(`YAHOO_DAILY_RANGE=${yahooDailyRange}; extending Yahoo history backfill.`);
    }

    if (tickerLimit) {
      console.log(`FETCH_TICKER_LIMIT=${tickerLimit}; limiting Yahoo fetch for local test.`);
      activeConstituents = activeConstituents.slice(0, tickerLimit);
    }

    yahooResult = await fetchYahooForConstituents(activeConstituents, latestPriceDatesByTicker);
    if (yahooResult.rateLimitError) {
      throw yahooResult.rateLimitError;
    }

    benchmarkResult = await fetchBenchmarkData({
      benchmarkTickers: BENCHMARK_TICKERS,
      latestBenchmarkDatesByTicker,
      fallbackRange: yahooDailyRange,
      hasRangeOverride: hasYahooDailyRangeOverride(),
      fetchYahooDailyCandlesFn: fetchYahooDailyCandles,
      upsertBenchmarkDailyPricesFn: upsertBenchmarkDailyPrices,
    });

    if (benchmarkResult.failedBenchmarks.length > 0) {
      throw new Error(
        `Core benchmark data is incomplete: ${benchmarkResult.failedBenchmarks.length} benchmark fetches failed.`
      );
    }

    coverageDecision = buildDailyPriceCoverageDecision({
      observedCount: yahooResult.successfulTickers,
      expectedCount: activeConstituents.length,
    });

    if (!coverageDecision.canContinue) {
      throw new Error(`Daily price coverage is insufficient: ${coverageDecision.reason}`);
    }

    if (coverageDecision.isPartial) {
      console.warn(
        `Continuing with partial Yahoo coverage: ${coverageDecision.coveragePercent}% `
        + `(${coverageDecision.observedCount}/${coverageDecision.expectedCount}); `
        + `missing tickers: ${yahooResult.failedTickers.map((item) => item.ticker).join(', ') || 'none'}.`
      );
    }

    const fredResult = await fetchFredData(latestMarketSeriesDates);
    const globalPmiResult = await fetchGlobalPmiData();
    const europeGrowthResult = await fetchEuropeGrowthData();

    const failedItems =
      yahooResult.failedTickers.length +
      benchmarkResult.failedBenchmarks.length +
      fredResult.failedSeries.length +
      globalPmiResult.failedSeries.length +
      europeGrowthResult.failedSeries.length;
    const status = failedItems > 0 ? 'partial_success' : 'success';
    const completionDetails = buildFetchRunCompletionDetails({
      constituentsParsed: constituents.length,
      activeConstituentCount: activeConstituents.length,
      yahooResult,
      benchmarkResult,
      fredResult,
    });

    await fetchRunGuard.finish(status, {
      ...completionDetails,
      metadata: {
        ...completionDetails.metadata,
        dailyPriceCoverage: coverageDecision,
        failedTickers: yahooResult.failedTickers,
        globalManufacturingPmi: globalPmiResult,
        europeGrowth: europeGrowthResult,
      },
    });

    console.log(`Fetch daily completed with status: ${status}`);
    console.log(`Yahoo: ${yahooResult.successfulTickers}/${activeConstituents.length} tickers succeeded.`);
    console.log(`Daily price coverage: ${coverageDecision.coveragePercent}% (${coverageDecision.observedCount}/${coverageDecision.expectedCount}).`);
    console.log(`Benchmark: ${benchmarkResult.successfulBenchmarks}/${BENCHMARK_TICKERS.length} tickers succeeded.`);
    console.log(`FRED: ${fredResult.successfulSeries.length}/${FRED_SERIES_IDS.length} series succeeded.`);
    console.log(`Global Manufacturing PMI: ${globalPmiResult.successfulRows} rows updated.`);
    console.log(`Europe Growth Indicators: ${europeGrowthResult.successfulRows} rows updated.`);
  } catch (error) {
    await fetchRunGuard.finish('failure', {
      totalItems: activeConstituents.length + BENCHMARK_TICKERS.length,
      successfulItems: (yahooResult?.successfulTickers ?? 0) + (benchmarkResult?.successfulBenchmarks ?? 0),
      failedItems:
        (yahooResult?.failedTickers.length ?? 0)
        + (yahooResult?.suppressedTickers ?? 0)
        + (benchmarkResult?.failedBenchmarks.length ?? 0)
        + (yahooResult?.rateLimitError ? BENCHMARK_TICKERS.length : 0),
      errorMessage: error.message,
      metadata: {
        stack: error.stack,
        dailyPriceCoverage: coverageDecision,
        yahoo: yahooResult ? {
          successfulTickers: yahooResult.successfulTickers,
          failedTickers: yahooResult.failedTickers,
          suppressedTickers: yahooResult.suppressedTickers,
          rateLimited: Boolean(yahooResult.rateLimitError),
          retryAfter: yahooResult.rateLimitError?.retryAfter ?? null,
          skippedBenchmarks: yahooResult.rateLimitError ? BENCHMARK_TICKERS : [],
        } : null,
        benchmark: benchmarkResult ?? null,
      },
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
