import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_YAHOO_DAILY_RANGE, getYahooDailyRange } from '../lib/utils/fetch-settings.js';

test('getYahooDailyRange falls back to the default range', () => {
  assert.equal(getYahooDailyRange({}), DEFAULT_YAHOO_DAILY_RANGE);
  assert.equal(getYahooDailyRange({ YAHOO_DAILY_RANGE: '   ' }), DEFAULT_YAHOO_DAILY_RANGE);
});

test('getYahooDailyRange returns the configured range', () => {
  assert.equal(getYahooDailyRange({ YAHOO_DAILY_RANGE: '800d' }), '800d');
});
