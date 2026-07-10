import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSectorOverviewRows } from '../lib/indicators/sector-overview-momentum.js';

function dateAt(index) {
  return `2026-06-${String(index + 1).padStart(2, '0')}`;
}

test('buildSectorOverviewRows compounds stored daily sector returns and compares prior ROC', () => {
  const dailyRows = Array.from({ length: 22 }, (_, index) => ({
    date: dateAt(index),
    sector: 'Information Technology',
    daily_return_pct: index < 17 ? '1' : '2',
  }));

  const [row] = buildSectorOverviewRows({
    dailyRows,
    strengthRows: [{ sector: 'Information Technology', strength: '67.5' }],
    breadthRows: [{ sector: 'Information Technology', pct_above_sma50: '70' }],
    signalRows: [{ sector: 'Information Technology', signal: 'leading' }],
  });

  assert.equal(row.sector, 'Information Technology');
  assert.equal(row.strength, 67.5);
  assert.equal(row.return1d, 2);
  assert.equal(row.return1w, 10.40808);
  assert.equal(row.roc5d, 10.40808);
  assert.equal(row.acceleration5d, 5.307075);
  assert.equal(row.return1m, 29.462157);
  assert.equal(row.sparkline.length, 21);
  assert.equal(row.breadth, 70);
  assert.equal(row.signal, 'leading');
});

test('buildSectorOverviewRows averages constituents by sector and preserves incomplete history', () => {
  const rows = buildSectorOverviewRows({
    dailyRows: [
      { date: '2026-07-09', sector: 'Utilities', daily_return_pct: '0.5' },
      { date: '2026-07-09', sector: 'Utilities', daily_return_pct: '1.5' },
    ],
    strengthRows: [],
    breadthRows: [],
    signalRows: [],
  });

  assert.deepEqual(rows, [{
    sector: 'Utilities',
    strength: null,
    return1d: 1,
    return1w: null,
    return1m: null,
    roc5d: null,
    acceleration5d: null,
    sparkline: [1],
    breadth: null,
    signal: null,
  }]);
});
