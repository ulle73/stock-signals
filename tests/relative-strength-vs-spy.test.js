import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRelativeStrengthRows } from '../lib/indicators/relative-strength-vs-spy.js';
import { buildRelativeStrengthUpsertStatements } from '../lib/repositories/relative-strength.js';

function buildPriceRows(ticker, prices, startDate = '2026-01-01') {
  const start = new Date(`${startDate}T00:00:00Z`);

  return prices.map((price, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);

    return {
      ticker,
      date: date.toISOString().slice(0, 10),
      close: price,
      adj_close: price,
    };
  });
}

test('buildRelativeStrengthRows applies the ratio-vs-SPY definition and leaves warmup rows null', () => {
  const priceRows = [
    ...buildPriceRows('AAA', [100, 102, 104]),
  ];
  const benchmarkRows = buildPriceRows('SPY', [100, 101, 102]);

  const rows = buildRelativeStrengthRows({
    priceRows,
    benchmarkRows,
    lookbackPeriods: {
      rs_21d_vs_spy: 2,
      rs_63d_vs_spy: 63,
      rs_126d_vs_spy: 126,
    },
  });

  assert.deepEqual(rows, [
    {
      ticker: 'AAA',
      date: '2026-01-01',
      benchmark_ticker: 'SPY',
      rs_21d_vs_spy: null,
      rs_63d_vs_spy: null,
      rs_126d_vs_spy: null,
      rs_rank_21d: null,
      rs_rank_63d: null,
      rs_rank_126d: null,
      rs_percentile_21d: null,
      rs_percentile_63d: null,
      rs_percentile_126d: null,
    },
    {
      ticker: 'AAA',
      date: '2026-01-02',
      benchmark_ticker: 'SPY',
      rs_21d_vs_spy: null,
      rs_63d_vs_spy: null,
      rs_126d_vs_spy: null,
      rs_rank_21d: null,
      rs_rank_63d: null,
      rs_rank_126d: null,
      rs_percentile_21d: null,
      rs_percentile_63d: null,
      rs_percentile_126d: null,
    },
    {
      ticker: 'AAA',
      date: '2026-01-03',
      benchmark_ticker: 'SPY',
      rs_21d_vs_spy: 1.960784,
      rs_63d_vs_spy: null,
      rs_126d_vs_spy: null,
      rs_rank_21d: 1,
      rs_rank_63d: null,
      rs_rank_126d: null,
      rs_percentile_21d: 100,
      rs_percentile_63d: null,
      rs_percentile_126d: null,
    },
  ]);
});

test('buildRelativeStrengthRows ranks each date across the active universe with deterministic ticker tie-breaks', () => {
  const priceRows = [
    ...buildPriceRows('AAA', [100, 102, 104]),
    ...buildPriceRows('BBB', [100, 103, 106]),
    ...buildPriceRows('CCC', [100, 101, 102]),
  ];
  const benchmarkRows = buildPriceRows('SPY', [100, 101, 102]);

  const rows = buildRelativeStrengthRows({
    priceRows,
    benchmarkRows,
    lookbackPeriods: {
      rs_21d_vs_spy: 2,
      rs_63d_vs_spy: 63,
      rs_126d_vs_spy: 126,
    },
  }).filter((row) => row.date === '2026-01-03');

  assert.deepEqual(rows, [
    {
      ticker: 'AAA',
      date: '2026-01-03',
      benchmark_ticker: 'SPY',
      rs_21d_vs_spy: 1.960784,
      rs_63d_vs_spy: null,
      rs_126d_vs_spy: null,
      rs_rank_21d: 2,
      rs_rank_63d: null,
      rs_rank_126d: null,
      rs_percentile_21d: 66.666667,
      rs_percentile_63d: null,
      rs_percentile_126d: null,
    },
    {
      ticker: 'BBB',
      date: '2026-01-03',
      benchmark_ticker: 'SPY',
      rs_21d_vs_spy: 3.921569,
      rs_63d_vs_spy: null,
      rs_126d_vs_spy: null,
      rs_rank_21d: 1,
      rs_rank_63d: null,
      rs_rank_126d: null,
      rs_percentile_21d: 100,
      rs_percentile_63d: null,
      rs_percentile_126d: null,
    },
    {
      ticker: 'CCC',
      date: '2026-01-03',
      benchmark_ticker: 'SPY',
      rs_21d_vs_spy: 0,
      rs_63d_vs_spy: null,
      rs_126d_vs_spy: null,
      rs_rank_21d: 3,
      rs_rank_63d: null,
      rs_rank_126d: null,
      rs_percentile_21d: 33.333333,
      rs_percentile_63d: null,
      rs_percentile_126d: null,
    },
  ]);
});

test('buildRelativeStrengthUpsertStatements batches RS rows for storage', () => {
  const statements = buildRelativeStrengthUpsertStatements([
    {
      ticker: 'AAPL',
      date: '2026-06-27',
      benchmark_ticker: 'SPY',
      rs_21d_vs_spy: 4.25,
      rs_63d_vs_spy: 7.5,
      rs_126d_vs_spy: 12.75,
      rs_rank_21d: 8,
      rs_rank_63d: 6,
      rs_rank_126d: 4,
      rs_percentile_21d: 98.5,
      rs_percentile_63d: 99,
      rs_percentile_126d: 99.5,
    },
  ], 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into stock_relative_strength_daily/i);
  assert.match(statements[0].sql, /on conflict \(ticker, date\) do update set/i);
  assert.deepEqual(statements[0].params, [
    'AAPL',
    '2026-06-27',
    'SPY',
    '4.25',
    '7.5',
    '12.75',
    8,
    6,
    4,
    '98.5',
    '99',
    '99.5',
  ]);
});
