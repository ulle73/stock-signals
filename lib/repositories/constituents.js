import { query } from '../db.js';

export async function upsertConstituents(items) {
  if (!items.length) return 0;

  let count = 0;

  for (const item of items) {
    await query(
      `insert into sp500_constituents (
        ticker, yahoo_ticker, company_name, sector, industry, is_active, source, last_seen_at, updated_at
      ) values ($1, $2, $3, $4, $5, true, 'wikipedia', now(), now())
      on conflict (ticker) do update set
        yahoo_ticker = excluded.yahoo_ticker,
        company_name = excluded.company_name,
        sector = excluded.sector,
        industry = excluded.industry,
        is_active = true,
        last_seen_at = now(),
        updated_at = now()`,
      [item.ticker, item.yahoo_ticker, item.company_name, item.sector, item.industry]
    );
    count += 1;
  }

  return count;
}

export async function getActiveConstituents() {
  const result = await query(
    `select ticker, yahoo_ticker, company_name, sector, industry
     from sp500_constituents
     where is_active = true
     order by ticker asc`
  );

  return result.rows;
}
