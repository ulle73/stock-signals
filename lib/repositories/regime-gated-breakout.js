import { query } from '../db.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const DEFAULT_QUERY_CLIENT = { query };
const REGIME_GATED_BREAKOUT_BATCH_SIZE = 100;
const REGIME_GATED_BREAKOUT_FIELDS = [
  'date',
  'ticker',
  'company_name',
  'sector',
  'market_signal',
  'market_regime_score',
  'sector_signal',
  'breakout_20d_high',
  'indicator_price',
  'relative_volume20',
  'rs_63d_vs_spy',
  'rs_rank_63d',
  'rs_percentile_63d',
  'data_quality_status',
  'regime_confirmed',
  'sector_confirmed',
  'volume_confirmed',
  'rs_confirmed',
  'qualifies',
  'decision',
  'setup_score',
  'reason_summary',
  'row_values',
];

const NUMERIC_FIELDS = new Set([
  'market_regime_score',
  'breakout_20d_high',
  'indicator_price',
  'relative_volume20',
  'rs_63d_vs_spy',
  'rs_percentile_63d',
]);

function formatFieldValue(row, field) {
  if (field === 'row_values') {
    return JSON.stringify(row[field] ?? {});
  }

  if (NUMERIC_FIELDS.has(field)) {
    return formatIndicatorValueForStorage(row[field]);
  }

  return row[field] ?? null;
}

export function buildRegimeGatedBreakoutUpsertStatements(
  rows,
  batchSize = REGIME_GATED_BREAKOUT_BATCH_SIZE
) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * REGIME_GATED_BREAKOUT_FIELDS.length;
      params.push(...REGIME_GATED_BREAKOUT_FIELDS.map((field) => formatFieldValue(row, field)));

      const placeholders = REGIME_GATED_BREAKOUT_FIELDS.map((field, fieldIndex) => {
        const parameter = `$${base + fieldIndex + 1}`;
        return field === 'row_values' ? `${parameter}::jsonb` : parameter;
      });

      return `(${placeholders.join(', ')}, now(), now())`;
    });

    return {
      sql: `insert into regime_gated_breakout_daily (
        ${REGIME_GATED_BREAKOUT_FIELDS.join(', ')}, created_at, updated_at
      ) values ${values.join(', ')}
      on conflict (date, ticker) do update set
        ${REGIME_GATED_BREAKOUT_FIELDS.filter((field) => !['date', 'ticker'].includes(field)).map((field) => `${field} = excluded.${field}`).join(',\n        ')},
        updated_at = now()`,
      params,
    };
  });
}

export async function getRegimeGatedBreakoutSourceRows(queryClient = DEFAULT_QUERY_CLIENT) {
  const [breakoutResult, marketSignalResult, sectorSignalResult, relativeStrengthResult, qualityGateResult, earningsCalendarResult] = await Promise.all([
    queryClient.query(
      `select
         i.date::text as date,
         i.ticker,
         c.company_name,
         c.sector,
         i.breakout_20d_high::text as breakout_20d_high,
         i.indicator_price::text as indicator_price,
         i.relative_volume20::text as relative_volume20
       from stock_daily_indicators i
       join sp500_constituents c
         on c.ticker = i.ticker
       where c.is_active = true
         and i.breakout_20d_buy_signal = true
       order by i.date asc, i.ticker asc`
    ),
    queryClient.query(
      `select
         date::text as date,
         signal,
         market_regime_score::text as market_regime_score
       from market_signal_daily
       order by date asc`
    ),
    queryClient.query(
      `select
         date::text as date,
         sector,
         signal
       from sector_signal_daily
       order by date asc, sector asc`
    ),
    queryClient.query(
      `select
         ticker,
         date::text as date,
         rs_63d_vs_spy::text as rs_63d_vs_spy,
         rs_rank_63d,
         rs_percentile_63d::text as rs_percentile_63d
       from stock_relative_strength_daily
       where benchmark_ticker = 'SPY'
       order by date asc, ticker asc`
    ),
    queryClient.query(
      `select
         date::text as date,
         gate_key,
         status
       from signal_data_quality_daily
       where gate_key = any($1::text[])
       order by date asc, gate_key asc`,
      [[
        'stock_daily_prices_freshness',
        'benchmark_spy_freshness',
        'market_signal_freshness',
        'relative_strength_freshness',
        'stock_daily_price_coverage',
        'relative_strength_coverage',
      ]]
    ),
    queryClient.query(
      `select
         date::text as date,
         ticker,
         earnings_date::text as earnings_date,
         confirmed,
         source_status
       from stock_earnings_calendar_daily
       order by ticker asc, date asc`
    ),
  ]);

  return {
    breakoutRows: breakoutResult.rows,
    marketSignalRows: marketSignalResult.rows,
    sectorSignalRows: sectorSignalResult.rows,
    relativeStrengthRows: relativeStrengthResult.rows,
    qualityGateRows: qualityGateResult.rows,
    earningsCalendarRows: earningsCalendarResult.rows,
  };
}

export async function upsertRegimeGatedBreakoutRows(rows, queryClient = DEFAULT_QUERY_CLIENT) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildRegimeGatedBreakoutUpsertStatements(rows);
  for (const statement of statements) {
    await queryClient.query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getRegimeGatedBreakoutRows(
  {
    decision = null,
    date = null,
    ticker = null,
    limit = 200,
  } = {},
  queryClient = DEFAULT_QUERY_CLIENT
) {
  const filters = [];
  const params = [];

  if (decision !== null) {
    params.push(decision);
    filters.push(`decision = $${params.length}`);
  }

  if (date !== null) {
    params.push(date);
    filters.push(`date = $${params.length}::date`);
  }

  if (ticker !== null) {
    params.push(ticker);
    filters.push(`ticker = $${params.length}`);
  }

  params.push(limit);

  const whereClause = filters.length
    ? `where ${filters.join(' and ')}`
    : '';

  const result = await queryClient.query(
    `select
       date::text as date,
       ticker,
       company_name,
       sector,
       market_signal,
       market_regime_score::text as market_regime_score,
       sector_signal,
       breakout_20d_high::text as breakout_20d_high,
       indicator_price::text as indicator_price,
       relative_volume20::text as relative_volume20,
       rs_63d_vs_spy::text as rs_63d_vs_spy,
       rs_rank_63d,
       rs_percentile_63d::text as rs_percentile_63d,
       data_quality_status,
       regime_confirmed,
       sector_confirmed,
       volume_confirmed,
       rs_confirmed,
       qualifies,
       decision,
       setup_score,
       reason_summary,
       row_values
     from regime_gated_breakout_daily
     ${whereClause}
     order by date asc, ticker asc
     limit $${params.length}`,
    params
  );

  return result.rows;
}

export async function getRegimeGatedBreakoutEventSourceRows(queryClient = DEFAULT_QUERY_CLIENT) {
  return getRegimeGatedBreakoutRows({ decision: 'trigger', limit: 100000 }, queryClient);
}
