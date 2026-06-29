function toIsoDateFromUnixSeconds(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', '\'')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function parseFetchedScriptEntries(html) {
  return Array.from(
    html.matchAll(
      /<script[^>]+type="application\/json"[^>]+data-sveltekit-fetched[^>]+data-url="([^"]+)"[^>]*>([\s\S]*?)<\/script>/gi
    )
  ).map((match) => ({
    dataUrl: decodeHtmlEntities(match[1]),
    payload: match[2],
  }));
}

function pickEarliestEarningsDate(earningsDates) {
  if (!Array.isArray(earningsDates) || earningsDates.length === 0) {
    return null;
  }

  const candidates = earningsDates
    .map((entry) => {
      if (Number.isFinite(entry?.raw)) {
        return toIsoDateFromUnixSeconds(entry.raw);
      }

      if (typeof entry?.fmt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.fmt)) {
        return entry.fmt;
      }

      return null;
    })
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  return candidates[0] ?? null;
}

export function buildYahooQuotePageUrl(yahooTicker) {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(yahooTicker)}/`;
}

export function extractYahooQuoteSummaryPayload(yahooTicker, html) {
  const quoteSummaryPath = `/quoteSummary/${encodeURIComponent(yahooTicker)}?`;

  for (const entry of parseFetchedScriptEntries(html)) {
    if (!entry.dataUrl.includes(quoteSummaryPath) || !entry.dataUrl.includes('calendarEvents')) {
      continue;
    }

    const outerPayload = JSON.parse(entry.payload);

    if (outerPayload?.status !== 200 || typeof outerPayload?.body !== 'string') {
      throw new Error(`Yahoo quote payload missing body for ${yahooTicker}`);
    }

    return JSON.parse(outerPayload.body);
  }

  throw new Error(`Yahoo quote page did not expose calendarEvents payload for ${yahooTicker}`);
}

export function parseYahooEarningsCalendarFromQuotePage(yahooTicker, html) {
  const quoteSummaryPayload = extractYahooQuoteSummaryPayload(yahooTicker, html);
  const calendarEvents = quoteSummaryPayload?.quoteSummary?.result?.[0]?.calendarEvents ?? null;
  const earnings = calendarEvents?.earnings ?? null;
  const earningsDate = pickEarliestEarningsDate(earnings?.earningsDate ?? []);
  const isEstimate = earnings?.isEarningsDateEstimate ?? null;
  const confirmed = typeof isEstimate === 'boolean' ? !isEstimate : null;

  return {
    yahoo_ticker: yahooTicker,
    earnings_date: earningsDate,
    confirmed,
    source_status: earningsDate ? 'active' : 'missing',
    details: {
      is_earnings_date_estimate: isEstimate,
      raw_earnings_dates: Array.isArray(earnings?.earningsDate)
        ? earnings.earningsDate.map((entry) => ({
          raw: Number.isFinite(entry?.raw) ? entry.raw : null,
          fmt: typeof entry?.fmt === 'string' ? entry.fmt : null,
        }))
        : [],
    },
  };
}

export async function fetchYahooEarningsCalendar(yahooTicker) {
  const sourceUrl = buildYahooQuotePageUrl(yahooTicker);
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'stock-signals-data-foundation/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo earnings fetch failed for ${yahooTicker}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return {
    ...parseYahooEarningsCalendarFromQuotePage(yahooTicker, html),
    source_url: sourceUrl,
  };
}
