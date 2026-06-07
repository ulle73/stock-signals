import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTickerMarkovStrategyStudy,
  DEFAULT_TICKER_MARKOV_STRATEGIES,
} from '../lib/utils/ticker-markov-strategy-study.js';

test('default ticker Markov strategies no longer include exclude-bottom-bear variants', () => {
  const names = DEFAULT_TICKER_MARKOV_STRATEGIES.map((strategy) => strategy.name);

  assert.equal(
    names.some((name) => name.includes('exclude_bottom_20_bear')),
    false
  );
});

test('ticker Markov strategies only hold signal-aligned names by side', () => {
  const study = buildTickerMarkovStrategyStudy({
    priceRows: [
      { ticker: 'AAA', date: '2026-01-01', open: '100' },
      { ticker: 'AAA', date: '2026-01-02', open: '101' },
      { ticker: 'AAA', date: '2026-01-03', open: '102' },
      { ticker: 'BBB', date: '2026-01-01', open: '100' },
      { ticker: 'BBB', date: '2026-01-02', open: '99' },
      { ticker: 'BBB', date: '2026-01-03', open: '98' },
      { ticker: 'CCC', date: '2026-01-01', open: '100' },
      { ticker: 'CCC', date: '2026-01-02', open: '98' },
      { ticker: 'CCC', date: '2026-01-03', open: '97' },
    ],
    markovRows: [
      { ticker: 'AAA', date: '2026-01-01', markov_total: '0.60', sample_size: 60, signal: 'bull' },
      { ticker: 'BBB', date: '2026-01-01', markov_total: '0.85', sample_size: 60, signal: 'neutral' },
      { ticker: 'CCC', date: '2026-01-01', markov_total: '-0.90', sample_size: 60, signal: 'sell' },
    ],
    strategies: [
      { name: 'long_only', size: 2, side: 'long', rebalanceFrequency: 'daily', holdingDays: 1, minSampleSize: 50 },
      { name: 'short_only', size: 2, side: 'short', rebalanceFrequency: 'daily', holdingDays: 1, minSampleSize: 50 },
    ],
  });

  const longRow = study.dailyRows.find((row) => row.strategy_name === 'long_only');
  const shortRow = study.dailyRows.find((row) => row.strategy_name === 'short_only');

  assert.deepEqual(longRow?.tickers, ['AAA']);
  assert.deepEqual(shortRow?.tickers, ['CCC']);
});
