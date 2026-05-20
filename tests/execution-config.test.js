import test from 'node:test';
import assert from 'node:assert/strict';
import { getExecutionConfig } from '../lib/execution/config.js';

test('getExecutionConfig returns safe defaults for v1 paper execution', () => {
  const config = getExecutionConfig({});

  assert.equal(config.alpaca.apiBaseUrl, 'https://paper-api.alpaca.markets/v2');
  assert.equal(config.alpaca.apiKey, '');
  assert.equal(config.alpaca.apiSecret, '');
  assert.equal(config.alpaca.tradingEnabled, false);
  assert.deepEqual(config.allowedSymbols, ['SPY']);
  assert.equal(config.maxOrderNotionalUsd, 100000);
  assert.equal(config.maxPositionNotionalUsd, 100000);
  assert.equal(config.maxSignalAgeDays, 5);
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
  });

  assert.equal(config.alpaca.tradingEnabled, true);
  assert.deepEqual(config.allowedSymbols, ['SPY', 'QQQ']);
  assert.equal(config.maxOrderNotionalUsd, 25000);
  assert.equal(config.maxPositionNotionalUsd, 50000);
  assert.equal(config.maxSignalAgeDays, 2);
});

test('getExecutionConfig rejects invalid numeric env values', () => {
  assert.throws(
    () => getExecutionConfig({ EXECUTION_MAX_SIGNAL_AGE_DAYS: 'abc' }),
    /Invalid EXECUTION_MAX_SIGNAL_AGE_DAYS/
  );
});
