import { cleanTicker, toYahooTicker } from '../utils/tickers.js';

const WIKI_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies';

function stripTags(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .trim();
}

function extractCells(rowHtml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  return [...rowHtml.matchAll(regex)].map((match) => stripTags(match[1]));
}

export async function fetchSp500Constituents() {
  const response = await fetch(WIKI_URL, {
    headers: {
      'user-agent': 'stock-signals-data-foundation/0.1',
    },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia fetch failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const tableMatch = html.match(/<table[^>]*id="constituents"[^>]*>([\s\S]*?)<\/table>/i);

  if (!tableMatch) {
    throw new Error('Could not find S&P 500 constituents table on Wikipedia.');
  }

  const rows = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) => match[1]);
  const header = extractCells(rows[0] || '', 'th').map((cell) => cell.toLowerCase());

  const symbolIndex = header.findIndex((cell) => cell.includes('symbol'));
  const securityIndex = header.findIndex((cell) => cell.includes('security'));
  const sectorIndex = header.findIndex((cell) => cell.includes('gics sector'));
  const industryIndex = header.findIndex((cell) => cell.includes('gics sub-industry'));

  if (symbolIndex === -1 || securityIndex === -1) {
    throw new Error('Could not parse expected columns from Wikipedia constituents table.');
  }

  const constituents = [];

  for (const row of rows.slice(1)) {
    const cells = extractCells(row, 'td');
    if (!cells.length) continue;

    const ticker = cleanTicker(cells[symbolIndex]);
    if (!ticker) continue;

    constituents.push({
      ticker,
      yahoo_ticker: toYahooTicker(ticker),
      company_name: cells[securityIndex] || null,
      sector: sectorIndex >= 0 ? cells[sectorIndex] || null : null,
      industry: industryIndex >= 0 ? cells[industryIndex] || null : null,
    });
  }

  if (constituents.length < 400) {
    throw new Error(`Parsed too few S&P 500 constituents: ${constituents.length}`);
  }

  return constituents;
}
