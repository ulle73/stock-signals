import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboardBacktestRows,
  buildTickerMarkovDashboardBacktestRow,
  formatTickerMarkovStrategyName,
} from '../lib/repositories/dashboard.js';

test('formatTickerMarkovStrategyName humanizes ticker Markov study names', () => {
  assert.equal(
    formatTickerMarkovStrategyName('top_20_bull_weekly_no_risk_off'),
    'Ticker Markov Top 20 Bull Weekly No Risk Off'
  );
  assert.equal(
    formatTickerMarkovStrategyName('bottom_10_bear_weekly'),
    'Ticker Markov Bottom 10 Bear Weekly'
  );
});

test('buildDashboardBacktestRows merges and sorts standard and ticker Markov backtests by finished time', () => {
  const rows = buildDashboardBacktestRows({
    backtestRows: [
      {
        code: 'buy_and_hold_spy',
        name: 'Buy and Hold SPY',
        finished_at: '2026-06-05T23:12:00.000Z',
      },
    ],
    tickerMarkovRows: [
      {
        code: 'ticker_markov_top_20_bull_weekly',
        name: 'Ticker Markov Top 20 Bull Weekly',
        finished_at: '2026-06-06T09:30:00.000Z',
      },
      {
        code: 'ticker_markov_top_10_bull_daily',
        name: 'Ticker Markov Top 10 Bull Daily',
        finished_at: '2026-06-06T09:30:00.000Z',
      },
    ],
  });

  assert.deepEqual(rows.map((row) => row.code), [
    'ticker_markov_top_10_bull_daily',
    'ticker_markov_top_20_bull_weekly',
    'buy_and_hold_spy',
  ]);
});

test('buildTickerMarkovDashboardBacktestRow converts decimal drawdown to percent points', () => {
  const row = buildTickerMarkovDashboardBacktestRow({
    code: 'ticker_markov_top_10_bull_weekly',
    strategy_name: 'top_10_bull_weekly',
    cagr: '19.75',
    max_drawdown: '-0.301638',
    time_in_market_pct: '93.69',
    finished_at: '2026-06-07T12:11:16.598Z',
  });

  assert.equal(row.name, 'Ticker Markov Top 10 Bull Weekly');
  assert.equal(row.max_drawdown, '-30.1638');
});
