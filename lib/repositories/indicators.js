import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const INDICATOR_BATCH_SIZE = 100;
const INDICATOR_VALUE_FIELDS = [
  'indicator_price',
  'daily_return_pct',
  'avg_volume20',
  'relative_volume20',
  'volume_z20',
  'trend_20d_pct',
  'range_pct',
  'body_pct',
  'pct_from_52w_high',
  'pct_from_52w_low',
  'sma5',
  'sma10',
  'sma20',
  'sma50',
  'sma200',
  'ryd_obv',
  'ryd_obv_zscore_80',
];
const INDICATOR_BOOLEAN_FIELDS = [
  'ryd_obv_buy_signal',
  'ryd_obv_sell_signal',
];
const INDICATOR_TEXT_FIELDS = [
  'volume_event',
  'volume_event_tone',
  'ryd_obv_signal',
];

function storageValueForTextField(row, field) {
  if (field === 'volume_event') return row[field] ?? 'normal';
  if (field === 'volume_event_tone') return row[field] ?? 'neutral';
  return row[field] ?? 'none';
}

function buildValuePlaceholderRow(base, fieldsPerRow) {
  const placeholders = Array.from({ length: fieldsPerRow }, (_, index) => `$${base + index + 1}`);
  return `(${placeholders.join(', ')}, now())`;
}

export function buildStockDailyIndicatorUpsertStatements(rows, batchSize = INDICATOR_BATCH_SIZE) {
  const insertFields = [
    'ticker',
    'date',
    ...INDICATOR_VALUE_FIELDS,
    'price_basis',
    ...INDICATOR_BOOLEAN_FIELDS,
    ...INDICATOR_TEXT_FIELDS,
    'updated_at',
  ];
  const updateFields = [
    ...INDICATOR_VALUE_FIELDS,
    'price_basis',
    ...INDICATOR_BOOLEAN_FIELDS,
    ...INDICATOR_TEXT_FIELDS,
  ];

  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const fieldsPerRow = 2 + INDICATOR_VALUE_FIELDS.length + 1 + INDICATOR_BOOLEAN_FIELDS.length + INDICATOR_TEXT_FIELDS.length;
    const values = batch.map((row, index) => {
      const base = index * fieldsPerRow;
      params.push(
        row.ticker,
        row.date,
        ...INDICATOR_VALUE_FIELDS.map((field) => formatIndicatorValueForStorage(row[field])),
        'adj_close_or_close',
        ...INDICATOR_BOOLEAN_FIELDS.map((field) => row[field] ?? false),
        ...INDICATOR_TEXT_FIELDS.map((field) => storageValueForTextField(row, field))
      );

      return buildValuePlaceholderRow(base, fieldsPerRow);
    });

    return {
      sql: `insert into stock_daily_indicators (
        ${insertFields.join(', ')}
      ) values ${values.join(', ')}
      on conflict (ticker, date) do update set
        ${updateFields.map((field) => `${field} = excluded.${field}`).join(',\n        ')},
        updated_at = now()`,
      params,
    };
  });
}

export async function getPriceHistoryForIndicators({ ticker = null, tickerLimit = null } = {}) {
  const priceSelect = `ticker, date::text as date, open::text as open, high::text as high, low::text as low, close::text as close, adj_close::text as adj_close, volume::text as volume`;

  if (ticker) {
    const result = await query(
      `select ${priceSelect}
       from stock_daily_prices
       where ticker = $1 and coalesce(adj_close, close) is not null
       order by date asc`,
      [ticker]
    );
    return result.rows;
  }

  if (tickerLimit) {
    const result = await query(
      `with selected_tickers as (
         select ticker
         from stock_daily_prices
         group by ticker
         order by ticker asc
         limit $1
       )
       select p.ticker, p.date::text as date, p.open::text as open, p.high::text as high, p.low::text as low, p.close::text as close, p.adj_close::text as adj_close, p.volume::text as volume
       from stock_daily_prices p
       inner join selected_tickers t on t.ticker = p.ticker
       where coalesce(p.adj_close, p.close) is not null
       order by p.ticker asc, p.date asc`,
      [tickerLimit]
    );
    return result.rows;
  }

  const result = await query(
    `select ${priceSelect}
     from stock_daily_prices
     where coalesce(adj_close, close) is not null
     order by ticker asc, date asc`
  );

  return result.rows;
}

export async function upsertStockDailyIndicators(rows) {
  if (!rows.length) return 0;

  const statements = buildStockDailyIndicatorUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getLatestIndicatorDateForTicker(ticker) {
  const result = await query(
    `select max(date)::text as latest_date
     from stock_daily_indicators
     where ticker = $1`,
    [ticker]
  );

  return result.rows[0]?.latest_date ?? null;
}

export async function getStoredIndicatorRow(ticker, date) {
  const result = await query(
    `select
       ticker,
       date::text as date,
       indicator_price::text as indicator_price,
       daily_return_pct::text as daily_return_pct,
       avg_volume20::text as avg_volume20,
       relative_volume20::text as relative_volume20,
       volume_z20::text as volume_z20,
       trend_20d_pct::text as trend_20d_pct,
       range_pct::text as range_pct,
       body_pct::text as body_pct,
       pct_from_52w_high::text as pct_from_52w_high,
       pct_from_52w_low::text as pct_from_52w_low,
       price_basis,
       sma5::text as sma5,
       sma10::text as sma10,
       sma20::text as sma20,
       sma50::text as sma50,
       sma200::text as sma200,
       volume_event,
       volume_event_tone,
       ryd_obv::text as ryd_obv,
       ryd_obv_zscore_80::text as ryd_obv_zscore_80,
       ryd_obv_buy_signal,
       ryd_obv_sell_signal,
       ryd_obv_signal
     from stock_daily_indicators
     where ticker = $1 and date = $2
     limit 1`,
    [ticker, date]
  );

  return result.rows[0] ?? null;
}

export async function getIndicatorValidationWindow(ticker, date, lookback = 200) {
  const result = await query(
    `with recent as (
       select ticker, date::text as date, open::text as open, high::text as high, low::text as low, close::text as close, adj_close::text as adj_close, volume::text as volume
       from stock_daily_prices
       where ticker = $1 and date <= $2 and coalesce(adj_close, close) is not null
       order by date desc
       limit $3
     )
     select *
     from recent
     order by date asc`,
    [ticker, date, lookback]
  );

  return result.rows;
}
