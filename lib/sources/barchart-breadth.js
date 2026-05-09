function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toNumeric(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const normalized = String(value).replace(/,/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ');
}

function extractJsonField(text, fieldName) {
  const quotedPattern = new RegExp(`"${fieldName}"\\s*:\\s*"([^"]+)"`, 'i');
  const quotedMatch = text.match(quotedPattern);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  const numericPattern = new RegExp(`"${fieldName}"\\s*:\\s*([-0-9.]+)`, 'i');
  const numericMatch = text.match(numericPattern);
  if (numericMatch) {
    return numericMatch[1];
  }

  return null;
}

export function parseBarchartBreadthPage({
  seriesKey,
  symbol,
  sourceUrl,
  snapshotDate,
  html,
}) {
  const escapedSymbol = escapeRegex(symbol);
  const blockPattern = new RegExp(`"currentSymbol"\\s*:\\s*\\{[^]*?"symbol"\\s*:\\s*"${escapedSymbol}"[^]*?\\}`, 'i');
  const blockMatch = html.match(blockPattern);
  const currentSymbolBlock = blockMatch?.[0] ?? '';
  const lastPriceRaw = extractJsonField(currentSymbolBlock, 'lastPrice')
    ?? stripTags(html).match(/Last Price\s+([0-9.,-]+)/i)?.[1]
    ?? null;

  const value = toNumeric(lastPriceRaw);
  if (value === null) {
    throw new Error(`Could not parse Barchart Last Price for ${seriesKey}`);
  }

  const parsedName = extractJsonField(currentSymbolBlock, 'symbolName');

  return {
    date: snapshotDate,
    series_key: seriesKey,
    symbol,
    name: parsedName || seriesKey,
    value,
    source: 'barchart',
    source_url: sourceUrl,
  };
}

export async function fetchBarchartBreadthSeries({
  seriesKey,
  symbol,
  sourceUrl,
  snapshotDate,
  fetchFn = fetch,
}) {
  const response = await fetchFn(sourceUrl, {
    headers: {
      'user-agent': 'stock-signals-indicators/0.1',
      accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`Barchart fetch failed for ${seriesKey}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return parseBarchartBreadthPage({
    seriesKey,
    symbol,
    sourceUrl,
    snapshotDate,
    html,
  });
}
