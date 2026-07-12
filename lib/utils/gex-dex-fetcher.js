export async function fetchAndStoreGexDexSnapshots({
  tickers,
  fetchSnapshot,
  storeSnapshot,
}) {
  const failedItems = [];
  const snapshotIds = [];

  for (const ticker of tickers) {
    try {
      const { snapshot, strikes } = await fetchSnapshot(ticker);
      const snapshotId = await storeSnapshot(snapshot, strikes);
      snapshotIds.push({ ticker, snapshotId });
    } catch (error) {
      failedItems.push({ ticker, error: error.message });
    }
  }

  return {
    successfulItems: snapshotIds.length,
    failedItems,
    snapshotIds,
  };
}
