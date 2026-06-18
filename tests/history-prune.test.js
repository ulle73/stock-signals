import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHistoryPruneStatement,
  getHistoryPrunePlan,
  getHistoryPruneSettings,
  isHistoryPruneEnabled,
} from '../lib/utils/history-prune.js';

test('isHistoryPruneEnabled defaults to false and accepts boolean-like env values', () => {
  assert.equal(isHistoryPruneEnabled({}), false);
  assert.equal(isHistoryPruneEnabled({ HISTORY_PRUNE_ENABLED: 'true' }), true);
  assert.equal(isHistoryPruneEnabled({ HISTORY_PRUNE_ENABLED: '1' }), true);
  assert.equal(isHistoryPruneEnabled({ HISTORY_PRUNE_ENABLED: 'false' }), false);
});

test('getHistoryPruneSettings uses free-tier friendly defaults', () => {
  assert.deepEqual(getHistoryPruneSettings({}), {
    dailyDays: 400,
    intraday60mDays: 60,
    macroProxyDays: 400,
    ivProxyDays: 400,
  });
});

test('getHistoryPrunePlan applies category-specific retention windows', () => {
  const plan = getHistoryPrunePlan({
    HISTORY_PRUNE_DAILY_DAYS: '450',
    HISTORY_PRUNE_INTRADAY_60M_DAYS: '30',
    HISTORY_PRUNE_MACRO_PROXY_DAYS: '365',
    HISTORY_PRUNE_IV_PROXY_DAYS: '180',
  });

  const stockDailyPrices = plan.find((item) => item.table === 'stock_daily_prices');
  const stockIntradayPrices = plan.find((item) => item.table === 'stock_intraday_prices_60m');
  const macroProxy = plan.find((item) => item.table === 'macro_matrix_yahoo_proxy_daily');
  const ivProxy = plan.find((item) => item.table === 'implied_volatility_proxy_source_daily');

  assert.equal(stockDailyPrices?.days, 450);
  assert.equal(stockIntradayPrices?.days, 30);
  assert.equal(macroProxy?.days, 365);
  assert.equal(ivProxy?.days, 180);
});

test('buildHistoryPruneStatement deletes rows older than the configured retention window', () => {
  assert.deepEqual(
    buildHistoryPruneStatement({
      table: 'stock_daily_prices',
      column: 'date',
      days: 400,
    }),
    {
      sql: 'delete from stock_daily_prices where date < current_date - $1::integer',
      params: [400],
    }
  );
});
