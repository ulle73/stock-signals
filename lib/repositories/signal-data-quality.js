import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';

const DEFAULT_QUERY_CLIENT = { query };
const SIGNAL_DATA_QUALITY_BATCH_SIZE = 100;
const SIGNAL_DATA_QUALITY_STATUSES = new Set(['pass', 'warn', 'block']);

function normalizeStatus(status) {
  if (!SIGNAL_DATA_QUALITY_STATUSES.has(status)) {
    throw new Error(`Unsupported signal data quality status: ${status}`);
  }

  return status;
}

export function buildSignalDataQualityUpsertStatements(
  rows,
  batchSize = SIGNAL_DATA_QUALITY_BATCH_SIZE
) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 6;
      params.push(
        row.date,
        row.gate_key,
        normalizeStatus(row.status),
        row.reason_code,
        row.summary,
        JSON.stringify(row.details ?? {})
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}::jsonb, now(), now())`;
    });

    return {
      sql: `insert into signal_data_quality_daily (
        date, gate_key, status, reason_code, summary, details, created_at, updated_at
      ) values ${values.join(', ')}
      on conflict (date, gate_key) do update set
        status = excluded.status,
        reason_code = excluded.reason_code,
        summary = excluded.summary,
        details = excluded.details,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertSignalDataQualityRows(rows, queryClient = DEFAULT_QUERY_CLIENT) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildSignalDataQualityUpsertStatements(rows);
  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getSignalDataQualitySourceSnapshot(expectedDate, queryClient = DEFAULT_QUERY_CLIENT) {
  const result = await queryClient.query(
    `with active_tickers as (
       select ticker
       from sp500_constituents
       where is_active = true
     ),
     latest_ivol_date as (
       select max(date) as latest_date
       from implied_volatility_ratio_signals_daily
     ),
     ivol_status as (
       select
         count(*)::int as total_count,
         count(*) filter (where source_status = 'active')::int as active_count,
         coalesce(
           array_agg(asset_key order by asset_key) filter (where source_status <> 'active'),
           '{}'::text[]
         ) as missing_asset_keys
       from implied_volatility_ratio_signals_daily
       where date = (select latest_date from latest_ivol_date)
     )
     select
       (select count(*)::int from active_tickers) as active_ticker_count,
       (select max(date)::text from stock_daily_prices) as latest_price_date,
       (select count(distinct p.ticker)::int
        from stock_daily_prices p
        inner join active_tickers t on t.ticker = p.ticker
        where p.date = $1::date) as price_ticker_count_for_date,
       (select max(date)::text from benchmark_daily_prices where ticker = 'SPY') as latest_benchmark_date,
       (select max(date)::text from market_signal_daily) as latest_market_signal_date,
       (select max(date)::text from stock_relative_strength_daily) as latest_relative_strength_date,
       (select count(distinct rs.ticker)::int
        from stock_relative_strength_daily rs
        inner join active_tickers t on t.ticker = rs.ticker
        where rs.date = $1::date
          and rs.benchmark_ticker = 'SPY') as relative_strength_ticker_count_for_date,
       (select max(session_date)::text from stock_intraday_prices_60m) as latest_intraday_session_date,
       (select count(distinct i.ticker)::int
        from stock_intraday_prices_60m i
        inner join active_tickers t on t.ticker = i.ticker
        where i.session_date = $1::date) as intraday_ticker_count_for_date,
       (select max(report_date)::text from occ_daily_volume_totals where exchange = 'Total') as latest_occ_report_date,
       (select max(date)::text from finra_daily_short_volume where symbol = 'PLCE') as latest_finra_date,
       (select latest_date::text from latest_ivol_date) as latest_ivol_date,
       (select total_count from ivol_status) as ivol_total_count,
       (select active_count from ivol_status) as ivol_active_count,
       (select missing_asset_keys from ivol_status) as ivol_missing_asset_keys`,
    [expectedDate]
  );

  const row = result.rows[0] ?? {};

  return {
    activeTickerCount: row.active_ticker_count ?? 0,
    latestPriceDate: row.latest_price_date ?? null,
    priceTickerCountForDate: row.price_ticker_count_for_date ?? 0,
    latestBenchmarkDate: row.latest_benchmark_date ?? null,
    latestMarketSignalDate: row.latest_market_signal_date ?? null,
    latestRelativeStrengthDate: row.latest_relative_strength_date ?? null,
    relativeStrengthTickerCountForDate: row.relative_strength_ticker_count_for_date ?? 0,
    latestIntradaySessionDate: row.latest_intraday_session_date ?? null,
    intradayTickerCountForDate: row.intraday_ticker_count_for_date ?? 0,
    latestOccReportDate: row.latest_occ_report_date ?? null,
    latestFinraDate: row.latest_finra_date ?? null,
    latestIvolDate: row.latest_ivol_date ?? null,
    ivolTotalCount: row.ivol_total_count ?? 0,
    ivolActiveCount: row.ivol_active_count ?? 0,
    ivolMissingAssetKeys: Array.isArray(row.ivol_missing_asset_keys)
      ? row.ivol_missing_asset_keys
      : [],
  };
}

export async function getSignalDataQualityRows(
  {
    date = null,
    status = null,
    gateKey = null,
    limit = 200,
  } = {},
  queryClient = DEFAULT_QUERY_CLIENT
) {
  const filters = [];
  const params = [];

  if (date !== null) {
    params.push(date);
    filters.push(`date = $${params.length}::date`);
  }

  if (status !== null) {
    params.push(normalizeStatus(status));
    filters.push(`status = $${params.length}`);
  }

  if (gateKey !== null) {
    params.push(gateKey);
    filters.push(`gate_key = $${params.length}`);
  }

  params.push(limit);

  const whereClause = filters.length
    ? `where ${filters.join(' and ')}`
    : '';

  const result = await queryClient.query(
    `select
       date::text as date,
       gate_key,
       status,
       reason_code,
       summary,
       details
     from signal_data_quality_daily
     ${whereClause}
     order by date desc, gate_key asc
     limit $${params.length}`,
    params
  );

  return result.rows;
}
