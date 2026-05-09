import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBarchartBreadthPage } from '../lib/sources/barchart-breadth.js';
import { buildR3twMmtw20dmaBreadthIndicatorRows } from '../lib/indicators/r3tw-mmtw-20dma-breadth-barchart.js';
import { buildExternalBreadthUpsertStatements } from '../lib/repositories/barchart-breadth.js';
import { buildR3twMmtw20dmaBreadthIndicatorUpsertStatements } from '../lib/repositories/r3tw-mmtw-breadth-indicator.js';

test('parseBarchartBreadthPage parses Last Price from the configured symbol page without relying on full title text', () => {
  const html = `
    <html>
      <body>
        <script>
          window.__data = {"currentSymbol":{"symbol":"$MMTW","lastPrice":"53.72","symbolName":"MMTW"}};
        </script>
      </body>
    </html>
  `;

  assert.deepEqual(
    parseBarchartBreadthPage({
      seriesKey: 'MMTW',
      symbol: '$MMTW',
      sourceUrl: 'https://www.barchart.com/stocks/quotes/%24MMTW',
      snapshotDate: '2026-05-07',
      html,
    }),
    {
      date: '2026-05-07',
      series_key: 'MMTW',
      symbol: '$MMTW',
      name: 'MMTW',
      value: 53.72,
      source: 'barchart',
      source_url: 'https://www.barchart.com/stocks/quotes/%24MMTW',
    }
  );
});

test('buildExternalBreadthUpsertStatements stores raw Barchart breadth values for R3TW and MMTW', () => {
  const rows = [
    {
      date: '2026-05-07',
      series_key: 'R3TW',
      symbol: '$R3TW',
      name: 'Russell 3000 Stocks Above 20-Day Average',
      value: 53.52,
      source: 'barchart',
      source_url: 'https://www.barchart.com/stocks/quotes/%24R3TW',
    },
    {
      date: '2026-05-07',
      series_key: 'MMTW',
      symbol: '$MMTW',
      name: 'MMTW',
      value: 53.72,
      source: 'barchart',
      source_url: 'https://www.barchart.com/stocks/quotes/%24MMTW',
    },
  ];

  const statements = buildExternalBreadthUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into external_breadth_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-05-07',
    'R3TW',
    '$R3TW',
    'Russell 3000 Stocks Above 20-Day Average',
    '53.52',
    'barchart',
    'https://www.barchart.com/stocks/quotes/%24R3TW',
    '2026-05-07',
    'MMTW',
    '$MMTW',
    'MMTW',
    '53.72',
    'barchart',
    'https://www.barchart.com/stocks/quotes/%24MMTW',
  ]);
});

test('buildR3twMmtw20dmaBreadthIndicatorRows requires both R3TW and MMTW to cross above 20 on the same date', () => {
  const rows = [
    { date: '2026-05-05', series_key: 'R3TW', value: 19.5 },
    { date: '2026-05-05', series_key: 'MMTW', value: 19.8 },
    { date: '2026-05-06', series_key: 'R3TW', value: 20.5 },
    { date: '2026-05-06', series_key: 'MMTW', value: 19.9 },
    { date: '2026-05-07', series_key: 'R3TW', value: 21.0 },
    { date: '2026-05-07', series_key: 'MMTW', value: 20.1 },
    { date: '2026-05-08', series_key: 'R3TW', value: 19.5 },
    { date: '2026-05-08', series_key: 'MMTW', value: 19.5 },
    { date: '2026-05-09', series_key: 'R3TW', value: 21.1 },
    { date: '2026-05-09', series_key: 'MMTW', value: 20.2 },
  ];

  const indicatorRows = buildR3twMmtw20dmaBreadthIndicatorRows(rows);

  assert.deepEqual(indicatorRows.map((row) => ({
    date: row.date,
    r3tw_cross_up_20: row.r3tw_cross_up_20,
    mmtw_cross_up_20: row.mmtw_cross_up_20,
    r3tw_mmtw_buy_signal: row.r3tw_mmtw_buy_signal,
    r3tw_mmtw_signal: row.r3tw_mmtw_signal,
  })), [
    {
      date: '2026-05-05',
      r3tw_cross_up_20: false,
      mmtw_cross_up_20: false,
      r3tw_mmtw_buy_signal: false,
      r3tw_mmtw_signal: 'none',
    },
    {
      date: '2026-05-06',
      r3tw_cross_up_20: true,
      mmtw_cross_up_20: false,
      r3tw_mmtw_buy_signal: false,
      r3tw_mmtw_signal: 'none',
    },
    {
      date: '2026-05-07',
      r3tw_cross_up_20: false,
      mmtw_cross_up_20: true,
      r3tw_mmtw_buy_signal: false,
      r3tw_mmtw_signal: 'none',
    },
    {
      date: '2026-05-08',
      r3tw_cross_up_20: false,
      mmtw_cross_up_20: false,
      r3tw_mmtw_buy_signal: false,
      r3tw_mmtw_signal: 'none',
    },
    {
      date: '2026-05-09',
      r3tw_cross_up_20: true,
      mmtw_cross_up_20: true,
      r3tw_mmtw_buy_signal: true,
      r3tw_mmtw_signal: 'buy_both_cross_above_20',
    },
  ]);
});

test('buildR3twMmtw20dmaBreadthIndicatorUpsertStatements stores raw crossover values and signal fields', () => {
  const rows = [
    {
      date: '2026-05-09',
      r3tw_value: 21.1,
      mmtw_value: 20.2,
      r3tw_cross_up_20: true,
      mmtw_cross_up_20: true,
      r3tw_mmtw_buy_signal: true,
      r3tw_mmtw_signal: 'buy_both_cross_above_20',
    },
  ];

  const statements = buildR3twMmtw20dmaBreadthIndicatorUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into r3tw_mmtw_20dma_breadth_indicator_daily/i);
  assert.deepEqual(statements[0].params, [
    '2026-05-09',
    '21.1',
    '20.2',
    true,
    true,
    true,
    'buy_both_cross_above_20',
  ]);
});
