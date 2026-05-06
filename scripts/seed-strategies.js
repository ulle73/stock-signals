import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { upsertStrategyDefinitions } from '../lib/repositories/backtests.js';

ensureEnvLoaded();

const STRATEGY_DEFINITIONS = [
  {
    code: 'buy_and_hold_spy',
    name: 'Buy and Hold SPY',
    description: 'Always long SPY from the first tradable session.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 5,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'always_long',
    params_json: {
      initial_state: 'long',
    },
    is_active: true,
  },
  {
    code: 'market_regime_signal_v1',
    name: 'Market Regime Signal V1',
    description: 'Hold SPY only while the combined market regime signal is risk_on.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 5,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'market_regime_signal',
    params_json: {
      initial_state: 'cash',
    },
    is_active: true,
  },
  {
    code: 'bearish_divergence_cash_v1',
    name: 'Bearish Divergence Cash V1',
    description: 'Go to cash when the long divergence status turns bearish.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 5,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'bearish_divergence_risk_off',
    params_json: {
      initial_state: 'long',
    },
    is_active: true,
  },
  {
    code: 'bullish_divergence_context_v1',
    name: 'Bullish Divergence Context V1',
    description: 'Only hold SPY while the long divergence status is bullish.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 5,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'bullish_divergence_only',
    params_json: {
      initial_state: 'cash',
    },
    is_active: true,
  },
  {
    code: 'pct_above_50_threshold_v1',
    name: 'Pct Above 50 Threshold V1',
    description: 'Stay long while pct_above_50 is at or above 50%.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 5,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'pct_above_50_threshold',
    params_json: {
      initial_state: 'long',
      threshold: 50,
    },
    is_active: true,
  },
];

async function run() {
  const inserted = await upsertStrategyDefinitions(STRATEGY_DEFINITIONS);
  console.log(`Seeded ${inserted} strategy definitions.`);
}

run()
  .catch((error) => {
    console.error('seed:strategies failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
