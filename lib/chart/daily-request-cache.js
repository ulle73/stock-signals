export const DAILY_REQUEST_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function createDailyRequestCache({
  ttlMs = DAILY_REQUEST_CACHE_TTL_MS,
  now = () => Date.now(),
} = {}) {
  const entries = new Map();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return null;

      if (now() >= entry.expiresAt) {
        entries.delete(key);
        return null;
      }

      return entry.value;
    },
    set(key, value) {
      entries.set(key, {
        value,
        expiresAt: now() + ttlMs,
      });
      return value;
    },
  };
}
