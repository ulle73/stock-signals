import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStockSignalBoardViewModel } from '../lib/utils/stock-signal-board-view.js';

test('buildStockSignalBoardViewModel prioritizes active signals and summarizes board coverage', () => {
  const viewModel = buildStockSignalBoardViewModel([
    {
      ticker: 'CAH',
      company_name: 'Cardinal Health',
      sector: 'Health Care',
      current_date: '2026-05-13',
      indicator_price: '186.350006',
      daily_return_pct: '1.84',
      relative_volume20: '1.18',
      ryd_obv_signal: 'buy',
      volume_event: 'normal',
      volume_event_tone: 'neutral',
      latest_active_indicator_date: '2026-05-13',
      latest_active_ryd_obv_signal: 'buy',
      latest_active_volume_event: 'normal',
      latest_active_volume_event_tone: 'neutral',
      latest_watchlist_date: null,
      latest_watchlist_bias: null,
      latest_watchlist_setup: null,
      latest_watchlist_decision: null,
      latest_watchlist_score: null,
      latest_watchlist_is_actionable: null,
      board_watchlist_date: '2026-05-12',
    },
    {
      ticker: 'ACN',
      company_name: 'Accenture',
      sector: 'Information Technology',
      current_date: '2026-05-13',
      indicator_price: '159.639999',
      daily_return_pct: '-2.12',
      relative_volume20: '1.74',
      ryd_obv_signal: 'none',
      volume_event: 'distribution',
      volume_event_tone: 'danger',
      latest_active_indicator_date: '2026-05-13',
      latest_active_ryd_obv_signal: 'none',
      latest_active_volume_event: 'distribution',
      latest_active_volume_event_tone: 'danger',
      latest_watchlist_date: null,
      latest_watchlist_bias: null,
      latest_watchlist_setup: null,
      latest_watchlist_decision: null,
      latest_watchlist_score: null,
      latest_watchlist_is_actionable: null,
      board_watchlist_date: '2026-05-12',
    },
    {
      ticker: 'NVDA',
      company_name: 'NVIDIA',
      sector: 'Information Technology',
      current_date: '2026-05-13',
      indicator_price: '925.150024',
      daily_return_pct: '0.35',
      relative_volume20: '0.98',
      ryd_obv_signal: 'none',
      volume_event: 'normal',
      volume_event_tone: 'neutral',
      latest_active_indicator_date: '2026-05-08',
      latest_active_ryd_obv_signal: 'none',
      latest_active_volume_event: 'accumulation',
      latest_active_volume_event_tone: 'positive',
      latest_watchlist_date: '2026-05-12',
      latest_watchlist_bias: 'long',
      latest_watchlist_setup: 'improving',
      latest_watchlist_decision: 'LONG WATCHLIST',
      latest_watchlist_score: '7.4',
      latest_watchlist_is_actionable: true,
      board_watchlist_date: '2026-05-12',
    },
    {
      ticker: 'MSFT',
      company_name: 'Microsoft',
      sector: 'Information Technology',
      current_date: '2026-05-13',
      indicator_price: '412.11',
      daily_return_pct: '0.15',
      relative_volume20: '0.91',
      ryd_obv_signal: 'none',
      volume_event: 'normal',
      volume_event_tone: 'neutral',
      latest_active_indicator_date: null,
      latest_active_ryd_obv_signal: 'none',
      latest_active_volume_event: 'normal',
      latest_active_volume_event_tone: 'neutral',
      latest_watchlist_date: null,
      latest_watchlist_bias: null,
      latest_watchlist_setup: null,
      latest_watchlist_decision: null,
      latest_watchlist_score: null,
      latest_watchlist_is_actionable: null,
      board_watchlist_date: '2026-05-12',
    },
  ]);

  assert.deepEqual(viewModel.summary, {
    totalTickers: 4,
    activeNowCount: 3,
    obvActiveCount: 1,
    volumeActiveCount: 1,
    watchlistCount: 1,
    latestIndicatorDate: '2026-05-13',
    latestWatchlistDate: '2026-05-12',
  });

  assert.deepEqual(viewModel.rows.map((row) => row.ticker), ['CAH', 'ACN', 'NVDA', 'MSFT']);

  assert.deepEqual(viewModel.rows[0], {
    ticker: 'CAH',
    companyName: 'Cardinal Health',
    sector: 'Health Care',
    currentDate: '2026-05-13',
    currentPrice: 186.35,
    dailyReturnPct: 1.84,
    relativeVolume20: 1.18,
    currentSignalTone: 'positive',
    currentSignals: [
      {
        key: 'ryd_obv_buy',
        label: 'RYD OBV buy',
        tone: 'positive',
      },
    ],
    latestSignal: {
      date: '2026-05-13',
      label: 'RYD OBV buy',
      tone: 'positive',
      source: 'indicator',
    },
    watchlist: null,
  });

  assert.deepEqual(viewModel.rows[2], {
    ticker: 'NVDA',
    companyName: 'NVIDIA',
    sector: 'Information Technology',
    currentDate: '2026-05-13',
    currentPrice: 925.15,
    dailyReturnPct: 0.35,
    relativeVolume20: 0.98,
    currentSignalTone: 'positive',
    currentSignals: [
      {
        key: 'swing_watchlist_long',
        label: 'Swing watchlist long',
        tone: 'positive',
      },
    ],
    latestSignal: {
      date: '2026-05-12',
      label: 'Swing watchlist long',
      tone: 'positive',
      source: 'watchlist',
    },
    watchlist: {
      date: '2026-05-12',
      bias: 'long',
      setup: 'improving',
      decision: 'LONG WATCHLIST',
      score: 7.4,
      isActionable: true,
    },
  });

  assert.deepEqual(viewModel.rows[3].latestSignal, {
    date: null,
    label: 'Ingen aktiv signal ännu',
    tone: 'neutral',
    source: 'none',
  });
});

test('buildStockSignalBoardViewModel keeps latest active indicator signal when it is newer than watchlist history', () => {
  const viewModel = buildStockSignalBoardViewModel([
    {
      ticker: 'USB',
      company_name: 'U.S. Bancorp',
      sector: 'Financials',
      current_date: '2026-05-13',
      indicator_price: '52.740001',
      daily_return_pct: '-1.55',
      relative_volume20: '1.64',
      ryd_obv_signal: 'none',
      volume_event: 'distribution',
      volume_event_tone: 'danger',
      latest_active_indicator_date: '2026-05-13',
      latest_active_ryd_obv_signal: 'none',
      latest_active_volume_event: 'distribution',
      latest_active_volume_event_tone: 'danger',
      latest_watchlist_date: '2026-05-12',
      latest_watchlist_bias: 'short',
      latest_watchlist_setup: 'weakening',
      latest_watchlist_decision: 'SHORT WATCHLIST',
      latest_watchlist_score: '6.8',
      latest_watchlist_is_actionable: false,
      board_watchlist_date: '2026-05-12',
    },
  ]);

  assert.deepEqual(viewModel.rows[0].latestSignal, {
    date: '2026-05-13',
    label: 'Distribution',
    tone: 'danger',
    source: 'indicator',
  });
});
