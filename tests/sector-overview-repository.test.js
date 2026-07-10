import assert from 'node:assert/strict';
import test from 'node:test';
import { getSectorOverviewSnapshot } from '../lib/repositories/sector-overview.js';

test('getSectorOverviewSnapshot reads existing sector sources and assembles the calculated rows', async () => {
  const calls = [];
  const responses = [
    {
      rows: [
        { date: '2026-07-08', sector: 'Financials', daily_return_pct: '1' },
        { date: '2026-07-09', sector: 'Financials', daily_return_pct: '2' },
      ],
    },
    { rows: [{ sector: 'Financials', strength: '61.5' }] },
    { rows: [{ sector: 'Financials', pct_above_sma50: '82.5' }] },
    { rows: [{ sector: 'Financials', signal: 'leading' }] },
  ];
  const queryClient = {
    async query(sql) {
      calls.push(sql);
      return responses[calls.length - 1];
    },
  };

  const snapshot = await getSectorOverviewSnapshot(queryClient);
  const sql = calls.join('\n');

  assert.equal(calls.length, 4);
  assert.match(sql, /stock_daily_indicators/i);
  assert.match(sql, /sp500_constituents/i);
  assert.match(sql, /sector_breadth_daily/i);
  assert.match(sql, /sector_signal_daily/i);
  assert.match(sql, /stock_relative_strength_daily/i);
  assert.doesNotMatch(sql, /insert|update|delete|alter|create/i);
  assert.equal(snapshot.asOfDate, '2026-07-09');
  assert.deepEqual(snapshot.rows, [{
    sector: 'Financials',
    strength: 61.5,
    return1d: 2,
    return1w: null,
    return1m: null,
    roc5d: null,
    acceleration5d: null,
    sparkline: [1, 3.02],
    breadth: 82.5,
    signal: 'leading',
  }]);
});
