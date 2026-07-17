import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAndStoreGexDexSnapshots } from '../lib/utils/gex-dex-fetcher.js';

test('fetchAndStoreGexDexSnapshots preserves successful symbols when one source request fails', async () => {
  const stored = [];
  const result = await fetchAndStoreGexDexSnapshots({
    tickers: ['SPY', 'QQQ'],
    fetchSnapshot: async (ticker) => {
      if (ticker === 'QQQ') throw new Error('source unavailable');
      return { snapshot: { ticker }, strikes: [{ strike: 100 }] };
    },
    storeSnapshot: async (snapshot, strikes) => {
      stored.push({ snapshot, strikes });
      return 42;
    },
  });

  assert.equal(result.successfulItems, 1);
  assert.deepEqual(result.failedItems, [{ ticker: 'QQQ', error: 'source unavailable' }]);
  assert.deepEqual(stored, [{ snapshot: { ticker: 'SPY' }, strikes: [{ strike: 100 }] }]);
});

test('fetchAndStoreGexDexSnapshots respects bounded concurrency and preserves result order', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const tickers = ['A', 'B', 'C', 'D', 'E', 'F'];

  const result = await fetchAndStoreGexDexSnapshots({
    tickers,
    concurrency: 3,
    fetchSnapshot: async (ticker) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 10));
      inFlight -= 1;
      return { snapshot: { ticker }, strikes: [] };
    },
    storeSnapshot: async (snapshot) => snapshot.ticker,
  });

  assert.equal(maxInFlight, 3);
  assert.deepEqual(result.snapshotIds, tickers.map((ticker) => ({ ticker, snapshotId: ticker })));
});
