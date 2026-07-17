import { NextResponse } from 'next/server';
import { normalizeChartTicker } from '../../../lib/chart/chart-periods.js';
import { getLatestGexDexStrikeSnapshot } from '../../../lib/repositories/gex-dex-chart-strikes.js';

export const dynamic = 'force-dynamic';

const CACHE_HEADERS = Object.freeze({
  'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800',
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = normalizeChartTicker(searchParams.get('ticker'));

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ogiltig ticker.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const payload = await getLatestGexDexStrikeSnapshot(ticker);
    return NextResponse.json(payload, { headers: CACHE_HEADERS });
  } catch (error) {
    console.error('GEX/DEX strike request failed:', error);
    return NextResponse.json(
      { error: 'Strike-datan kunde inte laddas.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
