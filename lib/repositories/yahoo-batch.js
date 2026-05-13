import { fetchYahooDailyCandles } from '../sources/yahoo.js';

export async function fetchYahooRowsInBatches(symbols, request, { batchSize = 4 } = {}) {
  const uniqueSymbols = [...new Set(symbols.filter(Boolean))];
  const rowsBySymbol = new Map();

  for (let index = 0; index < uniqueSymbols.length; index += batchSize) {
    const batch = uniqueSymbols.slice(index, index + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (symbol) => ({
        symbol,
        rows: await fetchYahooDailyCandles(symbol, request),
      }))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        rowsBySymbol.set(result.value.symbol, result.value.rows);
      }
    }
  }

  return rowsBySymbol;
}
