import { query } from '../db.js';

export async function loadMarketRadarInputs() {
  const priceSql = "with priced as (select ticker, date::text as date, close::text as close, row_number() over (partition by ticker order by date desc) as rn from benchmark_daily_prices where ticker in ('SPY','QQQ')) select ticker,date,close from priced where rn<=420 order by ticker,date";
  const breadthSql = 'select date::text as date, pct_above_sma20::text, pct_above_sma50::text, pct_above_sma200::text, valid_sma200_count, is_valid_signal_date from market_breadth_daily order by date desc limit 45';
  const seriesSql = "with ranked as (select series_id,date::text as date,value::text as value,row_number() over (partition by series_id order by date desc) as rn from market_series_daily where series_id in ('BAMLH0A0HYM2','UNRATE','UMCSENT','CPIAUCSL') and value is not null) select series_id,date,value from ranked where rn<=100 order by series_id,date";
  const [priceResult, breadthResult, seriesResult] = await Promise.all([
    query(priceSql), query(breadthSql), query(seriesSql)
  ]);
  const prices = { SPY: [], QQQ: [] }, series = {};
  for (const item of priceResult.rows) prices[item.ticker].push(item);
  for (const item of seriesResult.rows) (series[item.series_id] ??= []).push(item);
  return { prices, breadth: breadthResult.rows, series };
}

export async function loadRadarPreviousSnapshots(date) {
  const result = await query('select payload from market_radar_daily where date < $1::date order by date desc limit 2', [date]);
  return result.rows.map((x) => x.payload).reverse();
}

export async function saveRadarSnapshot(snapshot) {
  await query(
    'insert into market_radar_daily (date,payload) values ($1::date,$2::jsonb) on conflict (date) do update set payload=excluded.payload,updated_at=now()',
    [snapshot.date, JSON.stringify(snapshot)]
  );
}

export async function loadRadarDelivery() {
  const result = await query('select discord_message_id from market_radar_delivery where id=$1', ['main']);
  return result.rows[0]?.discord_message_id ?? null;
}

export async function saveRadarDelivery(messageId) {
  await query(
    "insert into market_radar_delivery (id,discord_message_id) values ('main',$1) on conflict (id) do update set discord_message_id=excluded.discord_message_id,updated_at=now()",
    [messageId]
  );
}

export async function queueRadarAlerts(events) {
  for (const event of events) {
    await query(
      'insert into market_radar_alerts (id,event_date,event_type,payload) values ($1,$2::date,$3,$4::jsonb) on conflict (id) do nothing',
      [event.id, event.date, event.type, JSON.stringify(event)]
    );
  }
}

export async function getPendingRadarAlerts(date) {
  const result = await query(
    'select id,payload from market_radar_alerts where sent_at is null and event_date=$1::date order by id limit 6',
    [date]
  );
  return result.rows;
}

export async function markRadarAlertSent(id) {
  await query('update market_radar_alerts set sent_at=now() where id=$1 and sent_at is null', [id]);
}
