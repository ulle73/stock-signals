const DAILY_DATA_CACHE_CONTROL = 'public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400';

export function buildDailyDataCacheHeaders() {
  return {
    'Cache-Control': DAILY_DATA_CACHE_CONTROL,
    'CDN-Cache-Control': DAILY_DATA_CACHE_CONTROL,
    'Vercel-CDN-Cache-Control': DAILY_DATA_CACHE_CONTROL,
  };
}
