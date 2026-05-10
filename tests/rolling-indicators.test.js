import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTickerIndicators } from '../lib/utils/rolling-indicators.js';
import { classifyVolumeEvent } from '../lib/utils/volume-events.js';

test('calculateTickerIndicators uses adj_close before close and honors warmup windows', () => {
  const rows = [
    { ticker: 'AAPL', date: '2026-01-01', open: '9', high: '11', low: '8', close: '10', adj_close: null, volume: '100' },
    { ticker: 'AAPL', date: '2026-01-02', open: '48', high: '52', low: '47', close: '50', adj_close: '50', volume: '200' },
    { ticker: 'AAPL', date: '2026-01-03', open: '31', high: '32', low: '29', close: '30', adj_close: null, volume: '300' },
  ];

  const indicators = calculateTickerIndicators(rows, [
    { key: 'sma1', size: 1 },
    { key: 'sma2', size: 2 },
    { key: 'sma3', size: 3 },
  ], {
    volumeWindowSize: 2,
    highLowWindowSize: 3,
    trendLookbackSize: 2,
  });

  assert.deepEqual(indicators, [
    {
      ticker: 'AAPL',
      date: '2026-01-01',
      indicator_price: 10,
      daily_return_pct: null,
      trend_20d_pct: null,
      range_pct: 30,
      body_pct: 10,
      avg_volume20: null,
      relative_volume20: null,
      volume_z20: null,
      pct_from_52w_high: null,
      pct_from_52w_low: null,
      sma1: 10,
      sma2: null,
      sma3: null,
      volume_event: 'normal',
      volume_event_tone: 'neutral',
    },
    {
      ticker: 'AAPL',
      date: '2026-01-02',
      indicator_price: 50,
      daily_return_pct: 400,
      trend_20d_pct: null,
      range_pct: 10,
      body_pct: 4,
      avg_volume20: 150,
      relative_volume20: 1.333333,
      volume_z20: 1,
      pct_from_52w_high: null,
      pct_from_52w_low: null,
      sma1: 50,
      sma2: 30,
      sma3: null,
      volume_event: 'normal',
      volume_event_tone: 'neutral',
    },
    {
      ticker: 'AAPL',
      date: '2026-01-03',
      indicator_price: 30,
      daily_return_pct: -40,
      trend_20d_pct: 200,
      range_pct: 10,
      body_pct: 3.333333,
      avg_volume20: 250,
      relative_volume20: 1.2,
      volume_z20: 1,
      pct_from_52w_high: -40,
      pct_from_52w_low: 200,
      sma1: 30,
      sma2: 40,
      sma3: 30,
      volume_event: 'normal',
      volume_event_tone: 'neutral',
    },
  ]);
});

test('classifyVolumeEvent prioritizes volume event regimes', () => {
  assert.deepEqual(classifyVolumeEvent({ relative_volume20: 2, daily_return_pct: 2 }), {
    volume_event: 'accumulation',
    volume_event_tone: 'positive',
  });

  assert.deepEqual(classifyVolumeEvent({ relative_volume20: 2, daily_return_pct: -2 }), {
    volume_event: 'distribution',
    volume_event_tone: 'danger',
  });

  assert.deepEqual(classifyVolumeEvent({
    relative_volume20: 3.5,
    daily_return_pct: -3,
    trend_20d_pct: -10,
    indicator_price: 90,
    sma20: 95,
    sma50: 100,
  }), {
    volume_event: 'possible_capitulation',
    volume_event_tone: 'danger',
  });

  assert.deepEqual(classifyVolumeEvent({
    relative_volume20: 3.5,
    daily_return_pct: 0.2,
    range_pct: 4,
    body_pct: 0.5,
  }), {
    volume_event: 'possible_exhaustion',
    volume_event_tone: 'warning',
  });

  assert.deepEqual(classifyVolumeEvent({ relative_volume20: 0.7, daily_return_pct: 1.2 }), {
    volume_event: 'weak_upside_confirmation',
    volume_event_tone: 'caution',
  });
});

test('calculateTickerIndicators throws when no usable price exists', () => {
  assert.throws(
    () => calculateTickerIndicators([
      { ticker: 'MSFT', date: '2026-01-01', close: null, adj_close: null, volume: '100' },
    ]),
    /usable indicator price/i
  );
});
