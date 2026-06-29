const DESCRIPTION_PATTERN = /is (expected|scheduled) to report earnings on ([A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},\s+\d{4})/i;

function toIsoDate(datePhrase) {
  const parsed = new Date(`${datePhrase} UTC`);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Could not parse EarningsWhispers date phrase: ${datePhrase}`);
  }

  return parsed.toISOString().slice(0, 10);
}

function extractMetaDescription(html) {
  const match =
    html.match(/<meta property="og:description" content="([^"]+)"/i)
    ?? html.match(/<meta name="description" content="([^"]+)"/i);

  return match?.[1] ?? null;
}

export function buildEarningsWhispersStockUrl(ticker) {
  return `https://www.earningswhispers.com/stocks/${encodeURIComponent(ticker)}`;
}

export function parseEarningsWhispersCalendarPage(ticker, html) {
  const description = extractMetaDescription(html);

  if (!description) {
    throw new Error(`EarningsWhispers page missing description for ${ticker}`);
  }

  const match = description.match(DESCRIPTION_PATTERN);

  if (!match) {
    return {
      ticker,
      earnings_date: null,
      confirmed: null,
      source_status: 'missing',
      source: 'earnings_whispers_html',
      details: {
        description,
      },
    };
  }

  const timingWord = match[1].toLowerCase();
  const datePhrase = match[2];

  return {
    ticker,
    earnings_date: toIsoDate(datePhrase),
    confirmed: timingWord === 'scheduled',
    source_status: 'active',
    source: 'earnings_whispers_html',
    details: {
      description,
      timing_word: timingWord,
    },
  };
}

export async function fetchEarningsWhispersCalendar(ticker) {
  const sourceUrl = buildEarningsWhispersStockUrl(ticker);
  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'stock-signals-data-foundation/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`EarningsWhispers fetch failed for ${ticker}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();

  return {
    ...parseEarningsWhispersCalendarPage(ticker, html),
    source_url: sourceUrl,
  };
}
