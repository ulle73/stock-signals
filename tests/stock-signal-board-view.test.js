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
    priceZscoreActiveCount: 0,
    ibsRsiActiveCount: 0,
    macdVActiveCount: 0,
    regimeBreakoutCount: 0,
    breakoutActiveCount: 0,
    tfSyncActiveCount: 0,
    plceActiveCount: 0,
    watchlistCount: 1,
    latestIndicatorDate: '2026-05-13',
    latestRegimeBreakoutDate: null,
    latestWatchlistDate: '2026-05-12',
  });

  assert.deepEqual(viewModel.rows.map((row) => row.ticker), ['CAH', 'ACN', 'NVDA', 'MSFT']);

  assert.equal(viewModel.rows[0].ticker, 'CAH');
  assert.equal(viewModel.rows[0].currentSignalTone, 'positive');
  assert.equal(viewModel.rows[0].activeIndicatorCount, 1);
  assert.deepEqual(viewModel.rows[0].currentSignals, [
    {
      key: 'ryd_obv_buy',
      label: 'RYD OBV buy',
      tone: 'positive',
    },
  ]);
  assert.deepEqual(viewModel.rows[0].latestSignal, {
    date: '2026-05-13',
    label: 'RYD OBV buy',
    tone: 'positive',
    source: 'indicator',
  });
  assert.equal(viewModel.rows[0].indicatorDetails.length, 10);
  assert.equal(viewModel.rows[0].indicatorDetails[0].key, 'ryd_obv');

  assert.equal(viewModel.rows[2].ticker, 'NVDA');
  assert.equal(viewModel.rows[2].activeIndicatorCount, 0);
  assert.deepEqual(viewModel.rows[2].currentSignals, [
    {
      key: 'swing_watchlist_long',
      label: 'Swing watchlist long',
      tone: 'positive',
    },
  ]);
  assert.deepEqual(viewModel.rows[2].latestSignal, {
    date: '2026-05-12',
    label: 'Swing watchlist long',
    tone: 'positive',
    source: 'watchlist',
  });
  assert.deepEqual(viewModel.rows[2].watchlist, {
    date: '2026-05-12',
    bias: 'long',
    setup: 'improving',
    decision: 'LONG WATCHLIST',
    score: 7.4,
    isActionable: true,
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

test('buildStockSignalBoardViewModel exposes all stock indicators for compact chips and detailed drilldown', () => {
  const viewModel = buildStockSignalBoardViewModel([
    {
      ticker: 'AAPL',
      company_name: 'Apple',
      sector: 'Information Technology',
      current_date: '2026-05-15',
      indicator_price: '299.12',
      daily_return_pct: '1.14',
      relative_volume20: '1.21',
      volume_z20: '2.44',
      ryd_obv: '5000000',
      ryd_obv_zscore_80: '2.812345',
      ryd_obv_signal: 'buy',
      volume_event: 'accumulation',
      volume_event_tone: 'positive',
      price_zscore_20: '-1.234567',
      price_zscore_avg_20: '-1.456789',
      price_zscore_signal: 'buy',
      ibs_value: '12.5',
      rsi14: '28.4',
      ibs_rsi_signal: 'buy',
      macd_v: '81.234567',
      macd_v_signal: 'active',
      breakout_20d_high: '300.50',
      breakout_20d_low: '266.20',
      breakout_20d_signal: 'buy',
      tf_sync_signal: 'buy_active',
      tf_sync_buy_active: true,
      tf_sync_sell_active: false,
      tf_sync_intraday_60m_candle_at: '2026-05-15T19:30:00.000Z',
      tf_sync_weekly_open: '287.00',
      tf_sync_weekly_close: '299.12',
      tf_sync_daily_green: true,
      tf_sync_weekly_green: true,
      tf_sync_intraday_green: true,
      plce_threshold_value: '3500001',
      plce_threshold_signal: 'buy',
      latest_active_indicator_date: '2026-05-15',
      latest_active_ryd_obv_signal: 'buy',
      latest_active_volume_event: 'accumulation',
      latest_active_volume_event_tone: 'positive',
      latest_active_price_zscore_signal: 'buy',
      latest_active_ibs_rsi_signal: 'buy',
      latest_active_macd_v_signal: 'active',
      latest_active_breakout_20d_signal: 'buy',
      latest_active_tf_sync_date: '2026-05-15',
      latest_active_tf_sync_signal: 'buy_active',
      latest_active_plce_threshold_signal: 'buy',
      latest_watchlist_date: '2026-05-15',
      latest_watchlist_bias: 'long',
      latest_watchlist_setup: 'bullish',
      latest_watchlist_decision: 'KÖP STARKA SEKTORER',
      latest_watchlist_score: '8.2',
      latest_watchlist_is_actionable: true,
      board_watchlist_date: '2026-05-15',
    },
  ]);

  assert.equal(viewModel.rows[0].activeIndicatorCount, 8);
  assert.deepEqual(
    viewModel.rows[0].currentSignals.map((signal) => signal.key),
    [
      'ryd_obv_buy',
      'price_zscore_buy',
      'ibs_rsi_buy',
      'macd_v_active',
      'breakout_20d_buy',
      'tf_sync_buy_active',
      'plce_threshold_buy',
      'volume_accumulation',
      'swing_watchlist_long',
    ]
  );

  assert.deepEqual(
    viewModel.rows[0].indicatorDetails.map((item) => item.key),
    [
      'ryd_obv',
      'volume',
      'price_zscore',
      'ibs_rsi',
      'macd_v',
      'regime_breakout',
      'breakout_20d',
      'tf_sync',
      'plce_threshold',
      'watchlist',
    ]
  );

  assert.deepEqual(viewModel.rows[0].indicatorDetails[2], {
    key: 'price_zscore',
    label: 'Price z-score',
    signalLabel: 'Buy',
    tone: 'positive',
    isActive: true,
    metrics: [
      { label: 'Z20', value: -1.23 },
      { label: 'Snitt 20', value: -1.46 },
    ],
  });

  assert.deepEqual(viewModel.rows[0].indicatorDetails[3], {
    key: 'ibs_rsi',
    label: 'IBS + RSI',
    signalLabel: 'Buy',
    tone: 'positive',
    isActive: true,
    metrics: [
      { label: 'IBS', value: 12.5 },
      { label: 'RSI14', value: 28.4 },
    ],
  });

  assert.deepEqual(viewModel.rows[0].indicatorDetails[4], {
    key: 'macd_v',
    label: 'MACD-V',
    signalLabel: 'Active',
    tone: 'positive',
    isActive: true,
    metrics: [
      { label: 'MACD-V', value: 81.23 },
      { label: 'State', value: 'Active' },
    ],
  });

  assert.deepEqual(viewModel.rows[0].indicatorDetails[7], {
    key: 'tf_sync',
    label: 'TF Sync',
    signalLabel: 'Buy active',
    tone: 'positive',
    isActive: true,
    metrics: [
      { label: 'Vecko-open', value: 287 },
      { label: 'Vecko-close', value: 299.12 },
      { label: '1D', value: 'Grön' },
      { label: '1W', value: 'Grön' },
      { label: '60m', value: 'Grön' },
      { label: 'Senaste 60m', value: '2026-05-15T19:30:00.000Z' },
    ],
  });

  assert.deepEqual(viewModel.rows[0].indicatorDetails[8], {
    key: 'plce_threshold',
    label: 'PLCE threshold',
    signalLabel: 'Buy',
    tone: 'positive',
    isActive: true,
    metrics: [
      { label: 'Threshold', value: 3500001 },
    ],
  });
});

test('buildStockSignalBoardViewModel supports summary override and pagination metadata for partial board loads', () => {
  const rows = [
    {
      ticker: 'AAPL',
      company_name: 'Apple',
      sector: 'Information Technology',
      current_date: '2026-05-15',
      indicator_price: '300.23',
      daily_return_pct: '0.68',
      relative_volume20: '1.13',
      volume_event: 'normal',
      volume_event_tone: 'neutral',
      ryd_obv_signal: 'none',
      latest_active_indicator_date: '2026-05-15',
      latest_active_ryd_obv_signal: 'none',
      latest_active_volume_event: 'normal',
      latest_active_volume_event_tone: 'neutral',
      latest_watchlist_date: null,
      latest_watchlist_bias: null,
      latest_watchlist_setup: null,
      latest_watchlist_decision: null,
      latest_watchlist_score: null,
      latest_watchlist_is_actionable: null,
      board_watchlist_date: '2026-05-15',
    },
    {
      ticker: 'ACN',
      company_name: 'Accenture',
      sector: 'Information Technology',
      current_date: '2026-05-15',
      indicator_price: '168.82',
      daily_return_pct: '2.95',
      relative_volume20: '0.86',
      volume_event: 'normal',
      volume_event_tone: 'neutral',
      price_zscore_signal: 'buy',
      ryd_obv_signal: 'none',
      latest_active_indicator_date: '2026-05-15',
      latest_active_ryd_obv_signal: 'none',
      latest_active_price_zscore_signal: 'buy',
      latest_active_volume_event: 'normal',
      latest_active_volume_event_tone: 'neutral',
      latest_watchlist_date: null,
      latest_watchlist_bias: null,
      latest_watchlist_setup: null,
      latest_watchlist_decision: null,
      latest_watchlist_score: null,
      latest_watchlist_is_actionable: null,
      board_watchlist_date: '2026-05-15',
    },
  ];

  const summary = {
    totalTickers: 503,
    activeNowCount: 91,
    obvActiveCount: 3,
    volumeActiveCount: 34,
    priceZscoreActiveCount: 16,
    ibsRsiActiveCount: 20,
    macdVActiveCount: 175,
    regimeBreakoutCount: 12,
    breakoutActiveCount: 80,
    tfSyncActiveCount: 503,
    plceActiveCount: 0,
    watchlistCount: 16,
    latestIndicatorDate: '2026-05-15',
    latestRegimeBreakoutDate: '2026-05-14',
    latestWatchlistDate: '2026-05-15',
  };

  const viewModel = buildStockSignalBoardViewModel(rows, {
    summary,
    pagination: {
      offset: 0,
      limit: 20,
      visibleCount: 2,
      totalRows: 503,
      hasMore: true,
      nextOffset: 20,
    },
  });

  assert.deepEqual(viewModel.summary, summary);
  assert.deepEqual(viewModel.pagination, {
    offset: 0,
    limit: 20,
    visibleCount: 2,
    totalRows: 503,
    hasMore: true,
    nextOffset: 20,
  });
  assert.deepEqual(viewModel.rows.map((row) => row.ticker), ['ACN', 'AAPL']);
});

test('buildStockSignalBoardViewModel exposes regime breakout trigger and blocked detail states', () => {
  const viewModel = buildStockSignalBoardViewModel([
    {
      ticker: 'NVDA',
      company_name: 'NVIDIA',
      sector: 'Information Technology',
      current_date: '2026-06-24',
      indicator_price: '154',
      daily_return_pct: '2.15',
      relative_volume20: '1.8',
      breakout_20d_high: '150',
      breakout_20d_signal: 'buy',
      regime_breakout_decision: 'trigger',
      regime_breakout_data_quality_status: 'warn',
      regime_breakout_market_signal: 'neutral',
      regime_breakout_sector_signal: 'improving',
      regime_breakout_relative_volume20: '1.8',
      regime_breakout_rs_percentile_63d: '95.2',
      regime_breakout_setup_score: 4,
      regime_breakout_reason_summary: 'quality_warn:stock_daily_price_coverage|market_neutral|sector_improving|volume_confirmed|rs_confirmed',
      latest_active_indicator_date: '2026-06-24',
      latest_active_breakout_20d_signal: 'buy',
      latest_active_regime_breakout_date: '2026-06-24',
      latest_active_regime_breakout_reason_summary: 'quality_warn:stock_daily_price_coverage|market_neutral|sector_improving|volume_confirmed|rs_confirmed',
      latest_watchlist_date: null,
      latest_watchlist_bias: null,
      latest_watchlist_setup: null,
      latest_watchlist_decision: null,
      latest_watchlist_score: null,
      latest_watchlist_is_actionable: null,
      board_watchlist_date: '2026-06-24',
    },
    {
      ticker: 'AAPL',
      company_name: 'Apple',
      sector: 'Information Technology',
      current_date: '2026-06-24',
      indicator_price: '209',
      daily_return_pct: '1.01',
      relative_volume20: '2.1',
      breakout_20d_high: '205',
      breakout_20d_signal: 'buy',
      regime_breakout_decision: 'blocked',
      regime_breakout_data_quality_status: 'block',
      regime_breakout_market_signal: 'risk_off',
      regime_breakout_sector_signal: 'leading',
      regime_breakout_relative_volume20: '2.1',
      regime_breakout_rs_percentile_63d: '88',
      regime_breakout_setup_score: 3,
      regime_breakout_reason_summary: 'quality_block:stock_daily_prices_freshness|market_risk_off|sector_leading|volume_confirmed|rs_confirmed',
      latest_active_indicator_date: '2026-06-24',
      latest_active_breakout_20d_signal: 'buy',
      latest_active_regime_breakout_date: null,
      latest_active_regime_breakout_reason_summary: null,
      latest_watchlist_date: null,
      latest_watchlist_bias: null,
      latest_watchlist_setup: null,
      latest_watchlist_decision: null,
      latest_watchlist_score: null,
      latest_watchlist_is_actionable: null,
      board_watchlist_date: '2026-06-24',
    },
  ]);

  assert.equal(viewModel.summary.regimeBreakoutCount, 1);
  assert.equal(viewModel.summary.latestRegimeBreakoutDate, '2026-06-24');
  assert.deepEqual(
    viewModel.rows[0].currentSignals.map((signal) => signal.key),
    ['regime_breakout_long', 'breakout_20d_buy']
  );
  assert.deepEqual(viewModel.rows[0].latestSignal, {
    date: '2026-06-24',
    label: 'Regime breakout long',
    tone: 'positive',
    source: 'indicator',
  });

  const triggerDetail = viewModel.rows[0].indicatorDetails.find((item) => item.key === 'regime_breakout');
  assert.deepEqual(triggerDetail, {
    key: 'regime_breakout',
    label: 'Regime breakout',
    signalLabel: 'Triggered',
    tone: 'positive',
    isActive: true,
    statusLabel: 'Aktiv',
    metrics: [
      { label: 'Marknad', value: 'neutral' },
      { label: 'Sektor', value: 'improving' },
      { label: 'RVOL20', value: 1.8 },
      { label: 'RS 63d %ile', value: 95.2 },
      { label: 'Quality', value: 'warn' },
      { label: 'Score', value: 4 },
      { label: 'Senast trigger', value: '2026-06-24' },
      { label: 'Skal', value: 'quality_warn:stock_daily_price_coverage|market_neutral|sector_improving|volume_confirmed|rs_confirmed' },
    ],
  });

  const blockedDetail = viewModel.rows[1].indicatorDetails.find((item) => item.key === 'regime_breakout');
  assert.deepEqual(blockedDetail, {
    key: 'regime_breakout',
    label: 'Regime breakout',
    signalLabel: 'Blocked',
    tone: 'danger',
    isActive: false,
    statusLabel: 'Blocked',
    metrics: [
      { label: 'Marknad', value: 'risk_off' },
      { label: 'Sektor', value: 'leading' },
      { label: 'RVOL20', value: 2.1 },
      { label: 'RS 63d %ile', value: 88 },
      { label: 'Quality', value: 'block' },
      { label: 'Score', value: 3 },
      { label: 'Skal', value: 'quality_block:stock_daily_prices_freshness|market_risk_off|sector_leading|volume_confirmed|rs_confirmed' },
    ],
  });
});
