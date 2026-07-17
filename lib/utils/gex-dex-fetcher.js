function normalizeConcurrency(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.min(Math.trunc(parsed), 10);
}

export async function fetchAndStoreGexDexSnapshots({
  tickers,
  fetchSnapshot,
  storeSnapshot,
  concurrency = 1,
}) {
  const failedItems = [];
  const snapshotIds = [];
  const batchSize = normalizeConcurrency(concurrency);

  for (let index = 0; index < tickers.length; index += batchSize) {
    const batch = tickers.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (ticker) => {
        try {
          const { snapshot, strikes } = await fetchSnapshot(ticker);
          const snapshotId = await storeSnapshot(snapshot, strikes);
          return { ok: true, ticker, snapshotId };
        } catch (error) {
          return {
            ok: false,
            ticker,
            error: error?.message ?? String(error),
          };
        }
      })
    );

    for (const result of results) {
      if (result.ok) {
        snapshotIds.push({ ticker: result.ticker, snapshotId: result.snapshotId });
      } else {
        failedItems.push({ ticker: result.ticker, error: result.error });
      }
    }
  }

  return {
    successfulItems: snapshotIds.length,
    failedItems,
    snapshotIds,
  };
}
