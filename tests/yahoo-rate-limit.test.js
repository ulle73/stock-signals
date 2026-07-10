import assert from 'node:assert/strict';
import test from 'node:test';
import {
  YahooRateLimitError,
  fetchYahooDailyCandles,
} from '../lib/sources/yahoo.js';
import {
  createYahooFetchCircuit,
  runWithYahooFetchCircuit,
} from '../lib/utils/yahoo-fetch-circuit.js';

test('daily Yahoo fetch exposes 429 as a typed retryable error', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', {
    status: 429,
    statusText: 'Too Many Requests',
    headers: { 'retry-after': '60' },
  });

  try {
    await assert.rejects(
      () => fetchYahooDailyCandles('SPY'),
      (error) => error instanceof YahooRateLimitError
        && error.code === 'YAHOO_RATE_LIMIT'
        && error.status === 429
        && error.ticker === 'SPY'
        && error.retryAfter === '60'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Yahoo fetch circuit stops assigning new items after a rate limit', async () => {
  const seen = [];
  const circuit = createYahooFetchCircuit();
  const rateLimitError = new YahooRateLimitError('A', '30');

  const result = await runWithYahooFetchCircuit(['A', 'B', 'C'], {
    concurrency: 1,
    circuit,
    worker: async (symbol) => {
      seen.push(symbol);
      if (symbol === 'A') throw rateLimitError;
      return symbol;
    },
  });

  assert.deepEqual(seen, ['A']);
  assert.equal(circuit.isOpen(), true);
  assert.equal(result.suppressedCount, 2);
  assert.equal(result.results[0].status, 'rejected');
});
