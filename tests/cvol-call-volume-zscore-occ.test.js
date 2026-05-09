import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOccDailyVolumePayload } from '../lib/sources/occ.js';
import { buildCvolCallVolumeIndicatorRows } from '../lib/indicators/cvol-call-volume-zscore-occ.js';
import { buildOccDailyVolumeUpsertStatements } from '../lib/repositories/occ-volume-totals.js';
import { buildCvolCallVolumeIndicatorUpsertStatements } from '../lib/repositories/cvol-call-volume-indicator.js';

function buildIsoDates(count, startDate = '2026-01-01') {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

test('parseOccDailyVolumePayload parses OCC daily totals and preserves the Total row fields', () => {
  const payload = {
    statusType: 'OK',
    entity: {
      total_volume: [
        {
          exchange: 'AIM',
          calls: 2354,
          puts: 1210,
          ratio: 0.51,
          volume: 3564,
          market_share: 0.11,
        },
        {
          exchange: 'Total',
          calls: 61722200,
          puts: 37959098,
          ratio: 0.61,
          volume: 99681298,
          market_share: 100,
        },
      ],
    },
  };

  assert.deepEqual(parseOccDailyVolumePayload('2026-04-17', payload), [
    {
      report_date: '2026-04-17',
      exchange: 'AIM',
      calls: 2354,
      puts: 1210,
      ratio: 0.51,
      volume: 3564,
      market_share: 0.11,
      source: 'occ',
      source_url: 'https://marketdata.theocc.com/mdapi/daily-volume-totals?report_date=2026-04-17',
    },
    {
      report_date: '2026-04-17',
      exchange: 'Total',
      calls: 61722200,
      puts: 37959098,
      ratio: 0.61,
      volume: 99681298,
      market_share: 100,
      source: 'occ',
      source_url: 'https://marketdata.theocc.com/mdapi/daily-volume-totals?report_date=2026-04-17',
    },
  ]);
});

test('buildOccDailyVolumeUpsertStatements stores OCC total rows with unique report_date and exchange fields', () => {
  const rows = [
    {
      report_date: '2026-04-17',
      exchange: 'Total',
      calls: 61722200,
      puts: 37959098,
      ratio: 0.61,
      volume: 99681298,
      market_share: 100,
      source: 'occ',
      source_url: 'https://marketdata.theocc.com/mdapi/daily-volume-totals?report_date=2026-04-17',
    },
  ];

  const statements = buildOccDailyVolumeUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into occ_daily_volume_totals/i);
  assert.deepEqual(statements[0].params, [
    '2026-04-17',
    'Total',
    '61722200',
    '37959098',
    '0.61',
    '99681298',
    '100',
    'occ',
    'https://marketdata.theocc.com/mdapi/daily-volume-totals?report_date=2026-04-17',
  ]);
});

test('buildCvolCallVolumeIndicatorRows uses previous stored report rows for price condition and handles z-score warmup', () => {
  const rows = [
    {
      report_date: '2026-04-14',
      exchange: 'Total',
      calls: 11000000,
      puts: 5000000,
      ratio: 0.45,
      volume: 16000000,
      market_share: 100,
    },
    {
      report_date: '2026-04-16',
      exchange: 'Total',
      calls: 21000000,
      puts: 6000000,
      ratio: 0.29,
      volume: 27000000,
      market_share: 100,
    },
    {
      report_date: '2026-04-21',
      exchange: 'Total',
      calls: 31000000,
      puts: 7000000,
      ratio: 0.23,
      volume: 38000000,
      market_share: 100,
    },
  ];

  const indicatorRows = buildCvolCallVolumeIndicatorRows(rows);

  assert.deepEqual(indicatorRows.map((row) => ({
    date: row.date,
    cvol_calls: row.cvol_calls,
    cvol_price_condition: row.cvol_price_condition,
    cvol_zscore_20: row.cvol_zscore_20,
    cvol_signal: row.cvol_signal,
  })), [
    {
      date: '2026-04-14',
      cvol_calls: 11000000,
      cvol_price_condition: false,
      cvol_zscore_20: null,
      cvol_signal: 'none',
    },
    {
      date: '2026-04-16',
      cvol_calls: 21000000,
      cvol_price_condition: false,
      cvol_zscore_20: null,
      cvol_signal: 'none',
    },
    {
      date: '2026-04-21',
      cvol_calls: 31000000,
      cvol_price_condition: true,
      cvol_zscore_20: null,
      cvol_signal: 'none',
    },
  ]);
});

test('buildCvolCallVolumeIndicatorRows calculates z-scores and raw sell signals from OCC call volume', () => {
  const dates = buildIsoDates(20);
  const values = [
    ...Array(17).fill(5000000),
    11000000,
    21000000,
    61000000,
  ];

  const rows = dates.map((date, index) => ({
    report_date: date,
    exchange: 'Total',
    calls: values[index],
    puts: 1000000,
    ratio: 0.5,
    volume: values[index] + 1000000,
    market_share: 100,
  }));

  const indicatorRows = buildCvolCallVolumeIndicatorRows(rows);
  const latestRow = indicatorRows.at(-1);
  const rowBeforeWarmup = indicatorRows[18];

  assert.equal(rowBeforeWarmup.cvol_zscore_20, null);
  assert.ok(Math.abs(latestRow.cvol_zscore_20 - 4.1688) < 0.0001);
  assert.ok(Math.abs(latestRow.cvol_zscore_15 - 3.578767) < 0.0001);
  assert.ok(Math.abs(latestRow.cvol_zscore_10 - 2.870472) < 0.0001);
  assert.equal(latestRow.cvol_price_condition, true);
  assert.equal(latestRow.cvol_sell_signal_1, true);
  assert.equal(latestRow.cvol_sell_signal_2, true);
  assert.equal(latestRow.cvol_sell_signal_3, false);
  assert.equal(latestRow.cvol_signal, 'multiple_sell_signals');
});

test('buildCvolCallVolumeIndicatorUpsertStatements stores raw values and raw signal fields', () => {
  const rows = [
    {
      date: '2026-04-17',
      cvol_calls: 61722200,
      cvol_puts: 37959098,
      cvol_ratio: 0.61,
      cvol_total_volume: 99681298,
      cvol_market_share: 100,
      cvol_zscore_20: 2.345678,
      cvol_zscore_15: 2.901234,
      cvol_zscore_10: null,
      cvol_price_condition: true,
      cvol_sell_signal_1: true,
      cvol_sell_signal_2: true,
      cvol_sell_signal_3: false,
      cvol_signal: 'multiple_sell_signals',
    },
  ];

  const statements = buildCvolCallVolumeIndicatorUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into cvol_call_volume_indicator_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-04-17',
    '61722200',
    '37959098',
    '0.61',
    '99681298',
    '100',
    '2.345678',
    '2.901234',
    null,
    true,
    true,
    true,
    false,
    'multiple_sell_signals',
  ]);
});
