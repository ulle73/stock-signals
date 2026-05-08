import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBacktestRunRetentionStatement,
  buildStrategyDefinitionUpsertStatements,
  buildStrategyEquityUpsertStatements,
  buildStrategyPositionUpsertStatements,
} from '../lib/repositories/backtests.js';

test('buildStrategyDefinitionUpsertStatements upserts strategy definitions by code', () => {
  const definitions = [
    {
      code: 'buy_and_hold_spy',
      name: 'Buy and Hold SPY',
      description: 'Always long',
      benchmark_symbol: 'SPY',
      execution_model: 'next_open',
      out_of_market_mode: 'cash',
      transaction_cost_bps: 5,
      universe_mode: 'current_constituents',
      point_in_time_supported: false,
      rule_source: 'always_long',
      params_json: { initial_state: 'long' },
      is_active: true,
    },
  ];

  const statements = buildStrategyDefinitionUpsertStatements(definitions, 1);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into strategy_definitions/i);
  assert.match(statements[0].sql, /on conflict \(code\) do update set/i);
  assert.deepEqual(statements[0].params, [
    'buy_and_hold_spy',
    'Buy and Hold SPY',
    'Always long',
    'SPY',
    'next_open',
    'cash',
    5,
    'current_constituents',
    false,
    'always_long',
    JSON.stringify({ initial_state: 'long' }),
    true,
  ]);
});

test('buildStrategyPositionUpsertStatements batches daily positions by run and date', () => {
  const rows = [
    {
      run_id: 1,
      date: '2026-01-02',
      signal_date: '2026-01-01',
      effective_trade_date: '2026-01-02',
      target_state: 'long',
      applied_state: 'long',
      target_equity_weight: 1,
      applied_equity_weight: 1,
      trade_action: 'enter',
      reason_code: 'always_long',
    },
    {
      run_id: 1,
      date: '2026-01-03',
      signal_date: '2026-01-02',
      effective_trade_date: null,
      target_state: 'long',
      applied_state: 'long',
      target_equity_weight: 1,
      applied_equity_weight: 1,
      trade_action: 'hold',
      reason_code: 'always_long',
    },
  ];

  const statements = buildStrategyPositionUpsertStatements(rows, 2);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into strategy_positions_daily/i);
  assert.match(statements[0].sql, /on conflict \(run_id, date\) do update set/i);
  assert.deepEqual(statements[0].params, [
    1, '2026-01-02', '2026-01-01', '2026-01-02', 'long', 'long', '1', '1', 'enter', 'always_long',
    1, '2026-01-03', '2026-01-02', null, 'long', 'long', '1', '1', 'hold', 'always_long',
  ]);
});

test('buildStrategyEquityUpsertStatements batches daily equity rows by run and date', () => {
  const rows = [
    {
      run_id: 1,
      date: '2026-01-02',
      start_equity: 100,
      end_equity: 100.95,
      strategy_return_pct: 0.95,
      benchmark_return_pct: 1.0,
      cash_weight: 0,
      equity_weight: 1,
      transaction_cost_pct: 0.05,
      transaction_cost_amount: 0.05,
      drawdown_pct: 0,
      is_in_market: true,
    },
  ];

  const statements = buildStrategyEquityUpsertStatements(rows, 1);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into strategy_equity_daily/i);
  assert.match(statements[0].sql, /on conflict \(run_id, date\) do update set/i);
  assert.deepEqual(statements[0].params, [
    1, '2026-01-02', '100', '100.95', '0.95', '1', '0', '1', '0.05', '0.05', '0', true,
  ]);
});

test('buildBacktestRunRetentionStatement prunes older runs for one strategy and status while keeping the latest N', () => {
  const statement = buildBacktestRunRetentionStatement({
    strategyId: 42,
    status: 'success',
    retainedRuns: 1,
  });

  assert.match(statement.sql, /delete from backtest_runs/i);
  assert.match(statement.sql, /where strategy_id = \$1/i);
  assert.match(statement.sql, /status = \$2/i);
  assert.match(statement.sql, /offset \$3/i);
  assert.deepEqual(statement.params, [42, 'success', 1]);
});
