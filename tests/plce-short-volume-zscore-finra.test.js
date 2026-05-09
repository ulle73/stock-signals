import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFinraShortVolumeFile, selectFinraShortVolumeRow } from '../lib/sources/finra-short-volume.js';
import { buildPlceShortVolumeIndicatorRows } from '../lib/indicators/plce-short-volume-zscore-finra.js';
import { buildFinraShortVolumeUpsertStatements } from '../lib/repositories/finra-short-volume.js';
import { buildPlceShortVolumeIndicatorUpsertStatements } from '../lib/repositories/plce-short-volume-indicator.js';

function buildIsoDates(count, startDate = '2026-02-01') {
  const start = new Date(`${startDate}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
}

test('parseFinraShortVolumeFile parses pipe-delimited FINRA rows and does not sum symbols together', () => {
  const text = [
    'Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market',
    '20260413|A|355992.368184|0|702370.339735|NMS',
    '20260413|PLCE|2000001|1250|4210000|NMS',
    '20260413|ZZZ|9000000|25|15000000|NMS',
  ].join('\n');

  const rows = parseFinraShortVolumeFile(text);
  const plceRow = selectFinraShortVolumeRow(rows, 'PLCE');

  assert.equal(rows.length, 3);
  assert.deepEqual(plceRow, {
    date: '2026-04-13',
    symbol: 'PLCE',
    short_volume: 2000001,
    short_exempt_volume: 1250,
    total_volume: 4210000,
    market: 'NMS',
  });
});

test('buildFinraShortVolumeUpsertStatements stores FINRA short-volume fields for PLCE', () => {
  const rows = [
    {
      date: '2026-04-13',
      symbol: 'PLCE',
      short_volume: 2000001,
      short_exempt_volume: 1250,
      total_volume: 4210000,
      market: 'NMS',
      source: 'finra',
      source_url: 'https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260413.txt',
    },
  ];

  const statements = buildFinraShortVolumeUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into finra_daily_short_volume/i);
  assert.deepEqual(statements[0].params, [
    '2026-04-13',
    'PLCE',
    '2000001',
    '1250',
    '4210000',
    'NMS',
    'finra',
    'https://cdn.finra.org/equity/regsho/daily/CNMSshvol20260413.txt',
  ]);
});

test('buildPlceShortVolumeIndicatorRows handles z-score warmup and price condition from PLCE short volume', () => {
  const dates = buildIsoDates(20);
  const values = [
    ...Array(18).fill(900000),
    1600000,
    1800001,
  ];

  const rows = dates.map((date, index) => ({
    date,
    symbol: 'PLCE',
    short_volume: values[index],
    short_exempt_volume: 0,
    total_volume: values[index] * 2,
    market: 'NMS',
  }));

  const indicatorRows = buildPlceShortVolumeIndicatorRows(rows);
  const latestRow = indicatorRows.at(-1);

  assert.equal(latestRow.plce_short_volume_price_condition, true);
  assert.equal(indicatorRows[18].plce_short_volume_zscore_50, null);
  assert.notEqual(latestRow.plce_short_volume_zscore_20, null);
});

test('buildPlceShortVolumeIndicatorRows calculates raw buy and extreme signals from FINRA short volume', () => {
  const dates = buildIsoDates(50);
  const values = [
    ...Array(47).fill(500000),
    1300000,
    1900000,
    4100000,
  ];

  const rows = dates.map((date, index) => ({
    date,
    symbol: 'PLCE',
    short_volume: values[index],
    short_exempt_volume: 0,
    total_volume: values[index] * 2,
    market: 'NMS',
  }));

  const indicatorRows = buildPlceShortVolumeIndicatorRows(rows);
  const latestRow = indicatorRows.at(-1);
  const rowBeforeWarmup = indicatorRows[48];

  assert.equal(rowBeforeWarmup.plce_short_volume_zscore_50, null);
  assert.ok(Math.abs(latestRow.plce_short_volume_zscore_50 - 6.384937) < 0.0001);
  assert.ok(Math.abs(latestRow.plce_short_volume_zscore_20 - 3.973558) < 0.0001);
  assert.equal(latestRow.plce_short_volume_price_condition, true);
  assert.equal(latestRow.plce_short_volume_buy_signal_50, true);
  assert.equal(latestRow.plce_short_volume_buy_signal_20, true);
  assert.equal(latestRow.plce_short_volume_extreme_signal, true);
  assert.equal(latestRow.plce_short_volume_signal, 'multiple_buy_signals');
});

test('buildPlceShortVolumeIndicatorUpsertStatements stores raw PLCE short-volume values and raw signal fields', () => {
  const rows = [
    {
      date: '2026-04-13',
      plce_short_volume: 2000001,
      plce_short_exempt_volume: 1250,
      plce_total_volume: 4210000,
      plce_short_volume_market: 'NMS',
      plce_short_volume_zscore_50: 3.123456,
      plce_short_volume_zscore_20: 3.654321,
      plce_short_volume_price_condition: true,
      plce_short_volume_buy_signal_50: true,
      plce_short_volume_buy_signal_20: true,
      plce_short_volume_extreme_signal: false,
      plce_short_volume_signal: 'multiple_buy_signals',
    },
  ];

  const statements = buildPlceShortVolumeIndicatorUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into plce_short_volume_indicator_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-04-13',
    '2000001',
    '1250',
    '4210000',
    'NMS',
    '3.123456',
    '3.654321',
    true,
    true,
    true,
    false,
    'multiple_buy_signals',
  ]);
});
