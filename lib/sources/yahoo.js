function toIsoDateFromUnixSeconds(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

export function buildYahooChartUrl(yahooTicker, request = { range: '400d' }) {
  const encodedTicker = encodeURIComponent(yahooTicker);
  const params = new URLSearchParams();

  if (request.period1 && request.period2) {
    params.set('period1', String(request.period1));
    params.set('period2', String(request.period2));
  } else {
    params.set('range', request.range || '400d');
  }

  params.set('interval', '1d');

  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodedTicker}?${params.toString()}`;
}

export async function fetchYahooDailyCandles(yahooTicker, request = { range: '400d' }) {
  const url = buildYahooChartUrl(yahooTicker, request);

  const response = await fetch(url, {
    headers: {
      'user-agent': 'stock-signals-data-foundation/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo fetch failed for ${yahooTicker}: ${response.status} ${response.statusText}`);
  }

  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const error = payload?.chart?.error;

  if (error) {
    throw new Error(`Yahoo returned error for ${yahooTicker}: ${error.description || JSON.stringify(error)}`);
  }

  if (!result?.timestamp?.length) {
    throw new Error(`Yahoo returned no timestamps for ${yahooTicker}`);
  }

  const quote = result.indicators?.quote?.[0];
  const adjClose = result.indicators?.adjclose?.[0]?.adjclose || [];

  if (!quote) {
    throw new Error(`Yahoo returned no quote data for ${yahooTicker}`);
  }

  return result.timestamp.map((timestamp, index) => ({
    date: toIsoDateFromUnixSeconds(timestamp),
    open: quote.open?.[index] ?? null,
    high: quote.high?.[index] ?? null,
    low: quote.low?.[index] ?? null,
    close: quote.close?.[index] ?? null,
    adj_close: adjClose[index] ?? null,
    volume: quote.volume?.[index] ?? null,
  })).filter((row) => row.close !== null);
}
