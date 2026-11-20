/**
 * Isolated intraday price monitor for manual buy-level notifications.
 * Never places orders or modifies the existing stock-signals EOD pipeline.
 * Yahoo is an unofficial source: stale / unavailable data always fails closed.
 */
import { ensureEnvLoaded } from '../lib/env.js';
import { query, closePool } from '../lib/db.js';
import { fetchYahooDailyCandles, fetchYahooIntradayCandles } from '../lib/sources/yahoo.js';

const BASE_DATE = '2026-11-20';
const TICKERS = [
  { symbol: 'GOOGL', yahoo: 'GOOGL' },
  { symbol: 'NVDA', yahoo: 'NVDA' },
  { symbol: 'META', yahoo: 'META' },
  { symbol: 'AMD', yahoo: 'AMD' },
  { symbol: 'NDX', yahoo: '^NDX' }
];
const DATE_FORMAT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit'
});
const TIME_FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York', weekday: 'short', hour: '2-digit',
  minute: '2-digit', hourCycle: 'h23'
});
function marketDate(date) {
  const parts = Object.fromEntries(DATE_FORMAT.formatToParts(date).map(p => [p.type, p.value]));
  return [parts.year, parts.month, parts.day].join('-');
}
function marketTime(date) {
  const parts = Object.fromEntries(TIME_FORMAT.formatToParts(date).map(p => [p.type, p.value]));
  return { weekday: parts.weekday, minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute) };
}
function isScheduledMarketWindow(now = new Date()) {
  const t = marketTime(now);
  return t.weekday !== 'Sat' && t.weekday !== 'Sun'
    && t.minuteOfDay >= 570 && t.minuteOfDay < 960; // 09:30–15:59 ET
}
function isAfterReferenceClose(now = new Date()) {
  const date = marketDate(now);
  return date > BASE_DATE || (date === BASE_DATE && marketTime(now).minuteOfDay >= 975);
}
function round(value) { return Math.round(value * 1000000) / 1000000; }

async function seedNasdaqReference(now) {
  if (!isAfterReferenceClose(now)) return;
  const check = await query('SELECT base_price FROM public.buy_watch_baselines WHERE symbol=$1', ['NDX']);
  if (check.rows.length) return;
  const daily = await fetchYahooDailyCandles('^NDX', { range: '1mo', interval: '1d' });
  const reference = daily.find(row => row.date === BASE_DATE && Number.isFinite(Number(row.close)) && Number(row.close) > 0);
  if (!reference) {
    console.warn('NDX closing-price baseline for 2026-11-20 not available yet. Fund alerts stay disabled.');
    return;
  }
  await query(`INSERT INTO public.buy_watch_baselines
    (symbol, base_price, session_date, source)
    VALUES ('NDX', $1, $2, 'yahoo_daily_close_2026-11-20')
    ON CONFLICT (symbol) DO NOTHING`, [round(Number(reference.close)), BASE_DATE]);
  console.log('NDX baseline stored: close of 2026-11-20.');
}

async function fetchAndStore(ticker, now) {
  const rows = await fetchYahooIntradayCandles(ticker.yahoo, { range: '1d', interval: '5m' });
  const today = marketDate(now);
  const sameSession = rows.filter(row => marketDate(new Date(row.candle_at)) === today
    && Number.isFinite(Number(row.close)) && Number(row.close) > 0);
  if (!sameSession.length) return false;
  const latest = sameSession.at(-1);
  const stamp = new Date(latest.candle_at);
  const age = now.getTime() - stamp.getTime();
  if (age < -120000 || age > 35 * 60000) {
    console.warn(`Skipping stale/future candle for ${ticker.symbol}, ageMs=${age}`);
    return false;
  }
  const recent = sameSession.filter(row => {
    const delta = now.getTime() - new Date(row.candle_at).getTime();
    return delta >= -120000 && delta <= 26 * 60000;
  });
  const prices = recent.map(row => Number(row.low))
    .filter(price => Number.isFinite(price) && price > 0);
  if (!prices.length) return false;
  const low = Math.min(...prices);
  const last = Number(latest.close);
  await query(`INSERT INTO public.buy_watch_quotes
    (symbol, last_price, recent_low, market_timestamp, session_date, fetched_at, source)
    VALUES ($1, $2, $3, $4, $5, now(), 'yahoo_5m_github_actions')
    ON CONFLICT (symbol) DO UPDATE SET
      last_price=EXCLUDED.last_price,
      recent_low=EXCLUDED.recent_low,
      market_timestamp=EXCLUDED.market_timestamp,
      session_date=EXCLUDED.session_date,
      fetched_at=EXCLUDED.fetched_at,
      source=EXCLUDED.source
    WHERE public.buy_watch_quotes.market_timestamp <= EXCLUDED.market_timestamp`,
    [ticker.symbol, round(last), round(low), stamp.toISOString(), today]);
  console.log(`${ticker.symbol}: close=${last}, last-26m low=${low}, candle=${stamp.toISOString()}`);
  return true;
}

async function main() {
  ensureEnvLoaded();
  const now = new Date();
  if (marketDate(now) < BASE_DATE || !isScheduledMarketWindow(now)) {
    console.log('Outside US regular market monitoring window; no calls made.');
    return;
  }
  let good = 0;
  for (const ticker of TICKERS) {
    try {
      if (await fetchAndStore(ticker, now)) good++;
    } catch (error) {
      console.error(`${ticker.symbol}: ${error.message}`);
    }
    // Avoid burst traffic/rate limits on the unofficial Yahoo endpoint.
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  try {
    await seedNasdaqReference(now);
  } catch (error) {
    console.error(`NDX baseline fetch: ${error.message}`);
  }
  if (good !== TICKERS.length) {
    throw new Error(`Only ${good}/${TICKERS.length} Yahoo quotes passed freshness checks; n8n rejects stale instruments.`);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(closePool);
