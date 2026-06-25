import test from 'node:test';
import assert from 'node:assert/strict';
import { getExecutionConfig, getMarkovPaperAccountConfigs } from '../lib/execution/config.js';

test('getExecutionConfig returns safe buffered-band defaults for paper execution', () => {
  const config = getExecutionConfig({});

  assert.equal(config.alpaca.apiBaseUrl, 'https://paper-api.alpaca.markets/v2');
  assert.equal(config.alpaca.apiKey, '');
  assert.equal(config.alpaca.apiSecret, '');
  assert.equal(config.alpaca.tradingEnabled, false);
  assert.deepEqual(config.allowedSymbols, ['SPY']);
  assert.equal(config.maxOrderNotionalUsd, 100000);
  assert.equal(config.maxPositionNotionalUsd, 100000);
  assert.equal(config.maxSignalAgeDays, 5);
  assert.equal(config.rebalancePolicy, 'buffered_band_rebalance');
  assert.equal(config.targetGrossExposurePct, 95);
  assert.equal(config.cashBufferPct, 5);
  assert.equal(config.rebalanceBandRelative, 0.25);
  assert.equal(config.rebalanceBandAbsolutePct, 1);
  assert.equal(config.minOrderNotionalUsd, 100);
  assert.equal(config.minOrderEquityPct, 0.5);
  assert.equal(config.maxRebalanceTurnoverPct, 30);
});

test('getExecutionConfig normalizes symbols and numeric env overrides', () => {
  const config = getExecutionConfig({
    ALPACA_API_BASE_URL: 'https://paper-api.alpaca.markets/v2',
    ALPACA_API_KEY: 'key',
    ALPACA_API_SECRET: 'secret',
    ALPACA_TRADING_ENABLED: 'true',
    EXECUTION_ALLOWED_SYMBOLS: ' spy, qqq ',
    EXECUTION_MAX_ORDER_NOTIONAL_USD: '25000',
    EXECUTION_MAX_POSITION_NOTIONAL_USD: '50000',
    EXECUTION_MAX_SIGNAL_AGE_DAYS: '2',
    EXECUTION_REBALANCE_POLICY: 'full_rebalance_exact',
    EXECUTION_TARGET_GROSS_EXPOSURE_PCT: '90',
    EXECUTION_CASH_BUFFER_PCT: '10',
    EXECUTION_REBALANCE_BAND_RELATIVE: '0.15',
    EXECUTION_REBALANCE_BAND_ABSOLUTE_PCT: '0.75',
    EXECUTION_MIN_ORDER_NOTIONAL_USD: '250',
    EXECUTION_MIN_ORDER_EQUITY_PCT: '0.25',
    EXECUTION_MAX_REBALANCE_TURNOVER_PCT: '20',
  });

  assert.equal(config.alpaca.tradingEnabled, true);
  assert.deepEqual(config.allowedSymbols, ['SPY', 'QQQ']);
  assert.equal(config.maxOrderNotionalUsd, 25000);
  assert.equal(config.maxPositionNotionalUsd, 50000);
  assert.equal(config.maxSignalAgeDays, 2);
  assert.equal(config.rebalancePolicy, 'full_rebalance_exact');
  assert.equal(config.targetGrossExposurePct, 90);
  assert.equal(config.cashBufferPct, 10);
  assert.equal(config.rebalanceBandRelative, 0.15);
  assert.equal(config.rebalanceBandAbsolutePct, 0.75);
  assert.equal(config.minOrderNotionalUsd, 250);
  assert.equal(config.minOrderEquityPct, 0.25);
  assert.equal(config.maxRebalanceTurnoverPct, 20);
});

test('getExecutionConfig rejects invalid numeric env values', () => {
  assert.throws(
    () => getExecutionConfig({ EXECUTION_MAX_SIGNAL_AGE_DAYS: 'abc' }),
    /Invalid EXECUTION_MAX_SIGNAL_AGE_DAYS/
  );
});

test('getExecutionConfig rejects unsupported rebalance policies', () => {
  assert.throws(
    () => getExecutionConfig({ EXECUTION_REBALANCE_POLICY: 'trim_everything' }),
    /Invalid EXECUTION_REBALANCE_POLICY/
  );
});

test('getMarkovPaperAccountConfigs parses named paper accounts for strategy automation', () => {
  const accounts = getMarkovPaperAccountConfigs({
    MARKOV_PAPER_ACCOUNTS: 'bear10, bull10',
    MARKOV_PAPER_BEAR10_STRATEGY_NAME: 'bottom_10_bear_weekly',
    MARKOV_PAPER_BEAR10_API_KEY: 'key1',
    MARKOV_PAPER_BEAR10_API_SECRET: 'secret1',
    MARKOV_PAPER_BEAR10_TRADING_ENABLED: 'true',
    MARKOV_PAPER_BEAR10_SHORTING_ENABLED: 'true',
    MARKOV_PAPER_BEAR10_REBALANCE_POLICY: 'full_rebalance_exact',
    MARKOV_PAPER_BEAR10_TARGET_GROSS_EXPOSURE_PCT: '80',
    MARKOV_PAPER_BULL10_STRATEGY_NAME: 'top_10_bull_weekly',
    MARKOV_PAPER_BULL10_API_KEY: 'key2',
    MARKOV_PAPER_BULL10_API_SECRET: 'secret2',
    MARKOV_PAPER_BULL10_TRADING_ENABLED: 'false',
    EXECUTION_MAX_SIGNAL_AGE_DAYS: '2',
  });

  assert.equal(accounts.length, 2);
  assert.equal(accounts[0].accountId, 'bear10');
  assert.equal(accounts[0].strategyName, 'bottom_10_bear_weekly');
  assert.equal(accounts[0].broker, 'alpaca_bear10');
  assert.equal(accounts[0].alpaca.tradingEnabled, true);
  assert.equal(accounts[0].shortingEnabled, true);
  assert.deepEqual(accounts[0].allowedSymbols, []);
  assert.equal(accounts[0].rebalancePolicy, 'full_rebalance_exact');
  assert.equal(accounts[0].targetGrossExposurePct, 80);
  assert.equal(accounts[1].strategyName, 'top_10_bull_weekly');
  assert.equal(accounts[1].alpaca.tradingEnabled, false);
  assert.equal(accounts[1].maxSignalAgeDays, 2);
  assert.equal(accounts[1].rebalancePolicy, 'buffered_band_rebalance');
});
