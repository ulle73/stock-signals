import test from 'node:test';
import assert from 'node:assert/strict';
import { createDailyRequestCache } from '../lib/chart/daily-request-cache.js';

test('daily request cache reuses a chart payload until its daily cache window expires', () => {
  let now = 1_000;
  const cache = createDailyRequestCache({
    ttlMs: 60_000,
    now: () => now,
  });
  const payload = { ticker: 'SPY', bars: [{ time: '2026-08-01', close: 630 }] };

  cache.set('chart:SPY:1Y', payload);
  now = 60_999;

  assert.equal(cache.get('chart:SPY:1Y'), payload);
});

test('daily request cache evicts a chart payload when its cache window has expired', () => {
  let now = 1_000;
  const cache = createDailyRequestCache({
    ttlMs: 60_000,
    now: () => now,
  });

  cache.set('chart:SPY:1Y', { ticker: 'SPY' });
  now = 61_000;

  assert.equal(cache.get('chart:SPY:1Y'), null);
});
