import { buildYahooFetchRequest } from './incremental-fetch.js';

export async function fetchBenchmarkData({
  benchmarkTickers = ['SPY'],
  latestBenchmarkDatesByTicker = {},
  fallbackRange,
  hasRangeOverride,
  fetchYahooDailyCandlesFn,
  upsertBenchmarkDailyPricesFn,
  client = null,
  logger = console,
}) {
  const failedBenchmarks = [];
  let successfulBenchmarks = 0;
  let totalRows = 0;

  for (const ticker of benchmarkTickers) {
    try {
      logger.log(`Fetching benchmark ${ticker}`);
      const request = buildYahooFetchRequest({
        latestDate: latestBenchmarkDatesByTicker[ticker] || null,
        fallbackRange,
        hasRangeOverride,
      });
      const candles = await fetchYahooDailyCandlesFn(ticker, request);
      const rows = candles.map((row) => ({ ticker, ...row }));
      const inserted = await upsertBenchmarkDailyPricesFn(client, rows);
      successfulBenchmarks += 1;
      totalRows += inserted;
    } catch (error) {
      logger.warn(`Failed benchmark ${ticker}: ${error.message}`);
      failedBenchmarks.push({ ticker, error: error.message });
    }
  }

  return { failedBenchmarks, successfulBenchmarks, totalRows };
}

export function buildFetchRunCompletionDetails({
  constituentsParsed,
  activeConstituentCount,
  yahooResult,
  benchmarkResult,
  fredResult,
}) {
  const benchmarkAttempted = benchmarkResult.successfulBenchmarks + benchmarkResult.failedBenchmarks.length;
  const fredAttempted = fredResult.successfulSeries.length + fredResult.failedSeries.length;
  const failedItems =
    yahooResult.failedTickers.length +
    benchmarkResult.failedBenchmarks.length +
    fredResult.failedSeries.length;

  return {
    totalItems: activeConstituentCount + benchmarkAttempted + fredAttempted,
    successfulItems:
      yahooResult.successfulTickers +
      benchmarkResult.successfulBenchmarks +
      fredResult.successfulSeries.length,
    failedItems,
    metadata: {
      constituentsParsed,
      tickersAttempted: activeConstituentCount,
      yahoo: yahooResult,
      benchmark: benchmarkResult,
      fred: fredResult,
    },
  };
}
