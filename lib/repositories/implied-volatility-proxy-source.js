import { query } from '../db.js';
import { buildYahooChartUrl } from '../sources/yahoo.js';
import { chunkArray } from '../utils/chunk.js';
import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

const IMPLIED_VOLATILITY_PROXY_SOURCE_BATCH_SIZE = 100;
const DEFAULT_YAHOO_REQUEST = { range: '800d' };

export const IMPLIED_VOLATILITY_PROXY_ASSET_DEFINITIONS = [
  {
    assetKey: 'spy_sp500',
    assetName: 'SPDR S&P 500 SPY',
    assetType: 'equity_index',
    sourceSymbol: 'SPY',
    impliedVolatilitySymbol: '^VIX',
  },
  {
    assetKey: 'qqq_nasdaq',
    assetName: 'Invesco QQQ Trust',
    assetType: 'equity_index',
    sourceSymbol: 'QQQ',
    impliedVolatilitySymbol: '^VXN',
  },
  {
    assetKey: 'dia_dow',
    assetName: 'SPDR Dow Jones Industrial Average ETF',
    assetType: 'equity_index',
    sourceSymbol: 'DIA',
    impliedVolatilitySymbol: '^VXD',
  },
  {
    assetKey: 'gld_gold',
    assetName: 'SPDR Gold Trust',
    assetType: 'commodity_etf',
    sourceSymbol: 'GLD',
    impliedVolatilitySymbol: '^GVZ',
  },
  {
    assetKey: 'uso_oil',
    assetName: 'United States Oil Fund',
    assetType: 'commodity_etf',
    sourceSymbol: 'USO',
    impliedVolatilitySymbol: '^OVX',
  },
  {
    assetKey: 'ewz_brazil',
    assetName: 'iShares MSCI Brazil ETF',
    assetType: 'equity_index',
    sourceSymbol: 'EWZ',
    impliedVolatilitySymbol: '^VXEWZ',
  },
  {
    assetKey: 'efa_developed',
    assetName: 'iShares MSCI EAFE ETF',
    assetType: 'equity_index',
    sourceSymbol: 'EFA',
    impliedVolatilitySymbol: '^VXEFA',
  },
];

export function buildImpliedVolatilityProxySourceRows(
  definition,
  priceRows,
  impliedVolatilityRows,
  request = DEFAULT_YAHOO_REQUEST
) {
  const impliedVolatilityByDate = new Map(
    impliedVolatilityRows.map((row) => [row.date, row.close ?? row.adj_close ?? null])
  );
  const priceSourceUrl = buildYahooChartUrl(definition.sourceSymbol, request);
  const impliedVolatilitySourceUrl = buildYahooChartUrl(definition.impliedVolatilitySymbol, request);

  return priceRows.map((priceRow) => {
    const impliedVolatility = impliedVolatilityByDate.has(priceRow.date)
      ? impliedVolatilityByDate.get(priceRow.date)
      : null;

    return {
      date: priceRow.date,
      asset_key: definition.assetKey,
      asset_name: definition.assetName,
      asset_type: definition.assetType,
      source_symbol: definition.sourceSymbol,
      implied_volatility_symbol: definition.impliedVolatilitySymbol,
      close: priceRow.close ?? null,
      adj_close: priceRow.adj_close ?? null,
      volume: priceRow.volume ?? null,
      implied_volatility: impliedVolatility,
      source_status: impliedVolatility === null ? 'missing' : 'active',
      price_source: 'yahoo',
      implied_volatility_source: 'yahoo_cboe_proxy',
      price_source_url: priceSourceUrl,
      implied_volatility_source_url: impliedVolatilitySourceUrl,
    };
  });
}

export function buildImpliedVolatilityProxySourceUpsertStatements(
  rows,
  batchSize = IMPLIED_VOLATILITY_PROXY_SOURCE_BATCH_SIZE
) {
  return chunkArray(rows, batchSize).map((batch) => {
    const params = [];
    const values = batch.map((row, index) => {
      const base = index * 15;
      params.push(
        row.date,
        row.asset_key,
        row.asset_name,
        row.asset_type,
        row.source_symbol,
        row.implied_volatility_symbol,
        formatIndicatorValueForStorage(row.close),
        formatIndicatorValueForStorage(row.adj_close),
        formatIndicatorValueForStorage(row.volume),
        formatIndicatorValueForStorage(row.implied_volatility),
        row.source_status,
        row.price_source,
        row.implied_volatility_source,
        row.price_source_url,
        row.implied_volatility_source_url
      );

      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10}, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14}, $${base + 15}, now())`;
    });

    return {
      sql: `insert into implied_volatility_proxy_source_daily (
        date, asset_key, asset_name, asset_type, source_symbol, implied_volatility_symbol,
        close, adj_close, volume, implied_volatility, source_status, price_source,
        implied_volatility_source, price_source_url, implied_volatility_source_url, updated_at
      ) values ${values.join(', ')}
      on conflict (date, asset_key) do update set
        asset_name = excluded.asset_name,
        asset_type = excluded.asset_type,
        source_symbol = excluded.source_symbol,
        implied_volatility_symbol = excluded.implied_volatility_symbol,
        close = excluded.close,
        adj_close = excluded.adj_close,
        volume = excluded.volume,
        implied_volatility = excluded.implied_volatility,
        source_status = excluded.source_status,
        price_source = excluded.price_source,
        implied_volatility_source = excluded.implied_volatility_source,
        price_source_url = excluded.price_source_url,
        implied_volatility_source_url = excluded.implied_volatility_source_url,
        updated_at = now()`,
      params,
    };
  });
}

export async function upsertImpliedVolatilityProxySourceRows(rows) {
  if (!rows.length) {
    return 0;
  }

  const statements = buildImpliedVolatilityProxySourceUpsertStatements(rows);

  for (const statement of statements) {
    await query(statement.sql, statement.params);
  }

  return rows.length;
}

export async function getImpliedVolatilityProxySourceRows(assetKeys = null) {
  const whereClause = assetKeys?.length ? 'where asset_key = any($1::text[])' : '';
  const params = assetKeys?.length ? [assetKeys] : [];
  const result = await query(
    `select
       date::text as date,
       asset_key,
       asset_name,
       asset_type,
       source_symbol,
       implied_volatility_symbol,
       close::text as close,
       adj_close::text as adj_close,
       volume::text as volume,
       implied_volatility::text as implied_volatility,
       source_status,
       price_source,
       implied_volatility_source,
       price_source_url,
       implied_volatility_source_url
     from implied_volatility_proxy_source_daily
     ${whereClause}
     order by asset_key asc, date asc`,
    params
  );

  return result.rows;
}
