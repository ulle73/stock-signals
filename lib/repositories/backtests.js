import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const STRATEGY_BATCH_SIZE = 50;
const POSITION_BATCH_SIZE = 100;
const EQUITY_BATCH_SIZE = 100;

export function buildBacktestRunRetentionStatement({ strategyId, status, retainedRuns }) {
  return {
    sql: `delete from backtest_runs
      where id in (
        select id
        from backtest_runs
        where strategy_id = $1
          and status = $2
        order by finished_at desc nulls last, id desc
        offset $3
      )`,
    params: [strategyId, status, retainedRuns],
  };
}

export function buildStrategyDefinitionUpsertStatements(rows, batchSize = STRATEGY_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 12;
      params.push(
        row.code,
        row.name,
        row.description ?? null,
        row.benchmark_symbol,
        row.execution_model,
        row.out_of_market_mode,
        row.transaction_cost_bps,
        row.universe_mode,
        row.point_in_time_supported,
        row.rule_source,
        JSON.stringify(row.params_json ?? {}),
        row.is_active
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, now())`;
    });

    return {
      sql: `insert into strategy_definitions (
        code, name, description, benchmark_symbol, execution_model, out_of_market_mode,
        transaction_cost_bps, universe_mode, point_in_time_supported, rule_source, params_json, is_active, updated_at
      ) values ${values.join(', ')}
      on conflict (code) do update set
        name = excluded.name,
        description = excluded.description,
        benchmark_symbol = excluded.benchmark_symbol,
        execution_model = excluded.execution_model,
        out_of_market_mode = excluded.out_of_market_mode,
        transaction_cost_bps = excluded.transaction_cost_bps,
        universe_mode = excluded.universe_mode,
        point_in_time_supported = excluded.point_in_time_supported,
        rule_source = excluded.rule_source,
        params_json = excluded.params_json,
        is_active = excluded.is_active,
        updated_at = now()`,
      params,
    };
  });
}

export function buildStrategyPositionUpsertStatements(rows, batchSize = POSITION_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 10;
      params.push(
        row.run_id,
        row.date,
        row.signal_date,
        row.effective_trade_date,
        row.target_state,
        row.applied_state,
        formatIndicatorValueForStorage(row.target_equity_weight),
        formatIndicatorValueForStorage(row.applied_equity_weight),
        row.trade_action,
        row.reason_code
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`;
    });

    return {
      sql: `insert into strategy_positions_daily (
        run_id, date, signal_date, effective_trade_date, target_state, applied_state,
        target_equity_weight, applied_equity_weight, trade_action, reason_code
      ) values ${values.join(', ')}
      on conflict (run_id, date) do update set
        signal_date = excluded.signal_date,
        effective_trade_date = excluded.effective_trade_date,
        target_state = excluded.target_state,
        applied_state = excluded.applied_state,
        target_equity_weight = excluded.target_equity_weight,
        applied_equity_weight = excluded.applied_equity_weight,
        trade_action = excluded.trade_action,
        reason_code = excluded.reason_code`,
      params,
    };
  });
}

export function buildStrategyEquityUpsertStatements(rows, batchSize = EQUITY_BATCH_SIZE) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 12;
      params.push(
        row.run_id,
        row.date,
        formatIndicatorValueForStorage(row.start_equity),
        formatIndicatorValueForStorage(row.end_equity),
        formatIndicatorValueForStorage(row.strategy_return_pct),
        formatIndicatorValueForStorage(row.benchmark_return_pct),
        formatIndicatorValueForStorage(row.cash_weight),
        formatIndicatorValueForStorage(row.equity_weight),
        formatIndicatorValueForStorage(row.transaction_cost_pct),
        formatIndicatorValueForStorage(row.transaction_cost_amount),
        formatIndicatorValueForStorage(row.drawdown_pct),
        row.is_in_market
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12})`;
    });

    return {
      sql: `insert into strategy_equity_daily (
        run_id, date, start_equity, end_equity, strategy_return_pct, benchmark_return_pct,
        cash_weight, equity_weight, transaction_cost_pct, transaction_cost_amount, drawdown_pct, is_in_market
      ) values ${values.join(', ')}
      on conflict (run_id, date) do update set
        start_equity = excluded.start_equity,
        end_equity = excluded.end_equity,
        strategy_return_pct = excluded.strategy_return_pct,
        benchmark_return_pct = excluded.benchmark_return_pct,
        cash_weight = excluded.cash_weight,
        equity_weight = excluded.equity_weight,
        transaction_cost_pct = excluded.transaction_cost_pct,
        transaction_cost_amount = excluded.transaction_cost_amount,
        drawdown_pct = excluded.drawdown_pct,
        is_in_market = excluded.is_in_market`,
      params,
    };
  });
}

export async function upsertStrategyDefinitions(rows) {
  if (!rows.length) return 0;

  const statements = buildStrategyDefinitionUpsertStatements(rows);
  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getActiveStrategyDefinitions() {
  const result = await query(
    `select *
     from strategy_definitions
     where is_active = true
     order by code asc`
  );

  return result.rows;
}

export async function createBacktestRun(strategy) {
  const result = await query(
    `insert into backtest_runs (
      strategy_id, status, started_at, benchmark_symbol, execution_model, out_of_market_mode,
      transaction_cost_bps, universe_mode, point_in_time_supported, rule_source, params_json
    ) values ($1, 'running', now(), $2, $3, $4, $5, $6, $7, $8, $9)
    returning id`,
    [
      strategy.id,
      strategy.benchmark_symbol,
      strategy.execution_model,
      strategy.out_of_market_mode,
      strategy.transaction_cost_bps,
      strategy.universe_mode,
      strategy.point_in_time_supported,
      strategy.rule_source,
      JSON.stringify(strategy.params_json ?? {}),
    ]
  );

  return result.rows[0].id;
}

export async function finishBacktestRun(runId, summary) {
  await query(
    `update backtest_runs set
      status = $2,
      finished_at = now(),
      code_version = $3,
      signal_data_end_date = $4,
      notes = $5,
      cagr = $6,
      max_drawdown = $7,
      sharpe = $8,
      sortino = $9,
      calmar = $10,
      turnover = $11,
      time_in_market_pct = $12,
      updated_at = now()
     where id = $1`,
    [
      runId,
      summary.status,
      summary.code_version ?? null,
      summary.signal_data_end_date ?? null,
      summary.notes ?? null,
      formatIndicatorValueForStorage(summary.cagr),
      formatIndicatorValueForStorage(summary.max_drawdown),
      formatIndicatorValueForStorage(summary.sharpe),
      formatIndicatorValueForStorage(summary.sortino),
      formatIndicatorValueForStorage(summary.calmar),
      formatIndicatorValueForStorage(summary.turnover),
      formatIndicatorValueForStorage(summary.time_in_market_pct),
    ]
  );
}

export async function failBacktestRun(runId, error) {
  await query(
    `update backtest_runs set
      status = 'failure',
      finished_at = now(),
      notes = $2,
      updated_at = now()
     where id = $1`,
    [runId, error]
  );
}

export async function pruneBacktestRuns({ strategyId, status, retainedRuns }) {
  if (!Number.isInteger(retainedRuns) || retainedRuns < 0) {
    throw new Error(`Invalid retainedRuns value: ${retainedRuns}`);
  }

  const statement = buildBacktestRunRetentionStatement({
    strategyId,
    status,
    retainedRuns,
  });
  const result = await query(statement.sql, statement.params);

  return result.rowCount ?? 0;
}

export async function upsertStrategyPositions(rows) {
  if (!rows.length) return 0;

  const statements = buildStrategyPositionUpsertStatements(rows);
  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function upsertStrategyEquity(rows) {
  if (!rows.length) return 0;

  const statements = buildStrategyEquityUpsertStatements(rows);
  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}
