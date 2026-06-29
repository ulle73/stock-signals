import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildYahooQuotePageUrl,
  parseYahooEarningsCalendarFromQuotePage,
} from '../lib/sources/yahoo-earnings.js';

function buildQuotePageHtml(yahooTicker, earnings) {
  const body = JSON.stringify({
    quoteSummary: {
      result: [
        {
          calendarEvents: {
            earnings,
          },
        },
      ],
    },
  });

  const scriptPayload = JSON.stringify({
    status: 200,
    statusText: 'OK',
    headers: {},
    body,
  });

  return `<script type="application/json" data-sveltekit-fetched data-url="https://query1.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?formatted=true&amp;modules=calendarEvents">${scriptPayload}</script>`;
}

test('buildYahooQuotePageUrl points at the Yahoo quote page used for embedded calendar data', () => {
  assert.equal(
    buildYahooQuotePageUrl('AAPL'),
    'https://finance.yahoo.com/quote/AAPL/'
  );
});

test('parseYahooEarningsCalendarFromQuotePage extracts the earliest earnings date and confirmation state', () => {
  const result = parseYahooEarningsCalendarFromQuotePage(
    'AAPL',
    buildQuotePageHtml('AAPL', {
      earningsDate: [
        { raw: 1785528000, fmt: '2026-07-31' },
        { raw: 1785441600, fmt: '2026-07-30' },
      ],
      isEarningsDateEstimate: true,
    })
  );

  assert.deepEqual(result, {
    yahoo_ticker: 'AAPL',
    earnings_date: '2026-07-30',
    confirmed: false,
    source_status: 'active',
    details: {
      is_earnings_date_estimate: true,
      raw_earnings_dates: [
        { raw: 1785528000, fmt: '2026-07-31' },
        { raw: 1785441600, fmt: '2026-07-30' },
      ],
    },
  });
});

test('parseYahooEarningsCalendarFromQuotePage marks rows missing when Yahoo exposes no upcoming earnings date', () => {
  const result = parseYahooEarningsCalendarFromQuotePage(
    'MSFT',
    buildQuotePageHtml('MSFT', {
      earningsDate: [],
      isEarningsDateEstimate: null,
    })
  );

  assert.deepEqual(result, {
    yahoo_ticker: 'MSFT',
    earnings_date: null,
    confirmed: null,
    source_status: 'missing',
    details: {
      is_earnings_date_estimate: null,
      raw_earnings_dates: [],
    },
  });
});
