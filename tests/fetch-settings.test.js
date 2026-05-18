import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_YAHOO_DAILY_RANGE,
  DEFAULT_YAHOO_INTRADAY_60M_RANGE,
  DEFAULT_YAHOO_PROXY_DAILY_INITIAL_RANGE,
  DEFAULT_YAHOO_PROXY_DAILY_RANGE,
  getYahooDailyRange,
  getYahooIntraday60mRange,
  getYahooProxyDailyInitialRange,
  getYahooProxyDailyRange,
} from '../lib/utils/fetch-settings.js';

test('getYahooDailyRange falls back to the default range', () => {
  assert.equal(getYahooDailyRange({}), DEFAULT_YAHOO_DAILY_RANGE);
  assert.equal(getYahooDailyRange({ YAHOO_DAILY_RANGE: '   ' }), DEFAULT_YAHOO_DAILY_RANGE);
});

test('getYahooDailyRange returns the configured range', () => {
  assert.equal(getYahooDailyRange({ YAHOO_DAILY_RANGE: '800d' }), '800d');
});

test('getYahooIntraday60mRange falls back to the default range', () => {
  assert.equal(getYahooIntraday60mRange({}), DEFAULT_YAHOO_INTRADAY_60M_RANGE);
  assert.equal(getYahooIntraday60mRange({ YAHOO_INTRADAY_60M_RANGE: '   ' }), DEFAULT_YAHOO_INTRADAY_60M_RANGE);
});

test('getYahooIntraday60mRange returns the configured range', () => {
  assert.equal(getYahooIntraday60mRange({ YAHOO_INTRADAY_60M_RANGE: '1mo' }), '1mo');
});

test('getYahooProxyDailyRange falls back to the default incremental range', () => {
  assert.equal(getYahooProxyDailyRange({}), DEFAULT_YAHOO_PROXY_DAILY_RANGE);
  assert.equal(getYahooProxyDailyRange({ YAHOO_PROXY_DAILY_RANGE: '   ' }), DEFAULT_YAHOO_PROXY_DAILY_RANGE);
});

test('getYahooProxyDailyRange returns the configured incremental range', () => {
  assert.equal(getYahooProxyDailyRange({ YAHOO_PROXY_DAILY_RANGE: '90d' }), '90d');
});

test('getYahooProxyDailyInitialRange falls back to the default backfill range', () => {
  assert.equal(getYahooProxyDailyInitialRange({}), DEFAULT_YAHOO_PROXY_DAILY_INITIAL_RANGE);
  assert.equal(getYahooProxyDailyInitialRange({ YAHOO_PROXY_DAILY_INITIAL_RANGE: '   ' }), DEFAULT_YAHOO_PROXY_DAILY_INITIAL_RANGE);
});

test('getYahooProxyDailyInitialRange returns the configured backfill range', () => {
  assert.equal(getYahooProxyDailyInitialRange({ YAHOO_PROXY_DAILY_INITIAL_RANGE: '15y' }), '15y');
});
