import test from 'node:test';
import assert from 'node:assert/strict';
import { runStatePeriodStudy } from '../lib/utils/state-period-study.js';

const registry = {
  getField(key) {
    return {
      key,
      allowedOperators: ['=', '!=', '>', '>=', '<', '<=', 'between', 'changed_to', 'changed_from', 'crossed_above', 'crossed_below', 'is_true', 'is_false'],
      type: key === 'tf_sync.state' ? 'enum' : 'number',
    };
  },
};

test('state period study enters after signal start and exits after neutral streak with delay bars', () => {
  const bars = [
    { date: '2026-02-02', price: 100, values: { 'tf_sync.state': 'neutral', 'position.target_equity_weight_pct': 80, 'market.pct_above_50': 52 } },
    { date: '2026-02-03', price: 101, values: { 'tf_sync.state': 'green', 'position.target_equity_weight_pct': 80, 'market.pct_above_50': 54 } },
    { date: '2026-02-04', price: 104, values: { 'tf_sync.state': 'green', 'position.target_equity_weight_pct': 80, 'market.pct_above_50': 55 } },
    { date: '2026-02-05', price: 106, values: { 'tf_sync.state': 'green', 'position.target_equity_weight_pct': 80, 'market.pct_above_50': 56 } },
    { date: '2026-02-06', price: 107, values: { 'tf_sync.state': 'neutral', 'position.target_equity_weight_pct': 80, 'market.pct_above_50': 57 } },
    { date: '2026-02-09', price: 108, values: { 'tf_sync.state': 'neutral', 'position.target_equity_weight_pct': 80, 'market.pct_above_50': 58 } },
    { date: '2026-02-10', price: 110, values: { 'tf_sync.state': 'neutral', 'position.target_equity_weight_pct': 80, 'market.pct_above_50': 59 } },
    { date: '2026-02-11', price: 112, values: { 'tf_sync.state': 'red', 'position.target_equity_weight_pct': 80, 'market.pct_above_50': 45 } },
  ];

  const result = runStatePeriodStudy(
    {
      name: 'tf-sync-green-period',
      studyType: 'state_period',
      returnInstrument: 'SPY',
      stateField: 'tf_sync.state',
      entryState: 'green',
      oppositeState: 'red',
      neutralState: 'neutral',
      neutralEndDays: 2,
      entryDelayBars: 1,
      exitDelayBars: 1,
      filtersApplyAt: 'entry',
      filterMode: 'ALL',
      filters: [
        { field: 'position.target_equity_weight_pct', operator: '>=', value: 75 },
        { field: 'market.pct_above_50', operator: '>', value: 50 },
      ],
    },
    { bars, registry }
  );

  assert.deepEqual(result.periods, [
    {
      signal_start_date: '2026-02-03',
      entry_date: '2026-02-04',
      end_signal_date: '2026-02-09',
      exit_date: '2026-02-10',
      bars_held: 4,
      entry_price: 104,
      exit_price: 110,
      return_pct: 5.77,
      end_reason: 'neutral_streak_2',
    },
  ]);

  assert.deepEqual(result.summary, {
    period_count: 1,
    avg_return_pct: 5.77,
    median_return_pct: 5.77,
    win_rate_pct: 100,
    avg_bars_held: 4,
    median_bars_held: 4,
    best_return_pct: 5.77,
    worst_return_pct: 5.77,
  });
});
