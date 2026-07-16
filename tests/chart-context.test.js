import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBreadthContext,
  buildEarningsContext,
  buildRelativeStrengthContext,
  buildVolatilityContext,
  buildWilderAtrSeries,
  normalizeGexDexSnapshots,
} from '../lib/chart/chart-context.js';

test('relative strength uses 63d percentile and 21d five-observation direction', () => {
  const rows = Array.from({ length: 6 }, (_, index) => ({
    date: `2026-07-0${index + 1}`,
    rs_21d_vs_spy: index === 0 ? '0.02' : String(0.02 + index * 0.01),
    rs_63d_vs_spy: '0.08',
    rs_126d_vs_spy: '0.11',
    rs_percentile_21d: '70',
    rs_percentile_63d: '78',
    rs_percentile_126d: '81',
  }));
  const context = buildRelativeStrengthContext(rows);
  assert.equal(context.direction, 'improving');
  assert.equal(context.percentile63d, 78);
  assert.equal(context.percentile126d, 81);
});

test('breadth requires a two percentage point move for direction', () => {
  const sectorRows = Array.from({ length: 6 }, (_, index) => ({ date: `2026-07-0${index + 1}`, pct_above_sma50: index === 0 ? '60' : index === 5 ? '62' : '61' }));
  const stable = buildBreadthContext({ sectorRows, marketRows: [{ date: '2026-07-06', pct_above_sma50: '58' }] });
  assert.equal(stable.direction, 'stable');
  sectorRows[5].pct_above_sma50 = '62.1';
  assert.equal(buildBreadthContext({ sectorRows }).direction, 'improving');
});

test('Wilder ATR uses the initial average and recursive smoothing', () => {
  const rows = Array.from({ length: 15 }, (_, index) => ({
    date: `2026-01-${String(index + 1).padStart(2, '0')}`,
    open: '100', high: '102', low: '100', close: '101', adj_close: '101',
  }));
  const series = buildWilderAtrSeries(rows, 14);
  assert.equal(series.length, 2);
  assert.equal(series[0].atr, 2);
  assert.equal(series[1].atr, 2);
});

test('volatility classifies low ATR percentile as compression', () => {
  const rows = Array.from({ length: 80 }, (_, index) => {
    const range = index === 79 ? 0.5 : 2 + (index % 10) * 0.2;
    const close = 100 + index * 0.1;
    return {
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      open: String(close), high: String(close + range / 2), low: String(close - range / 2), close: String(close), adj_close: String(close),
    };
  });
  const context = buildVolatilityContext(rows);
  assert.ok(context);
  assert.equal(context.regime, 'compression');
  assert.ok(context.percentile <= 25);
});

test('earnings are deduplicated and only real bar dates become markers', () => {
  const context = buildEarningsContext([
    { earnings_date: '2026-07-10', confirmed: false, source_status: 'active' },
    { earnings_date: '2026-07-10', confirmed: true, source_status: 'active' },
    { earnings_date: '2026-08-01', confirmed: false, source_status: 'active' },
  ], ['2026-07-09', '2026-07-10'], '2026-07-15');
  assert.deepEqual(context.events, [{ date: '2026-07-10', confirmed: true, sourceStatus: 'active' }]);
  assert.equal(context.nextEarnings.date, '2026-08-01');
  assert.equal(context.nextEarnings.daysUntil, 17);
});

test('GEX snapshots collapse to the latest real snapshot per date', () => {
  const snapshots = normalizeGexDexSnapshots([
    { source_timestamp: '2026-07-10T12:00:00Z', call_wall: '300', key_levels: { vol_trigger: '290' } },
    { source_timestamp: '2026-07-10T18:00:00Z', call_wall: '305', key_levels: { vol_trigger: '292' } },
    { source_timestamp: '2026-07-11T12:00:00Z', call_wall: '310' },
  ]);
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].callWall, 305);
  assert.equal(snapshots[0].volTrigger, 292);
});
