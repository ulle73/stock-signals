import { NextResponse } from 'next/server';
import { getStockSignalBoardPage, getStockSignalBoardSummary } from '../../../lib/repositories/stock-signal-board.js';
import { getLatestTickerMarkovRows } from '../../../lib/repositories/ticker-markov.js';
import { getTickerSparklinesForTickers } from '../../../lib/repositories/ticker-sparklines.js';
import { buildStockSignalBoardViewModel } from '../../../lib/utils/stock-signal-board-view.js';

export const dynamic = 'force-dynamic';
const TICKER_MARKOV_RANKING_LIMIT = 20;
const STOCKHOLM_TIME_ZONE = 'Europe/Stockholm';
const BROWSER_CACHE_SECONDS = 300;
const STALE_WHILE_REVALIDATE_SECONDS = 3600;

function getTimeZoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
  }).formatToParts(date);
  const timeZoneName = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT+0';
  const match = timeZoneName.match(/^GMT(?<sign>[+-])(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?$/);

  if (!match?.groups) {
    return 0;
  }

  const sign = match.groups.sign === '-' ? -1 : 1;
  const hours = Number(match.groups.hours ?? 0);
  const minutes = Number(match.groups.minutes ?? 0);
  return sign * ((hours * 60) + minutes);
}

function getDatePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  return Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
}

function stockholmDateTimeToUtcMs({ year, month, day, hour, minute = 0, second = 0 }) {
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const offsetMinutes = getTimeZoneOffsetMinutes(new Date(naiveUtcMs), STOCKHOLM_TIME_ZONE);
  return naiveUtcMs - (offsetMinutes * 60 * 1000);
}

function addDaysToDateParts({ year, month, day }, days) {
  const nextDate = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  return {
    year: nextDate.getUTCFullYear(),
    month: nextDate.getUTCMonth() + 1,
    day: nextDate.getUTCDate(),
  };
}

function secondsUntilNextStockholmSix(now = new Date()) {
  const stockholmNow = getDatePartsInTimeZone(now, STOCKHOLM_TIME_ZONE);
  const targetDate = stockholmNow.hour >= 6
    ? addDaysToDateParts(stockholmNow, 1)
    : stockholmNow;
  const targetUtcMs = stockholmDateTimeToUtcMs({
    ...targetDate,
    hour: 6,
    minute: 0,
    second: 0,
  });
  const seconds = Math.ceil((targetUtcMs - now.getTime()) / 1000);

  return Math.max(60, seconds);
}

function buildBoardCacheHeaders(now = new Date()) {
  const cdnCacheSeconds = secondsUntilNextStockholmSix(now);
  const cdnCacheControl = `public, s-maxage=${cdnCacheSeconds}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;

  return {
    'Cache-Control': `public, max-age=${BROWSER_CACHE_SECONDS}, must-revalidate`,
    'CDN-Cache-Control': cdnCacheControl,
    'Vercel-CDN-Cache-Control': cdnCacheControl,
  };
}

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
    tfSyncMarkers: Array.isArray(value.tfSyncMarkers) ? value.tfSyncMarkers : [],
    obvPanel: value.obvPanel ?? null,
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
    headers: buildBoardCacheHeaders(),
  });
}
