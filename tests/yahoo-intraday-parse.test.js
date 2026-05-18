import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYahooIntradayChartPayload } from '../lib/sources/yahoo.js';

test('parseYahooIntradayChartPayload returns normalized 60m candles with timestamps', () => {
  const payload = {
    chart: {
      result: [
        {
          timestamp: [1777930200, 1777933800, 1777937400],
          indicators: {
            quote: [
              {
                open: [580.12, 581.1, 582.25],
                high: [581.0, 582.4, 583.1],
                low: [579.9, 580.8, 581.6],
                close: [580.88, null, 582.92],
                volume: [1245500, 1123000, 998800],
              },
            ],
            adjclose: [
              {
                adjclose: [580.88, null, 582.92],
              },
            ],
          },
        },
      ],
    },
  };

  const rows = parseYahooIntradayChartPayload('SPY', payload);

  assert.deepEqual(rows, [
    {
      candle_at: '2026-05-04T21:30:00.000Z',
      session_date: '2026-05-04',
      open: 580.12,
      high: 581,
      low: 579.9,
      close: 580.88,
      adj_close: 580.88,
      volume: 1245500,
    },
    {
      candle_at: '2026-05-04T23:30:00.000Z',
      session_date: '2026-05-04',
      open: 582.25,
      high: 583.1,
      low: 581.6,
      close: 582.92,
      adj_close: 582.92,
      volume: 998800,
    },
  ]);
});
