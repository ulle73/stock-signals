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
  {
    code: 'position_macro_signal_v1',
    name: 'Position Macro Signal V1',
    description: 'Scale SPY exposure between 0-100% from the position macro signal.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 5,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'position_macro_signal',
    params_json: {
      initial_state: 'cash',
      initial_equity_weight: 0,
    },
    is_active: true,
  },
  {
    code: 'trading_signal_v1_long_cash',
    name: 'Trading Signal V1 Long/Cash',
    description: 'Trade SPY long/cash from the explicit trading decision layer, ignoring short entries for now.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 5,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'trading_signal_long_cash',
    params_json: {
      initial_state: 'cash',
    },
    is_active: true,
  },
  // === Markov strategies (added for unified daily backtesting) ===
  {
    code: 'ticker_markov_top_10_bull_weekly',
    name: 'Ticker Markov Top 10 Bull Weekly',
    description: 'Long-only basket of top 10 bullish Markov-ranked tickers, weekly rebalance.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 10,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'ticker_markov_top_10_bull_weekly',
    params_json: {
      initial_state: 'cash',
      top_n: 10,
      frequency: 'weekly'
    },
    is_active: true,
  },
  {
    code: 'ticker_markov_top_20_bull_weekly',
    name: 'Ticker Markov Top 20 Bull Weekly',
    description: 'Long-only basket of top 20 bullish Markov-ranked tickers, weekly rebalance.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 10,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'ticker_markov_top_20_bull_weekly',
    params_json: {
      initial_state: 'cash',
      top_n: 20,
      frequency: 'weekly'
    },
    is_active: true,
  },
  {
    code: 'ticker_markov_bottom_10_bear_weekly',
    name: 'Ticker Markov Bottom 10 Bear Weekly',
    description: 'Long-only basket of bottom 10 bearish Markov-ranked tickers (mean-reversion), weekly rebalance.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 10,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'ticker_markov_bottom_10_bear_weekly',
    params_json: {
      initial_state: 'cash',
      bottom_n: 10,
      frequency: 'weekly'
    },
    is_active: true,
  },
  {
    code: 'ticker_markov_top_10_bull_weekly_market_on',
    name: 'Ticker Markov Top 10 Bull Weekly Market On',
    description: 'Top 10 Bull Weekly only when market regime is favorable (Market On filter).',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 10,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'ticker_markov_top_10_bull_weekly_market_on',
    params_json: {
      initial_state: 'cash',
      top_n: 10,
      frequency: 'weekly',
      market_on_filter: true
    },
    is_active: true,
  },
  {
    code: 'ticker_markov_top_10_bull_weekly_no_risk_off',
    name: 'Ticker Markov Top 10 Bull Weekly No Risk Off',
    description: 'Top 10 Bull Weekly without hard risk-off exits.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 10,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'ticker_markov_top_10_bull_weekly_no_risk_off',
    params_json: {
      initial_state: 'cash',
      top_n: 10,
      frequency: 'weekly',
      risk_off_disabled: true
    },
    is_active: true,
  },
  {
    code: 'ticker_markov_top_10_bull_daily',
    name: 'Ticker Markov Top 10 Bull Daily',
    description: 'Long-only basket of top 10 bullish Markov-ranked tickers, daily rebalance.',
    benchmark_symbol: 'SPY',
    execution_model: 'next_open',
    out_of_market_mode: 'cash',
    transaction_cost_bps: 10,
    universe_mode: 'current_constituents',
    point_in_time_supported: false,
    rule_source: 'ticker_markov_top_10_bull_daily',
    params_json: {
      initial_state: 'cash',
      top_n: 10,
      frequency: 'daily'
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
