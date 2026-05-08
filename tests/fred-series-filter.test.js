import test from 'node:test';
import assert from 'node:assert/strict';
import { filterFredRowsForUpsert } from '../lib/utils/fred-series.js';

test('filterFredRowsForUpsert keeps a short overlap for daily FRED series', () => {
  const rows = [
    { date: '2026-05-01', value: 1 },
    { date: '2026-05-02', value: 2 },
    { date: '2026-05-03', value: 3 },
    { date: '2026-05-04', value: 4 },
    { date: '2026-05-05', value: 5 },
  ];

  assert.deepEqual(
    filterFredRowsForUpsert(
      { seriesId: 'VIXCLS', cadence: 'daily', domain: 'market' },
      rows,
      '2026-05-05'
    ),
    [
      { date: '2026-05-02', value: 2 },
      { date: '2026-05-03', value: 3 },
      { date: '2026-05-04', value: 4 },
      { date: '2026-05-05', value: 5 },
    ]
  );
});

test('filterFredRowsForUpsert keeps the full history for monthly FRED series', () => {
  const rows = [
    { date: '2026-01-01', value: 4.1 },
    { date: '2026-02-01', value: 4.0 },
    { date: '2026-03-01', value: 4.2 },
    { date: '2026-04-01', value: 4.3 },
  ];

  assert.deepEqual(
    filterFredRowsForUpsert(
      { seriesId: 'UNRATE', cadence: 'monthly', domain: 'labor' },
      rows,
      '2026-04-01'
    ),
    rows
  );
});
