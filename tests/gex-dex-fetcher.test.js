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
