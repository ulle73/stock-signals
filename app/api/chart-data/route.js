import { NextResponse } from 'next/server';
import {
  normalizeChartPeriod,
  normalizeChartTicker,
} from '../../../lib/chart/chart-periods.js';
import { getChartData } from '../../../lib/repositories/chart-data.js';
import { buildDailyDataCacheHeaders } from '../../../lib/utils/daily-data-cache.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = normalizeChartTicker(searchParams.get('ticker'));
  const period = normalizeChartPeriod(searchParams.get('period'));

  if (!ticker) {
    return NextResponse.json(
      { error: 'Ogiltig ticker.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const payload = await getChartData({ ticker, period });
    return NextResponse.json(payload, { headers: buildDailyDataCacheHeaders() });
  } catch (error) {
    console.error('Chart data request failed:', error);
    return NextResponse.json(
      { error: 'Chartdatan kunde inte laddas.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
