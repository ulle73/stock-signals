import test from 'node:test';
import assert from 'node:assert/strict';
import { getLatestTickerMarkovStrategyExecutionIntents } from '../lib/execution/source-adapters/ticker-markov-strategy-adapter.js';

function createBrokerClient(nextTradingDate) {
  return {
    async getCalendar() {
      return [
        { date: '2026-06-09' },
        { date: nextTradingDate },
      ];
    },
  };
}

test('syncs into the carryover weekly basket when the account is empty mid-week', async () => {
  const intents = await getLatestTickerMarkovStrategyExecutionIntents({
    strategyName: 'top_10_bull_weekly',
    brokerState: { positions: [] },
    brokerClient: createBrokerClient('2026-06-10'),
    now: new Date('2026-06-09T22:00:00.000Z'),
    repository: {
      async getLatestTickerMarkovExecutionInputs() {
        return {
          signalDate: '2026-06-09',
          markovRows: [{ ticker: 'AAA', date: '2026-06-09', markov_total: '0.9', sample_size: 60, signal: 'bull' }],
          tradingSignalRow: { date: '2026-06-09', setup: 'bullish', historical_edge_direction: 'bullish' },
          priceRows: [
            { ticker: 'AAA', adj_close: '100', close: '100' },
            { ticker: 'BBB', adj_close: '50', close: '50' },
          ],
          strategyDailyRow: {
            strategy_name: 'top_10_bull_weekly',
            date: '2026-06-09',
            tickers: ['AAA', 'BBB'],
          },
        };
      },
    },
  });

  assert.equal(intents.length, 2);
  assert.deepEqual(intents.map((intent) => intent.symbol), ['AAA', 'BBB']);
  assert.ok(intents.every((intent) => intent.target_state === 'long'));
  assert.ok(intents.every((intent) => intent.adapter_metadata_json.rebalance_mode === 'sync_carryover'));
});

test('rebalances into the next weekly bull basket and exits removed holdings', async () => {
  const intents = await getLatestTickerMarkovStrategyExecutionIntents({
    strategyName: 'top_10_bull_weekly',
    brokerState: {
      positions: [{ symbol: 'OLD', qty: 100, marketValue: 5000, side: 'long' }],
    },
    brokerClient: {
      async getCalendar() {
        return [
          { date: '2026-06-12' },
          { date: '2026-06-15' },
        ];
      },
    },
    now: new Date('2026-06-12T22:00:00.000Z'),
    repository: {
      async getLatestTickerMarkovExecutionInputs() {
        return {
          signalDate: '2026-06-12',
          markovRows: [
            { ticker: 'AAA', date: '2026-06-12', markov_total: '0.9', sample_size: 60, signal: 'bull' },
            { ticker: 'BBB', date: '2026-06-12', markov_total: '0.8', sample_size: 60, signal: 'bull' },
            { ticker: 'CCC', date: '2026-06-12', markov_total: '-0.8', sample_size: 60, signal: 'sell' },
          ],
          tradingSignalRow: { date: '2026-06-12', setup: 'bullish', historical_edge_direction: 'bullish' },
          priceRows: [
            { ticker: 'AAA', adj_close: '100', close: '100' },
            { ticker: 'BBB', adj_close: '50', close: '50' },
            { ticker: 'OLD', adj_close: '25', close: '25' },
          ],
          strategyDailyRow: {
            strategy_name: 'top_10_bull_weekly',
            date: '2026-06-12',
            tickers: ['OLD'],
          },
        };
      },
    },
  });

  assert.equal(intents.length, 3);
  assert.deepEqual(intents.filter((intent) => intent.target_state === 'long').map((intent) => intent.symbol), ['AAA', 'BBB']);
  assert.deepEqual(intents.filter((intent) => intent.target_state === 'cash').map((intent) => intent.symbol), ['OLD']);
  assert.ok(intents.every((intent) => intent.adapter_metadata_json.rebalance_mode === 'rebalance'));
});
