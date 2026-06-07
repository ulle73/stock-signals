import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExecutionRiskRules } from '../lib/execution/risk-rules.js';

function createContext(overrides = {}) {
  return {
    intent: {
      symbol: 'SPY',
      asset_class: 'us_equity',
      target_state: 'long',
      signal_date: '2026-05-19',
      ...overrides.intent,
    },
    proposal: {
      side: 'buy',
      qty: null,
      notional: 100000,
      resultingPositionNotional: 100000,
      ...overrides.proposal,
    },
    brokerState: {
      metadata: {
        apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
      },
      account: {
        status: 'ACTIVE',
        tradingBlocked: false,
        accountBlocked: false,
      },
      openOrders: [],
      ...overrides.brokerState,
    },
    config: {
      alpaca: {
        apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
        tradingEnabled: true,
      },
      allowedSymbols: ['SPY'],
      maxOrderNotionalUsd: 100000,
      maxPositionNotionalUsd: 100000,
      maxSignalAgeDays: 5,
      shortingEnabled: false,
      ...overrides.config,
    },
    mode: 'paper_execute',
    now: new Date('2026-05-20T12:00:00.000Z'),
    ...overrides,
  };
}

test('blocks execution when paper endpoint is not configured', () => {
  const results = evaluateExecutionRiskRules(
    createContext({
      brokerState: {
        metadata: { apiBaseUrl: 'https://api.alpaca.markets/v2' },
      },
      config: {
        alpaca: { apiBaseUrl: 'https://api.alpaca.markets/v2', tradingEnabled: true },
      },
    })
  );

  assert.ok(results.some((result) => result.code === 'paper_account_required' && result.status === 'block'));
});

test('blocks execution when trading is disabled for paper_execute mode', () => {
  const results = evaluateExecutionRiskRules(
    createContext({
      config: {
        alpaca: { apiBaseUrl: 'https://paper-api.alpaca.markets/v2', tradingEnabled: false },
      },
    })
  );

  assert.ok(results.some((result) => result.code === 'trading_disabled' && result.status === 'block'));
});

test('blocks execution for unsupported symbols, short intents, stale signals, open orders and oversize trades', () => {
  const results = evaluateExecutionRiskRules(
    createContext({
      intent: {
        symbol: 'QQQ',
        target_state: 'short',
        signal_date: '2026-05-01',
      },
      proposal: {
        notional: 120000,
        resultingPositionNotional: 130000,
      },
      brokerState: {
        openOrders: [{ id: 'ord_1', symbol: 'QQQ', status: 'accepted' }],
      },
      config: {
        allowedSymbols: ['SPY'],
        maxOrderNotionalUsd: 100000,
        maxPositionNotionalUsd: 100000,
        maxSignalAgeDays: 5,
      },
    })
  );

  const blockingCodes = results.filter((result) => result.status === 'block').map((result) => result.code);

  assert.ok(blockingCodes.includes('symbol_not_allowed'));
  assert.ok(blockingCodes.includes('short_not_enabled'));
  assert.ok(blockingCodes.includes('signal_stale'));
  assert.ok(blockingCodes.includes('open_order_exists'));
  assert.ok(blockingCodes.includes('order_size_exceeded'));
  assert.ok(blockingCodes.includes('position_size_exceeded'));
});

test('passes symbol checks when no allowlist is configured and shorting is enabled', () => {
  const results = evaluateExecutionRiskRules(
    createContext({
      intent: {
        symbol: 'NVDA',
        target_state: 'short',
        action_hint: 'enter_short',
      },
      config: {
        allowedSymbols: [],
        shortingEnabled: true,
      },
    })
  );

  const blockingCodes = results.filter((result) => result.status === 'block').map((result) => result.code);

  assert.equal(blockingCodes.includes('symbol_not_allowed'), false);
  assert.equal(blockingCodes.includes('short_not_enabled'), false);
});
