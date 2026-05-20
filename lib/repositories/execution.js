import { query } from '../db.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const DEFAULT_QUERY_CLIENT = { query };

export function buildExecutionIntentInsertStatement(row) {
  return {
    sql: `insert into execution_intents (
      source_type, source_table, source_row_key, strategy_code, symbol, asset_class, intent_status,
      target_state, target_exposure_pct, action_hint, signal_date, signal_timestamp,
      reason_summary, adapter_metadata_json
    ) values (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14
    )
    returning id`,
    params: [
      row.source_type,
      row.source_table,
      row.source_row_key,
      row.strategy_code ?? null,
      row.symbol,
      row.asset_class,
      row.intent_status,
      row.target_state,
      formatIndicatorValueForStorage(row.target_exposure_pct),
      row.action_hint,
      row.signal_date,
      row.signal_timestamp ?? null,
      row.reason_summary ?? null,
      JSON.stringify(row.adapter_metadata_json ?? {}),
    ],
  };
}

export function buildExecutionDecisionInsertStatement(row) {
  return {
    sql: `insert into execution_decisions (
      intent_id, broker, mode, decision_status, current_position_qty, current_position_market_value,
      current_position_side, current_cash, current_equity, proposed_order_side, proposed_order_qty,
      proposed_order_notional, target_position_notional, blocking_codes_json, risk_results_json,
      decision_metadata_json
    ) values (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14, $15,
      $16
    )
    returning id`,
    params: [
      row.intent_id,
      row.broker,
      row.mode,
      row.decision_status,
      formatIndicatorValueForStorage(row.current_position_qty),
      formatIndicatorValueForStorage(row.current_position_market_value),
      row.current_position_side ?? null,
      formatIndicatorValueForStorage(row.current_cash),
      formatIndicatorValueForStorage(row.current_equity),
      row.proposed_order_side ?? null,
      formatIndicatorValueForStorage(row.proposed_order_qty),
      formatIndicatorValueForStorage(row.proposed_order_notional),
      formatIndicatorValueForStorage(row.target_position_notional),
      JSON.stringify(row.blocking_codes_json ?? []),
      JSON.stringify(row.risk_results_json ?? []),
      JSON.stringify(row.decision_metadata_json ?? {}),
    ],
  };
}

export function buildExecutionOrderInsertStatement(row) {
  return {
    sql: `insert into execution_orders (
      decision_id, broker, broker_order_id, symbol, side, order_type, time_in_force, qty, notional,
      client_order_id, request_json, response_json, broker_status
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13
    )
    returning id`,
    params: [
      row.decision_id,
      row.broker,
      row.broker_order_id ?? null,
      row.symbol,
      row.side,
      row.order_type,
      row.time_in_force,
      formatIndicatorValueForStorage(row.qty),
      formatIndicatorValueForStorage(row.notional),
      row.client_order_id ?? null,
      JSON.stringify(row.request_json ?? {}),
      JSON.stringify(row.response_json ?? {}),
      row.broker_status ?? null,
    ],
  };
}

export function buildExecutionOrderUpdateStatement({ broker, broker_order_id, broker_status, response_json }) {
  return {
    sql: `update execution_orders set
      broker_status = $3,
      response_json = $4,
      updated_at = now()
     where broker = $1 and broker_order_id = $2`,
    params: [
      broker,
      broker_order_id,
      broker_status ?? null,
      JSON.stringify(response_json ?? {}),
    ],
  };
}

export async function insertExecutionIntent(row, queryClient = DEFAULT_QUERY_CLIENT) {
  const statement = buildExecutionIntentInsertStatement(row);
  const result = await queryClient.query(statement.sql, statement.params);
  return result.rows[0]?.id ?? null;
}

export async function insertExecutionDecision(row, queryClient = DEFAULT_QUERY_CLIENT) {
  const statement = buildExecutionDecisionInsertStatement(row);
  const result = await queryClient.query(statement.sql, statement.params);
  return result.rows[0]?.id ?? null;
}

export async function insertExecutionOrder(row, queryClient = DEFAULT_QUERY_CLIENT) {
  const statement = buildExecutionOrderInsertStatement(row);
  const result = await queryClient.query(statement.sql, statement.params);
  return result.rows[0]?.id ?? null;
}

export async function updateExecutionOrderByBrokerOrderId(row, queryClient = DEFAULT_QUERY_CLIENT) {
  const statement = buildExecutionOrderUpdateStatement(row);
  const result = await queryClient.query(statement.sql, statement.params);
  return result.rowCount ?? 0;
}
