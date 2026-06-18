import { NextResponse } from 'next/server';
import { getStockSignalBoardPage, getStockSignalBoardSummary } from '../../../lib/repositories/stock-signal-board.js';
import { getLatestTickerMarkovRows } from '../../../lib/repositories/ticker-markov.js';
import { getTickerSparklinesForTickers } from '../../../lib/repositories/ticker-sparklines.js';
import { buildStockSignalBoardViewModel } from '../../../lib/utils/stock-signal-board-view.js';

export const dynamic = 'force-dynamic';
const TICKER_MARKOV_RANKING_LIMIT = 20;
const BOARD_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sparklineTone(returnPct) {
  if (returnPct > 0) return 'positive';
  if (returnPct < 0) return 'danger';
  return 'neutral';
}

function normalizeSparklinePayload(value) {
  if (!value?.path) {
    return null;
  }

  const returnPct = toNumber(value.returnPct);

  return {
    path: value.path,
    returnPct,
    tone: sparklineTone(returnPct),
    asOfDate: value.asOfDate ?? null,
    days: Number(value.days ?? 50),
    closeFirst: toNumber(value.closeFirst),
    closeLast: toNumber(value.closeLast),
    minClose: toNumber(value.minClose),
    maxClose: toNumber(value.maxClose),
    markers: Array.isArray(value.markers) ? value.markers : [],
  };
}

function attachSparklines(viewModel, sparklineByTicker) {
  return {
    ...viewModel,
    rows: viewModel.rows.map((row) => ({
      ...row,
      sparkline50d: normalizeSparklinePayload(sparklineByTicker.get(row.ticker)),
    })),
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '20');
  const offset = Number(searchParams.get('offset') ?? '0');
  const [summary, rows, topTickerMarkovBull, topTickerMarkovSell] = await Promise.all([
    getStockSignalBoardSummary(),
    getStockSignalBoardPage({ limit, offset }),
    getLatestTickerMarkovRows({ limit: TICKER_MARKOV_RANKING_LIMIT, side: 'bull' }),
    getLatestTickerMarkovRows({ limit: TICKER_MARKOV_RANKING_LIMIT, side: 'sell' }),
  ]);
  const sparklineByTicker = await getTickerSparklinesForTickers(rows.map((row) => row.ticker));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const totalRows = Number(summary?.totalTickers ?? 0);
  const visibleCount = rows.length;
  const nextOffset = safeOffset + visibleCount;
  const hasMore = nextOffset < totalRows;
  const viewModel = attachSparklines(buildStockSignalBoardViewModel(rows, {
    summary: {
      ...summary,
      topTickerMarkovBull,
      topTickerMarkovSell,
    },
    pagination: {
      offset: safeOffset,
      limit: safeLimit,
      visibleCount,
      totalRows,
      hasMore,
      nextOffset,
    },
  }), sparklineByTicker);

  return NextResponse.json(viewModel, {
    headers: {
      'Cache-Control': BOARD_CACHE_CONTROL,
    },
  });
}
