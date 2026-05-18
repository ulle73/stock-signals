const DEFAULT_YAHOO_DAILY_RANGE = '400d';
const DEFAULT_YAHOO_INTRADAY_60M_RANGE = '2mo';
const DEFAULT_YAHOO_PROXY_DAILY_RANGE = '400d';
const DEFAULT_YAHOO_PROXY_DAILY_INITIAL_RANGE = '10y';

export function getYahooDailyRange(env = process.env) {
  const value = env.YAHOO_DAILY_RANGE?.trim();
  return value || DEFAULT_YAHOO_DAILY_RANGE;
}

export function getYahooIntraday60mRange(env = process.env) {
  const value = env.YAHOO_INTRADAY_60M_RANGE?.trim();
  return value || DEFAULT_YAHOO_INTRADAY_60M_RANGE;
}

export function getYahooProxyDailyRange(env = process.env) {
  const value = env.YAHOO_PROXY_DAILY_RANGE?.trim();
  return value || DEFAULT_YAHOO_PROXY_DAILY_RANGE;
}

export function getYahooProxyDailyInitialRange(env = process.env) {
  const value = env.YAHOO_PROXY_DAILY_INITIAL_RANGE?.trim();
  return value || DEFAULT_YAHOO_PROXY_DAILY_INITIAL_RANGE;
}

export {
  DEFAULT_YAHOO_DAILY_RANGE,
  DEFAULT_YAHOO_INTRADAY_60M_RANGE,
  DEFAULT_YAHOO_PROXY_DAILY_RANGE,
  DEFAULT_YAHOO_PROXY_DAILY_INITIAL_RANGE,
};
