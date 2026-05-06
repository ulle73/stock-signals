const DEFAULT_YAHOO_DAILY_RANGE = '400d';

export function getYahooDailyRange(env = process.env) {
  const value = env.YAHOO_DAILY_RANGE?.trim();
  return value || DEFAULT_YAHOO_DAILY_RANGE;
}

export { DEFAULT_YAHOO_DAILY_RANGE };
