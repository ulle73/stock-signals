import { query } from '../db.js';
import { buildYahooChartUrl } from '../sources/yahoo.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';
import { SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS } from '../indicators/macro-matrix-sector-factor-regime-performance.js';
import { EQUITY_SECTOR_STYLE_ASSET_DEFINITIONS } from '../indicators/macro-matrix-equity-sector-style-regime-performance.js';

const PROXY_BATCH_SIZE = 100;
const OMXS30_BENCHMARK_SYMBOLS = ['^OMX', 'XACT-OMXS30.ST'];

function collectSymbols(assetDefinitions) {
  return assetDefinitions
    .filter((asset) => asset.source === 'yahoo' && asset.sourceSymbol && asset.sourceStatus !== 'missing')
    .map((asset) => asset.sourceSymbol);
}

export function getMacroMatrixYahooProxySymbols() {
  return [
    ...new Set([
      ...collectSymbols(SECTOR_FACTOR_REGIME_ASSET_DEFINITIONS),
      ...collectSymbols(EQUITY_SECTOR_STYLE_ASSET_DEFINITIONS),
      ...OMXS30_BENCHMARK_SYMBOLS,
    ]),
  ];
}

export function buildMacroMatrixYahooProxySourceRows(symbol, candles, request) {
  const sourceUrl = buildYahooChartUrl(symbol, request);

  return candles.map((candle) => ({
    date: candle.date,
    symbol,
    open: candle.open ?? null,
    high: candle.high ?? null,
    low: candle.low ?? null,
    close: candle.close ?? null,
    adj_close: candle.adj_close ?? null,
    volume: candle.volume ?? null,
    source: 'yahoo',
    source_url: sourceUrl,
  }));
}

export function buildMacroMatrixYahooProxySourceUpsertStatements(
  rows,
  batchSize = PROXY_BATCH_SIZE
) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 10;
      params.push(
        row.symbol,
        row.date,
        formatIndicatorValueForStorage(row.open),
        formatIndicatorValueForStorage(row.high),
        formatIndicatorValueForStorage(row.low),
        formatIndicatorValueForStorage(row.close),
        formatIndicatorValueForStorage(row.adj_close),
        formatIndicatorValueForStorage(row.volume),
        row.source,
        row.source_url
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, now())`;
    });

    return {
      sql: `insert into macro_matrix_yahoo_proxy_daily (
        symbol, date, open, high, low, close, adj_close, volume, source, source_url, updated_at
      ) values ${values.join(', ')}
      on conflict (symbol, date) do update set
        open = excluded.open,
        high = excluded.high,
        low = excluded.low,
        close = excluded.close,
        adj_close = excluded.adj_close,
        volume = excluded.volume,
        source = excluded.source,
        source_url = excluded.source_url,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertMacroMatrixYahooProxySourceRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildMacroMatrixYahooProxySourceUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getMacroMatrixYahooProxyRows(symbols = null) {
  const hasSymbols = Array.isArray(symbols) && symbols.length > 0;
  const result = await query(
    `select
       symbol,
       date::text as date,
       open::text as open,
       high::text as high,
       low::text as low,
       close::text as close,
       adj_close::text as adj_close,
       volume::text as volume,
       source,
       source_url
     from macro_matrix_yahoo_proxy_daily
     ${hasSymbols ? 'where symbol = any($1::text[])' : ''}
     order by symbol asc, date asc`,
    hasSymbols ? [symbols] : []
  );

  return result.rows;
}

export async function getMacroMatrixYahooProxyRowsBySymbol(symbols = null) {
  const rows = await getMacroMatrixYahooProxyRows(symbols);
  const rowsBySymbol = new Map();

  for (const row of rows) {
    if (!rowsBySymbol.has(row.symbol)) {
      rowsBySymbol.set(row.symbol, []);
    }

    rowsBySymbol.get(row.symbol).push({
      date: row.date,
      open: row.open === null ? null : Number(row.open),
      high: row.high === null ? null : Number(row.high),
      low: row.low === null ? null : Number(row.low),
      close: row.close === null ? null : Number(row.close),
      adj_close: row.adj_close === null ? null : Number(row.adj_close),
      volume: row.volume === null ? null : Number(row.volume),
    });
  }

  return rowsBySymbol;
}

export async function getLatestMacroMatrixYahooProxyDates() {
  const result = await query(
    `select symbol, max(date)::text as latest_date
     from macro_matrix_yahoo_proxy_daily
     group by symbol`
  );

  return Object.fromEntries(
    result.rows.map((row) => [row.symbol, row.latest_date])
  );
}
