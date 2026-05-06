import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildYahooFetchRequest,
  filterIncrementalRows,
  hasYahooDailyRangeOverride,
} from '../lib/utils/incremental-fetch.js';

test('hasYahooDailyRangeOverride detects explicit overrides only', () => {
  assert.equal(hasYahooDailyRangeOverride({}), false);
  assert.equal(hasYahooDailyRangeOverride({ YAHOO_DAILY_RANGE: '   ' }), false);
  assert.equal(hasYahooDailyRangeOverride({ YAHOO_DAILY_RANGE: '800d' }), true);
});

test('buildYahooFetchRequest uses fallback range for new tickers', () => {
  assert.deepEqual(
    buildYahooFetchRequest({
      latestDate: null,
      fallbackRange: '400d',
      hasRangeOverride: false,
    }),
    { range: '400d' }
  );
});

test('buildYahooFetchRequest uses fallback range when a one-off override is set', () => {
  assert.deepEqual(
    buildYahooFetchRequest({
      latestDate: '2026-05-05',
      fallbackRange: '800d',
      hasRangeOverride: true,
    }),
    { range: '800d' }
  );
});

test('buildYahooFetchRequest uses period bounds for incremental fetches', () => {
  const request = buildYahooFetchRequest({
    latestDate: '2026-05-05',
    fallbackRange: '400d',
    hasRangeOverride: false,
    now: new Date('2026-05-06T12:00:00.000Z'),
  });

  assert.deepEqual(request, {
    period1: Math.floor(new Date('2026-04-28T00:00:00.000Z').getTime() / 1000),
    period2: Math.floor(new Date('2026-05-07T00:00:00.000Z').getTime() / 1000),
  });
});

test('filterIncrementalRows keeps a small overlap window', () => {
  const rows = [
    { date: '2026-05-01', value: 1 },
    { date: '2026-05-02', value: 2 },
    { date: '2026-05-03', value: 3 },
    { date: '2026-05-04', value: 4 },
    { date: '2026-05-05', value: 5 },
  ];

  assert.deepEqual(filterIncrementalRows(rows, '2026-05-05', 2), [
    { date: '2026-05-03', value: 3 },
    { date: '2026-05-04', value: 4 },
    { date: '2026-05-05', value: 5 },
  ]);
});

test('addDays shifts ISO dates in UTC', () => {
  assert.equal(addDays('2026-05-05', -7), '2026-04-28');
  assert.equal(addDays('2026-05-05', 1), '2026-05-06');
});
