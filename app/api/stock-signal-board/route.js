import { NextResponse } from 'next/server';
import { getStockSignalBoardPage, getStockSignalBoardSummary } from '../../../lib/repositories/stock-signal-board.js';
import { getLatestTickerMarkovRows } from '../../../lib/repositories/ticker-markov.js';
import { buildStockSignalBoardViewModel } from '../../../lib/utils/stock-signal-board-view.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get('limit') ?? '20');
  const offset = Number(searchParams.get('offset') ?? '0');
  const [summary, rows, topTickerMarkovBull, topTickerMarkovSell] = await Promise.all([
    getStockSignalBoardSummary(),
    getStockSignalBoardPage({ limit, offset }),
    getLatestTickerMarkovRows({ limit: 10, side: 'bull' }),
    getLatestTickerMarkovRows({ limit: 10, side: 'sell' }),
  ]);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const totalRows = Number(summary?.totalTickers ?? 0);
  const visibleCount = rows.length;
  const nextOffset = safeOffset + visibleCount;
  const hasMore = nextOffset < totalRows;
  const viewModel = buildStockSignalBoardViewModel(rows, {
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
  });

  return NextResponse.json(viewModel);
}