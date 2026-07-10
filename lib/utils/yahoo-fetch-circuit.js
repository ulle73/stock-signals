export function isYahooRateLimitError(error) {
  return error?.code === 'YAHOO_RATE_LIMIT';
}

export function createYahooFetchCircuit() {
  let error = null;
  let suppressedCount = 0;

  return {
    get error() {
      return error;
    },
    get suppressedCount() {
      return suppressedCount;
    },
    isOpen() {
      return error !== null;
    },
    open(nextError) {
      if (!error && isYahooRateLimitError(nextError)) {
        error = nextError;
      }
    },
    recordSuppressed(count = 1) {
      suppressedCount += count;
    },
  };
}

export async function runWithYahooFetchCircuit(items, {
  concurrency = 1,
  circuit = createYahooFetchCircuit(),
  worker,
} = {}) {
  const results = [];
  let index = 0;

  async function next() {
    if (circuit.isOpen()) return;

    const currentIndex = index;
    index += 1;
    if (currentIndex >= items.length) return;

    try {
      results[currentIndex] = {
        status: 'fulfilled',
        value: await worker(items[currentIndex], currentIndex),
      };
    } catch (error) {
      results[currentIndex] = { status: 'rejected', reason: error };
      circuit.open(error);
    }

    await next();
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length);
  await Promise.all(Array.from({ length: workerCount }, () => next()));

  const completedCount = results.filter(Boolean).length;
  circuit.recordSuppressed(items.length - completedCount);

  return {
    results,
    suppressedCount: circuit.suppressedCount,
  };
}
