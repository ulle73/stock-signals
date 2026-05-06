import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFredCsv } from '../lib/sources/fred.js';

test('parseFredCsv accepts observation_date headers from FRED', () => {
  const csv = [
    'observation_date,SP500',
    '2025-01-01,100',
    '2025-01-02,101',
  ].join('\n');

  assert.deepEqual(parseFredCsv('SP500', csv), [
    { series_id: 'SP500', date: '2025-01-01', value: 100 },
    { series_id: 'SP500', date: '2025-01-02', value: 101 },
  ]);
});
