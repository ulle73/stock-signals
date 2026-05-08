import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSectorSignalRowsFromSources } from '../lib/utils/sector-signals.js';

function buildSectorRow(sector, date, {
  active_ticker_count = 20,
  advancers,
  decliners,
  pct_above_sma50,
  pct_above_sma200,
  new_highs_52w,
  new_lows_52w,
}) {
  return {
    date,
    sector,
    active_ticker_count,
    advancers,
    decliners,
    unchanged: 0,
    pct_above_sma20: pct_above_sma50,
    pct_above_sma50,
    pct_above_sma200,
    new_highs_52w,
    new_lows_52w,
    is_valid_signal_date: true,
  };
}

test('buildSectorSignalRowsFromSources classifies sectors into leading, improving, weakening, and lagging', () => {
  const sectorBreadthRows = [];
  const dates = Array.from({ length: 15 }, (_, index) => `2026-01-${String(index + 1).padStart(2, '0')}`);

  for (const date of dates.slice(0, 14)) {
    sectorBreadthRows.push(
      buildSectorRow('Information Technology', date, {
        advancers: 30,
        decliners: 10,
        pct_above_sma50: 55,
        pct_above_sma200: 52,
        new_highs_52w: 5,
        new_lows_52w: 1,
      }),
      buildSectorRow('Energy', date, {
        advancers: 15,
        decliners: 20,
        pct_above_sma50: 35,
        pct_above_sma200: 40,
        new_highs_52w: 1,
        new_lows_52w: 5,
      }),
      buildSectorRow('Utilities', date, {
        advancers: 24,
        decliners: 16,
        pct_above_sma50: 60,
        pct_above_sma200: 58,
        new_highs_52w: 6,
        new_lows_52w: 2,
      }),
      buildSectorRow('Materials', date, {
        advancers: 14,
        decliners: 26,
        pct_above_sma50: 44,
        pct_above_sma200: 43,
        new_highs_52w: 1,
        new_lows_52w: 4,
      })
    );
  }

  sectorBreadthRows.push(
    buildSectorRow('Information Technology', '2026-01-15', {
      advancers: 35,
      decliners: 8,
      pct_above_sma50: 70,
      pct_above_sma200: 64,
      new_highs_52w: 8,
      new_lows_52w: 1,
    }),
    buildSectorRow('Energy', '2026-01-15', {
      advancers: 28,
      decliners: 22,
      pct_above_sma50: 49,
      pct_above_sma200: 46,
      new_highs_52w: 4,
      new_lows_52w: 2,
    }),
    buildSectorRow('Utilities', '2026-01-15', {
      advancers: 18,
      decliners: 28,
      pct_above_sma50: 45,
      pct_above_sma200: 52,
      new_highs_52w: 2,
      new_lows_52w: 3,
    }),
    buildSectorRow('Materials', '2026-01-15', {
      advancers: 10,
      decliners: 34,
      pct_above_sma50: 30,
      pct_above_sma200: 35,
      new_highs_52w: 0,
      new_lows_52w: 6,
    })
  );

  const rows = buildSectorSignalRowsFromSources({ sectorBreadthRows });
  const latestRows = rows.filter((row) => row.date === '2026-01-15');

  assert.deepEqual(
    latestRows.map((row) => ({
      sector: row.sector,
      sector_regime_score: row.sector_regime_score,
      signal: row.signal,
      pct_above_sma50_14d_change: row.pct_above_sma50_14d_change,
      pct_above_sma200_14d_change: row.pct_above_sma200_14d_change,
      ad_net: row.ad_net,
      reason_summary: row.reason_summary,
    })),
    [
      {
        sector: 'Energy',
        sector_regime_score: 1,
        signal: 'improving',
        pct_above_sma50_14d_change: 14,
        pct_above_sma200_14d_change: 6,
        ad_net: 6,
        reason_summary: 'sector_breadth_improving',
      },
      {
        sector: 'Information Technology',
        sector_regime_score: 5,
        signal: 'leading',
        pct_above_sma50_14d_change: 15,
        pct_above_sma200_14d_change: 12,
        ad_net: 27,
        reason_summary: 'strong_sector_breadth',
      },
      {
        sector: 'Materials',
        sector_regime_score: -5,
        signal: 'lagging',
        pct_above_sma50_14d_change: -14,
        pct_above_sma200_14d_change: -8,
        ad_net: -24,
        reason_summary: 'broad_sector_weakness',
      },
      {
        sector: 'Utilities',
        sector_regime_score: -1,
        signal: 'weakening',
        pct_above_sma50_14d_change: -15,
        pct_above_sma200_14d_change: -6,
        ad_net: -10,
        reason_summary: 'sector_breadth_weakening',
      },
    ]
  );
});
