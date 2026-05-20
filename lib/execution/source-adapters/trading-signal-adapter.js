const DEFAULT_STRATEGY_CODE = 'trading_signal_v1_long_cash';

function buildBaseIntent(row, strategyCode) {
  return {
    source_type: 'trading_signal_daily',
    source_table: 'trading_signal_daily',
    source_row_key: row.date,
    strategy_code: strategyCode,
    symbol: 'SPY',
    asset_class: 'us_equity',
    signal_date: row.date,
    signal_timestamp: `${row.date}T00:00:00.000Z`,
    reason_summary: row.reason_summary ?? null,
    adapter_metadata_json: {
      decision: row.decision,
      setup: row.setup,
      previous_state: row.previous_state,
      source_target_state: row.target_state,
      trigger_count: row.trigger_count,
      market_regime_score: row.market_regime_score,
    },
  };
}

export function mapTradingSignalRowToExecutionIntent(row, options = {}) {
  const strategyCode = options.strategyCode ?? DEFAULT_STRATEGY_CODE;
  const baseIntent = buildBaseIntent(row, strategyCode);

  switch (row.decision) {
    case 'KÖP SPY':
      return {
        ...baseIntent,
        intent_status: 'active',
        target_state: 'long',
        target_exposure_pct: 100,
        action_hint: 'go_long',
      };
    case 'SÄLJ SPY':
    case 'GÅ TILL CASH':
      return {
        ...baseIntent,
        intent_status: 'active',
        target_state: 'cash',
        target_exposure_pct: 0,
        action_hint: 'go_cash',
      };
    case 'BEHÅLL':
    case 'SITT STILL':
      return {
        ...baseIntent,
        intent_status: 'no_op',
        target_state: row.target_state ?? 'cash',
        target_exposure_pct: row.target_state === 'long' ? 100 : 0,
        action_hint: 'no_op',
      };
    case 'GÅ KORT SPY':
      return {
        ...baseIntent,
        intent_status: 'blocked',
        target_state: 'short',
        target_exposure_pct: -100,
        action_hint: 'enter_short',
        adapter_metadata_json: {
          ...baseIntent.adapter_metadata_json,
          blocked_reason_code: 'short_signal_not_supported',
        },
      };
    case 'STÄNG KORT':
      return {
        ...baseIntent,
        intent_status: 'blocked',
        target_state: 'cash',
        target_exposure_pct: 0,
        action_hint: 'exit_short',
        adapter_metadata_json: {
          ...baseIntent.adapter_metadata_json,
          blocked_reason_code: 'short_signal_not_supported',
        },
      };
    default:
      throw new Error(`Unsupported trading signal decision: ${row.decision}`);
  }
}

export async function getLatestTradingSignalExecutionIntents({ getLatestTradingSignalRow, strategyCode = DEFAULT_STRATEGY_CODE }) {
  const row = await getLatestTradingSignalRow();
  return row ? [mapTradingSignalRowToExecutionIntent(row, { strategyCode })] : [];
}
