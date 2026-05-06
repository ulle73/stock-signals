import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFetchRunCompletionDetails,
  fetchBenchmarkData,
} from '../lib/utils/fetch-benchmark.js';

test('fetchBenchmarkData fetches benchmark candles and upserts them with ticker attached', async () => {
  const fetchCalls = [];
  const upsertCalls = [];

  const result = await fetchBenchmarkData({
    benchmarkTickers: ['SPY'],
    latestBenchmarkDatesByTicker: { SPY: '2026-05-01' },
    fallbackRange: '400d',
    hasRangeOverride: false,
    fetchYahooDailyCandlesFn: async (ticker, request) => {
      fetchCalls.push({ ticker, request });
      return [
        {
          date: '2026-05-05',
          open: 728.15,
          high: 734.58,
          low: 727.82,
          close: 733.83,
          adj_close: 733.83,
          volume: 52501644,
        },
      ];
    },
    upsertBenchmarkDailyPricesFn: async (client, rows) => {
      upsertCalls.push({ client, rows });
      return rows.length;
    },
    logger: {
      log() {},
      warn() {},
    },
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].ticker, 'SPY');
  assert.match(String(fetchCalls[0].request.period1), /^\d+$/);
  assert.match(String(fetchCalls[0].request.period2), /^\d+$/);

  assert.equal(upsertCalls.length, 1);
  assert.equal(upsertCalls[0].client, null);
  assert.deepEqual(upsertCalls[0].rows, [
    {
      ticker: 'SPY',
      date: '2026-05-05',
      open: 728.15,
      high: 734.58,
      low: 727.82,
      close: 733.83,
      adj_close: 733.83,
      volume: 52501644,
    },
  ]);

  assert.deepEqual(result, {
    failedBenchmarks: [],
    successfulBenchmarks: 1,
    totalRows: 1,
  });
});

test('buildFetchRunCompletionDetails includes benchmark counts in final metadata', () => {
  const details = buildFetchRunCompletionDetails({
    constituentsParsed: 503,
    activeConstituentCount: 503,
    yahooResult: {
      failedTickers: [],
      successfulTickers: 503,
      totalCandles: 200839,
    },
    benchmarkResult: {
      failedBenchmarks: [],
      successfulBenchmarks: 1,
      totalRows: 5,
    },
    fredResult: {
      failedSeries: [],
      successfulSeries: [
        { seriesId: 'SP500', rows: 1 },
        { seriesId: 'VIXCLS', rows: 1 },
        { seriesId: 'BAMLH0A0HYM2', rows: 1 },
      ],
      totalRows: 3,
    },
  });

  assert.equal(details.totalItems, 507);
  assert.equal(details.successfulItems, 507);
  assert.equal(details.failedItems, 0);
  assert.deepEqual(details.metadata.benchmark, {
    failedBenchmarks: [],
    successfulBenchmarks: 1,
    totalRows: 5,
  });
});
