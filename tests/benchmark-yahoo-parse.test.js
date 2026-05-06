import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYahooDailyChartPayload } from '../lib/sources/yahoo.js';

test('parseYahooDailyChartPayload returns normalized daily rows for benchmark payloads', () => {
  const payload = {
    chart: {
      result: [
        {
          timestamp: [1777939200, 1778025600, 1778112000],
          indicators: {
            quote: [
              {
                open: [580.12, 582.11, 581.2],
                high: [582.34, 583.45, 582.7],
                low: [579.56, 580.9, 579.4],
                close: [581.78, null, 580.05],
                volume: [101234500, 99887766, 110223344],
              },
            ],
            adjclose: [
              {
                adjclose: [581.65, null, 579.91],
              },
            ],
          },
        },
      ],
    },
  };

  const rows = parseYahooDailyChartPayload('SPY', payload);

  assert.deepEqual(rows, [
    {
      date: '2026-05-05',
      open: 580.12,
      high: 582.34,
      low: 579.56,
      close: 581.78,
      adj_close: 581.65,
      volume: 101234500,
    },
    {
      date: '2026-05-07',
      open: 581.2,
      high: 582.7,
      low: 579.4,
      close: 580.05,
      adj_close: 579.91,
      volume: 110223344,
    },
  ]);
});
