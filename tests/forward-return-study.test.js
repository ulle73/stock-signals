import test from 'node:test';
import assert from 'node:assert/strict';
import { runForwardReturnStudy } from '../lib/utils/forward-return-study.js';

const registry = {
  getField(key) {
    return {
      key,
      allowedOperators: ['=', '!=', '>', '>=', '<', '<=', 'between', 'changed_to', 'changed_from', 'crossed_above', 'crossed_below', 'is_true', 'is_false'],
      type: key === 'tf_sync.state' ? 'enum' : 'number',
    };
  },
};

test('forward horizon study detects composite signal starts and summarizes returns per horizon', () => {
  const bars = [
    { date: '2026-01-02', price: 100, values: { 'tf_sync.state': 'neutral', 'market.pct_above_50': 48 } },
    { date: '2026-01-05', price: 102, values: { 'tf_sync.state': 'green', 'market.pct_above_50': 55 } },
    { date: '2026-01-06', price: 101, values: { 'tf_sync.state': 'green', 'market.pct_above_50': 56 } },
    { date: '2026-01-07', price: 105, values: { 'tf_sync.state': 'red', 'market.pct_above_50': 47 } },
    { date: '2026-01-08', price: 107, values: { 'tf_sync.state': 'green', 'market.pct_above_50': 58 } },
    { date: '2026-01-09', price: 110, values: { 'tf_sync.state': 'green', 'market.pct_above_50': 59 } },
  ];

  const result = runForwardReturnStudy(
    {
      name: 'tf-sync-forward',
      studyType: 'forward_horizon',
      returnInstrument: 'SPY',
      maxHorizonDays: 2,
      eventMode: 'signal_start',
      conditionMode: 'ALL',
      conditions: [
        { field: 'tf_sync.state', operator: 'changed_to', value: 'green' },
        { field: 'market.pct_above_50', operator: '>', value: 50 },
      ],
    },
    { bars, registry }
  );

  assert.equal(result.eventCount, 2);
  assert.deepEqual(result.events.map((item) => item.signal_date), ['2026-01-05', '2026-01-08']);
  assert.deepEqual(result.horizons, [
    {
      horizon_days: 1,
      sample_count: 2,
      avg_return_pct: 0.91,
      median_return_pct: 0.91,
      win_rate_pct: 50,
      best_return_pct: 2.8,
      worst_return_pct: -0.98,
    },
    {
      horizon_days: 2,
      sample_count: 1,
      avg_return_pct: 2.94,
      median_return_pct: 2.94,
      win_rate_pct: 100,
      best_return_pct: 2.94,
      worst_return_pct: 2.94,
    },
  ]);
});
