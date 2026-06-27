import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getExpectedLatestUsEquityMarketDate,
  getPreviousUsEquityMarketDate,
  getUsEquityMarketHolidays,
  isUsEquityMarketDate,
  isUsEquityMarketHoliday,
} from '../lib/utils/us-market-calendar.js';

test('US equity market holiday set includes fixed and movable 2026 holidays', () => {
  const holidays = getUsEquityMarketHolidays(2026);

  assert.equal(holidays.has('2026-01-01'), true);
  assert.equal(holidays.has('2026-04-03'), true);
  assert.equal(holidays.has('2026-06-19'), true);
  assert.equal(holidays.has('2026-11-26'), true);
});

test('US equity market holiday detection covers observed spillover dates', () => {
  assert.equal(isUsEquityMarketHoliday('2027-12-31'), true);
  assert.equal(isUsEquityMarketHoliday('2026-06-15'), false);
});

test('US equity market date detection excludes weekends and holidays', () => {
  assert.equal(isUsEquityMarketDate('2026-06-15'), true);
  assert.equal(isUsEquityMarketDate('2026-06-20'), false);
  assert.equal(isUsEquityMarketDate('2026-06-19'), false);
});

test('US equity market previous date walks back across weekends and holidays', () => {
  assert.equal(getPreviousUsEquityMarketDate('2026-06-22'), '2026-06-18');
  assert.equal(getPreviousUsEquityMarketDate('2026-09-08'), '2026-09-04');
});

test('expected latest market date uses New York close cutoff on open days', () => {
  assert.equal(
    getExpectedLatestUsEquityMarketDate({
      now: new Date('2026-06-16T12:30:00.000Z'),
    }),
    '2026-06-15'
  );

  assert.equal(
    getExpectedLatestUsEquityMarketDate({
      now: new Date('2026-06-16T22:00:00.000Z'),
    }),
    '2026-06-16'
  );
});

test('expected latest market date falls back across holidays', () => {
  assert.equal(
    getExpectedLatestUsEquityMarketDate({
      now: new Date('2026-09-07T23:00:00.000Z'),
    }),
    '2026-09-04'
  );
});
