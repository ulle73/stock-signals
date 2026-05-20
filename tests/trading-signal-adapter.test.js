import test from 'node:test';
import assert from 'node:assert/strict';
import { mapTradingSignalRowToExecutionIntent } from '../lib/execution/source-adapters/trading-signal-adapter.js';

function baseRow(decision, overrides = {}) {
  return {
    date: '2026-05-19',
    setup: 'bullish',
    decision,
    previous_state: 'cash',
    target_state: 'long',
    trigger_count: 7,
    market_regime_score: '4.5',
    reason_summary: 'source_reason',
    ...overrides,
  };
}

test('maps KÖP SPY to a normalized long execution intent', () => {
  const intent = mapTradingSignalRowToExecutionIntent(baseRow('KÖP SPY'));

  assert.equal(intent.source_type, 'trading_signal_daily');
  assert.equal(intent.source_table, 'trading_signal_daily');
  assert.equal(intent.source_row_key, '2026-05-19');
  assert.equal(intent.strategy_code, 'trading_signal_v1_long_cash');
  assert.equal(intent.symbol, 'SPY');
  assert.equal(intent.asset_class, 'us_equity');
  assert.equal(intent.intent_status, 'active');
  assert.equal(intent.target_state, 'long');
  assert.equal(intent.target_exposure_pct, 100);
  assert.equal(intent.action_hint, 'go_long');
});

test('maps GÅ TILL CASH to a normalized cash execution intent', () => {
  const intent = mapTradingSignalRowToExecutionIntent(baseRow('GÅ TILL CASH', { target_state: 'cash' }));

  assert.equal(intent.intent_status, 'active');
  assert.equal(intent.target_state, 'cash');
  assert.equal(intent.target_exposure_pct, 0);
  assert.equal(intent.action_hint, 'go_cash');
});

test('maps BEHÅLL and SITT STILL to no-op intents', () => {
  const holdIntent = mapTradingSignalRowToExecutionIntent(baseRow('BEHÅLL'));
  const sitStillIntent = mapTradingSignalRowToExecutionIntent(baseRow('SITT STILL', { target_state: 'cash' }));

  assert.equal(holdIntent.intent_status, 'no_op');
  assert.equal(holdIntent.action_hint, 'no_op');
  assert.equal(sitStillIntent.intent_status, 'no_op');
  assert.equal(sitStillIntent.action_hint, 'no_op');
});

test('maps GÅ KORT SPY to a blocked intent that stays audit-safe', () => {
  const intent = mapTradingSignalRowToExecutionIntent(baseRow('GÅ KORT SPY', { target_state: 'short' }));

  assert.equal(intent.intent_status, 'blocked');
  assert.equal(intent.target_state, 'short');
  assert.equal(intent.target_exposure_pct, -100);
  assert.equal(intent.action_hint, 'enter_short');
  assert.equal(intent.adapter_metadata_json.blocked_reason_code, 'short_signal_not_supported');
});

test('maps STÄNG KORT to a blocked intent for unsupported short workflows', () => {
  const intent = mapTradingSignalRowToExecutionIntent(baseRow('STÄNG KORT', { previous_state: 'short', target_state: 'cash' }));

  assert.equal(intent.intent_status, 'blocked');
  assert.equal(intent.target_state, 'cash');
  assert.equal(intent.target_exposure_pct, 0);
  assert.equal(intent.action_hint, 'exit_short');
  assert.equal(intent.adapter_metadata_json.blocked_reason_code, 'short_signal_not_supported');
});
