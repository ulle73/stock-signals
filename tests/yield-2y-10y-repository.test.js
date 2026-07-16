import test from 'node:test';
import assert from 'node:assert/strict';
import { buildYield2y10yUpsertStatements } from '../lib/repositories/yield-2y-10y-indicator.js';

test('yield repository builds parameterized idempotent upserts', () => {
  const [statement] = buildYield2y10yUpsertStatements([{
    date: '2026-02-03',
    two_year: 2.5,
    ten_year: 5,
    effr: 6,
    smooth_effr_5: 5.2,
    prev_effr: 5,
    prev_smooth_effr_5: 5,
    frr_2_10: 1.125,
    is_long: true,
    is_short: false,
    is_inverted: false,
    buy_signal: true,
    sell_signal: false,
    signal: 'buy',
  }]);

  assert.match(statement.sql, /insert into yield_2y_10y_indicator_daily/i);
  assert.match(statement.sql, /on conflict \(date\) do update/i);
  assert.match(statement.sql, /buy_signal = excluded\.buy_signal/i);
  assert.equal(statement.params.length, 14);
  assert.deepEqual(statement.params, [
    '2026-02-03', 2.5, 5, 6, 5.2, 5, 5, 1.125,
    true, false, false, true, false, 'buy',
  ]);
});

test('yield repository chunks large writes without losing rows', () => {
  const rows = Array.from({ length: 5 }, (_, index) => ({
    date: `2026-01-0${index + 1}`,
    signal: 'none',
  }));
  const statements = buildYield2y10yUpsertStatements(rows, 2);
  assert.equal(statements.length, 3);
  assert.deepEqual(statements.map((statement) => statement.params.length), [28, 28, 14]);
});
