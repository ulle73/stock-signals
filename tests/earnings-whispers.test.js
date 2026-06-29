import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEarningsWhispersStockUrl,
  parseEarningsWhispersCalendarPage,
} from '../lib/sources/earnings-whispers.js';

test('buildEarningsWhispersStockUrl uses the public stock page per ticker', () => {
  assert.equal(
    buildEarningsWhispersStockUrl('AAPL'),
    'https://www.earningswhispers.com/stocks/AAPL'
  );
});

test('parseEarningsWhispersCalendarPage parses expected dates as unconfirmed', () => {
  const html = `
    <html>
      <head>
        <meta property="og:description" content="Apple, Inc. ( AAPL) is expected to report earnings on Thursday, July 30, 2026. The stock is up 4.6% since its last earnings release." />
      </head>
    </html>
  `;

  assert.deepEqual(
    parseEarningsWhispersCalendarPage('AAPL', html),
    {
      ticker: 'AAPL',
      earnings_date: '2026-07-30',
      confirmed: false,
      source_status: 'active',
      source: 'earnings_whispers_html',
      details: {
        description: 'Apple, Inc. ( AAPL) is expected to report earnings on Thursday, July 30, 2026. The stock is up 4.6% since its last earnings release.',
        timing_word: 'expected',
      },
    }
  );
});

test('parseEarningsWhispersCalendarPage parses scheduled dates as confirmed', () => {
  const html = `
    <html>
      <head>
        <meta name="description" content="Dover Corp. ( DOV) is scheduled to report earnings on Thursday, July 23, 2026. The stock is up 4.5% since its last earnings release." />
      </head>
    </html>
  `;

  assert.deepEqual(
    parseEarningsWhispersCalendarPage('DOV', html),
    {
      ticker: 'DOV',
      earnings_date: '2026-07-23',
      confirmed: true,
      source_status: 'active',
      source: 'earnings_whispers_html',
      details: {
        description: 'Dover Corp. ( DOV) is scheduled to report earnings on Thursday, July 23, 2026. The stock is up 4.5% since its last earnings release.',
        timing_word: 'scheduled',
      },
    }
  );
});
