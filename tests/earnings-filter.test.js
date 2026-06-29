import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEarningsCalendarByTicker,
  evaluateEarningsRisk,
} from '../lib/utils/earnings-filter.js';

test('evaluateEarningsRisk returns not_available when no snapshot exists yet for the ticker', () => {
  const result = evaluateEarningsRisk({
    date: '2026-06-26',
    ticker: 'AAPL',
    earningsCalendarByTicker: buildEarningsCalendarByTicker([]),
  });

  assert.deepEqual(result, {
    status: 'not_available',
    blocks: false,
    reason: 'earnings_not_available',
    earningsDate: null,
    daysToEarnings: null,
    confirmed: null,
    sourceStatus: null,
    snapshotDate: null,
    isNearEarnings: false,
    safeToOpenNewPosition: true,
  });
});

test('evaluateEarningsRisk blocks pre-earnings and post-earnings windows using trading-day distance', () => {
  const earningsCalendarByTicker = buildEarningsCalendarByTicker([
    {
      date: '2026-07-28',
      ticker: 'AAPL',
      earnings_date: '2026-07-30',
      confirmed: false,
      source_status: 'active',
    },
  ]);

  const preWindow = evaluateEarningsRisk({
    date: '2026-07-28',
    ticker: 'AAPL',
    earningsCalendarByTicker,
  });

  const postWindow = evaluateEarningsRisk({
    date: '2026-07-31',
    ticker: 'AAPL',
    earningsCalendarByTicker,
  });

  assert.equal(preWindow.status, 'blocked');
  assert.equal(preWindow.blocks, true);
  assert.equal(preWindow.reason, 'earnings_pre_window_2d');
  assert.equal(preWindow.daysToEarnings, 2);
  assert.equal(preWindow.safeToOpenNewPosition, false);

  assert.equal(postWindow.status, 'blocked');
  assert.equal(postWindow.blocks, true);
  assert.equal(postWindow.reason, 'earnings_post_window_1d');
  assert.equal(postWindow.daysToEarnings, -1);
  assert.equal(postWindow.safeToOpenNewPosition, false);
});

test('evaluateEarningsRisk blocks unknown rows once earnings snapshots exist but the source failed', () => {
  const earningsCalendarByTicker = buildEarningsCalendarByTicker([
    {
      date: '2026-06-26',
      ticker: 'MSFT',
      earnings_date: null,
      confirmed: null,
      source_status: 'error',
    },
  ]);

  const result = evaluateEarningsRisk({
    date: '2026-06-26',
    ticker: 'MSFT',
    earningsCalendarByTicker,
  });

  assert.deepEqual(result, {
    status: 'unknown',
    blocks: true,
    reason: 'earnings_source_error',
    earningsDate: null,
    daysToEarnings: null,
    confirmed: null,
    sourceStatus: 'error',
    snapshotDate: '2026-06-26',
    isNearEarnings: false,
    safeToOpenNewPosition: false,
  });
});
