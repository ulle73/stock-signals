import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMacroMatrixYahooProxySourceRows,
  buildMacroMatrixYahooProxySourceUpsertStatements,
  getMacroMatrixYahooProxySymbols,
} from '../lib/repositories/macro-matrix-yahoo-proxy-source.js';

test('getMacroMatrixYahooProxySymbols returns the deduplicated proxy universe used by both macro matrices', () => {
  const symbols = getMacroMatrixYahooProxySymbols();

  assert.ok(symbols.includes('SHY'));
  assert.ok(symbols.includes('TLT'));
  assert.ok(symbols.includes('IEF'));
  assert.ok(symbols.includes('PICK'));
  assert.ok(symbols.includes('KIE'));
  assert.ok(symbols.includes('UNG'));
  assert.ok(symbols.includes('^OMX'));
  assert.ok(symbols.includes('XACT-OMXS30.ST'));

  assert.equal(new Set(symbols).size, symbols.length);
  assert.ok(symbols.length >= 46);
});

test('buildMacroMatrixYahooProxySourceRows maps Yahoo candles into DB source rows with traceable source URL', () => {
  const rows = buildMacroMatrixYahooProxySourceRows(
    'TLT',
    [
      {
        date: '2026-05-12',
        open: 84.11,
        high: 84.76,
        low: 83.92,
        close: 84.55,
        adj_close: 84.32,
        volume: 34321000,
      },
      {
        date: '2026-05-13',
        open: 84.58,
        high: 84.81,
        low: 83.77,
        close: 84.02,
        adj_close: 83.79,
        volume: 29123000,
      },
    ],
    { range: '10y' }
  );

  assert.deepEqual(rows, [
    {
      date: '2026-05-12',
      symbol: 'TLT',
      open: 84.11,
      high: 84.76,
      low: 83.92,
      close: 84.55,
      adj_close: 84.32,
      volume: 34321000,
      source: 'yahoo',
      source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/TLT?range=10y&interval=1d',
    },
    {
      date: '2026-05-13',
      symbol: 'TLT',
      open: 84.58,
      high: 84.81,
      low: 83.77,
      close: 84.02,
      adj_close: 83.79,
      volume: 29123000,
      source: 'yahoo',
      source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/TLT?range=10y&interval=1d',
    },
  ]);
});

test('buildMacroMatrixYahooProxySourceUpsertStatements stores proxy daily candles in a dedicated source table', () => {
  const rows = [
    {
      date: '2026-05-12',
      symbol: 'TLT',
      open: 84.11,
      high: 84.76,
      low: 83.92,
      close: 84.55,
      adj_close: 84.32,
      volume: 34321000,
      source: 'yahoo',
      source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/TLT?range=10y&interval=1d',
    },
  ];

  const statements = buildMacroMatrixYahooProxySourceUpsertStatements(rows, 10);

  assert.equal(statements.length, 1);
  assert.match(statements[0].sql, /insert into macro_matrix_yahoo_proxy_daily/i);
  assert.match(statements[0].sql, /on conflict \(symbol, date\) do update set/i);
  assert.deepEqual(statements[0].params, [
    'TLT',
    '2026-05-12',
    '84.11',
    '84.76',
    '83.92',
    '84.55',
    '84.32',
    '34321000',
    'yahoo',
    'https://query1.finance.yahoo.com/v8/finance/chart/TLT?range=10y&interval=1d',
  ]);
});
