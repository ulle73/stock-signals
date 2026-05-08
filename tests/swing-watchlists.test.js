import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSwingWatchlistRowsFromSources } from '../lib/utils/swing-watchlists.js';

function buildIndicatorRow(date, ticker, sector, values) {
  return {
    date,
    ticker,
    sector,
    indicator_price: values.indicator_price,
    daily_return_pct: values.daily_return_pct,
    relative_volume20: values.relative_volume20,
    pct_from_52w_high: values.pct_from_52w_high,
    pct_from_52w_low: values.pct_from_52w_low,
    sma50: values.sma50,
    sma200: values.sma200,
  };
}

test('buildSwingWatchlistRowsFromSources ranks top long and short candidates per day', () => {
  const indicatorRows = [
    buildIndicatorRow('2026-03-10', 'NVDA', 'Information Technology', {
      indicator_price: 110,
      daily_return_pct: 2.1,
      relative_volume20: 1.3,
      pct_from_52w_high: -4,
      pct_from_52w_low: 35,
      sma50: 100,
      sma200: 100,
    }),
    buildIndicatorRow('2026-03-10', 'MSFT', 'Information Technology', {
      indicator_price: 108,
      daily_return_pct: 0.8,
      relative_volume20: 0.8,
      pct_from_52w_high: -9,
      pct_from_52w_low: 28,
      sma50: 100,
      sma200: 100,
    }),
    buildIndicatorRow('2026-03-10', 'JPM', 'Financials', {
      indicator_price: 105,
      daily_return_pct: 0.6,
      relative_volume20: 1.1,
      pct_from_52w_high: -12,
      pct_from_52w_low: 26,
      sma50: 100,
      sma200: 100,
    }),
    buildIndicatorRow('2026-03-10', 'XOM', 'Energy', {
      indicator_price: 80,
      daily_return_pct: -2.5,
      relative_volume20: 1.4,
      pct_from_52w_high: -24,
      pct_from_52w_low: 4,
      sma50: 100,
      sma200: 100,
    }),
    buildIndicatorRow('2026-03-10', 'CVX', 'Energy', {
      indicator_price: 82,
      daily_return_pct: -1.2,
      relative_volume20: 0.9,
      pct_from_52w_high: -21,
      pct_from_52w_low: 8,
      sma50: 100,
      sma200: 100,
    }),
    buildIndicatorRow('2026-03-10', 'NEE', 'Utilities', {
      indicator_price: 90,
      daily_return_pct: -0.8,
      relative_volume20: 1.1,
      pct_from_52w_high: -19,
      pct_from_52w_low: 18,
      sma50: 100,
      sma200: 100,
    }),
  ];

  const sectorSignalRows = [
    { date: '2026-03-10', sector: 'Information Technology', signal: 'leading' },
    { date: '2026-03-10', sector: 'Financials', signal: 'improving' },
    { date: '2026-03-10', sector: 'Energy', signal: 'lagging' },
    { date: '2026-03-10', sector: 'Utilities', signal: 'weakening' },
  ];

  const swingSignalRows = [
    {
      date: '2026-03-10',
      setup: 'bullish',
      decision: 'KÖP STARKA SEKTORER',
    },
  ];

  const rows = buildSwingWatchlistRowsFromSources(
    {
      indicatorRows,
      sectorSignalRows,
      swingSignalRows,
    },
    {
      maxPerBias: 2,
    }
  );

  assert.deepEqual(rows, [
    {
      date: '2026-03-10',
      bias: 'long',
      rank_in_bias: 1,
      ticker: 'NVDA',
      sector: 'Information Technology',
      sector_signal: 'leading',
      swing_setup: 'bullish',
      swing_decision: 'KÖP STARKA SEKTORER',
      playbook: 'deploy_long',
      is_actionable: true,
      watchlist_score: 9,
      indicator_price: 110,
      daily_return_pct: 2.1,
      relative_volume20: 1.3,
      pct_from_52w_high: -4,
      pct_from_52w_low: 35,
      distance_from_sma50_pct: 10,
      distance_from_sma200_pct: 10,
      reason_summary: 'leading_sector_momentum',
    },
    {
      date: '2026-03-10',
      bias: 'long',
      rank_in_bias: 2,
      ticker: 'MSFT',
      sector: 'Information Technology',
      sector_signal: 'leading',
      swing_setup: 'bullish',
      swing_decision: 'KÖP STARKA SEKTORER',
      playbook: 'deploy_long',
      is_actionable: true,
      watchlist_score: 8,
      indicator_price: 108,
      daily_return_pct: 0.8,
      relative_volume20: 0.8,
      pct_from_52w_high: -9,
      pct_from_52w_low: 28,
      distance_from_sma50_pct: 8,
      distance_from_sma200_pct: 8,
      reason_summary: 'leading_sector_momentum',
    },
    {
      date: '2026-03-10',
      bias: 'short',
      rank_in_bias: 1,
      ticker: 'XOM',
      sector: 'Energy',
      sector_signal: 'lagging',
      swing_setup: 'bullish',
      swing_decision: 'KÖP STARKA SEKTORER',
      playbook: 'standby_short',
      is_actionable: false,
      watchlist_score: 9,
      indicator_price: 80,
      daily_return_pct: -2.5,
      relative_volume20: 1.4,
      pct_from_52w_high: -24,
      pct_from_52w_low: 4,
      distance_from_sma50_pct: -20,
      distance_from_sma200_pct: -20,
      reason_summary: 'lagging_sector_breakdown',
    },
    {
      date: '2026-03-10',
      bias: 'short',
      rank_in_bias: 2,
      ticker: 'CVX',
      sector: 'Energy',
      sector_signal: 'lagging',
      swing_setup: 'bullish',
      swing_decision: 'KÖP STARKA SEKTORER',
      playbook: 'standby_short',
      is_actionable: false,
      watchlist_score: 8,
      indicator_price: 82,
      daily_return_pct: -1.2,
      relative_volume20: 0.9,
      pct_from_52w_high: -21,
      pct_from_52w_low: 8,
      distance_from_sma50_pct: -18,
      distance_from_sma200_pct: -18,
      reason_summary: 'lagging_sector_breakdown',
    },
  ]);
});

test('buildSwingWatchlistRowsFromSources annotates weakening setups as defensive and hedge watchlists', () => {
  const indicatorRows = [
    buildIndicatorRow('2026-03-11', 'COST', 'Consumer Staples', {
      indicator_price: 107,
      daily_return_pct: 0.9,
      relative_volume20: 1.1,
      pct_from_52w_high: -7,
      pct_from_52w_low: 30,
      sma50: 100,
      sma200: 100,
    }),
    buildIndicatorRow('2026-03-11', 'VST', 'Utilities', {
      indicator_price: 82,
      daily_return_pct: -1.7,
      relative_volume20: 1.2,
      pct_from_52w_high: -22,
      pct_from_52w_low: 6,
      sma50: 100,
      sma200: 100,
    }),
  ];

  const sectorSignalRows = [
    { date: '2026-03-11', sector: 'Consumer Staples', signal: 'improving' },
    { date: '2026-03-11', sector: 'Utilities', signal: 'weakening' },
  ];

  const swingSignalRows = [
    {
      date: '2026-03-11',
      setup: 'weakening',
      decision: 'MINSKA RISK',
    },
  ];

  const rows = buildSwingWatchlistRowsFromSources({ indicatorRows, sectorSignalRows, swingSignalRows });

  assert.deepEqual(
    rows.map((row) => ({
      bias: row.bias,
      ticker: row.ticker,
      playbook: row.playbook,
      is_actionable: row.is_actionable,
    })),
    [
      {
        bias: 'long',
        ticker: 'COST',
        playbook: 'defensive_watch',
        is_actionable: false,
      },
      {
        bias: 'short',
        ticker: 'VST',
        playbook: 'hedge_watch',
        is_actionable: false,
      },
    ]
  );
});
