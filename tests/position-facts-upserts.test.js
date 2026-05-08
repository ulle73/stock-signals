import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPositionFactUpsertStatements } from '../lib/repositories/position-facts.js';

test('buildPositionFactUpsertStatements batches daily position fact rows into one statement', () => {
  const rows = [
    {
      date: '2026-04-02',
      sp500: 105,
      sp500_200dma: 104,
      sp500_pct_from_200dma: 0.961538,
      vix: 31,
      high_yield_spread: 6.1,
      yield_curve_spread: -0.3,
      fed_funds: 4.5,
      fed_funds_change: -0.25,
      unemployment_rate: 4.5,
      unemployment_rate_change: 0.4,
      cpi_index: 105.6,
      cpi_yoy: 5.6,
      cpi_yoy_change: -0.4,
      consumer_sentiment: 65,
      consumer_sentiment_change: 7,
      sp500_observation_date: '2026-04-02',
      vix_observation_date: '2026-04-02',
      high_yield_observation_date: '2026-04-02',
      yield_curve_observation_date: '2026-04-02',
      fed_funds_observation_date: '2026-04-01',
      unemployment_observation_date: '2026-04-01',
      cpi_observation_date: '2026-04-01',
      consumer_sentiment_observation_date: '2026-04-01',
      sp500_trend_regime: 'above_200dma',
      vix_regime: 'stress',
      credit_regime: 'stress',
      yield_curve_regime: 'inverted',
      fed_policy_trend: 'easing',
      labor_trend: 'deteriorating',
      inflation_trend: 'cooling',
      sentiment_trend: 'improving',
      yield_curve_inverted: true,
    },
  ];

  const statements = buildPositionFactUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into position_facts_daily/i);
  assert.match(statements[0].sql, /on conflict \(date\) do update set/i);
  assert.deepEqual(statements[0].params, [
    '2026-04-02',
    '105',
    '104',
    '0.961538',
    '31',
    '6.1',
    '-0.3',
    '4.5',
    '-0.25',
    '4.5',
    '0.4',
    '105.6',
    '5.6',
    '-0.4',
    '65',
    '7',
    '2026-04-02',
    '2026-04-02',
    '2026-04-02',
    '2026-04-02',
    '2026-04-01',
    '2026-04-01',
    '2026-04-01',
    '2026-04-01',
    'above_200dma',
    'stress',
    'stress',
    'inverted',
    'easing',
    'deteriorating',
    'cooling',
    'improving',
    true,
  ]);
});
