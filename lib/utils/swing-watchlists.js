import { formatIndicatorValueForStorage } from './rolling-indicators.js';

const DEFAULT_MAX_PER_BIAS = 8;
const MIN_WATCHLIST_SCORE = 7;

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeNumber(value) {
  const number = toNumber(value);
  if (number === null) {
    return null;
  }

  return Number(formatIndicatorValueForStorage(number));
}

function buildSectorSignalMap(rows) {
  return new Map(rows.map((row) => [`${row.date}__${row.sector}`, row]));
}

function buildSwingSignalMap(rows) {
  return new Map(rows.map((row) => [row.date, row]));
}

function sortCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (b.watchlist_score !== a.watchlist_score) {
      return b.watchlist_score - a.watchlist_score;
    }

    const volumeCompare = (toNumber(b.relative_volume20) ?? 0) - (toNumber(a.relative_volume20) ?? 0);
    if (volumeCompare !== 0) {
      return volumeCompare;
    }

    return a.ticker.localeCompare(b.ticker);
  });
}

function calculateDistancePercent(price, baseline) {
  if (baseline === null || baseline === 0) {
    return null;
  }

  return normalizeNumber(((price / baseline) - 1) * 100);
}

function getLongSectorBaseScore(signal) {
  if (signal === 'leading') {
    return 2;
  }

  if (signal === 'improving') {
    return 1;
  }

  return null;
}

function getShortSectorBaseScore(signal) {
  if (signal === 'lagging') {
    return 2;
  }

  if (signal === 'weakening') {
    return 1;
  }

  return null;
}

function derivePlaybook(bias, swingDecision) {
  if (bias === 'long') {
    if (swingDecision === 'KÖP STARKA SEKTORER') {
      return { playbook: 'deploy_long', isActionable: true };
    }

    if (swingDecision === 'BEHÅLL LONGS') {
      return { playbook: 'manage_existing_longs', isActionable: true };
    }

    if (swingDecision === 'LONG WATCHLIST') {
      return { playbook: 'build_long_watchlist', isActionable: false };
    }

    if (swingDecision === 'MINSKA RISK') {
      return { playbook: 'defensive_watch', isActionable: false };
    }

    if (swingDecision === 'GÅ TILL CASH') {
      return { playbook: 'cash_only', isActionable: false };
    }

    return { playbook: 'standby_long', isActionable: false };
  }

  if (swingDecision === 'MINSKA RISK') {
    return { playbook: 'hedge_watch', isActionable: false };
  }

  if (swingDecision === 'SHORT WATCHLIST') {
    return { playbook: 'build_short_watchlist', isActionable: false };
  }

  if (swingDecision === 'GÅ TILL CASH') {
    return { playbook: 'crisis_watch', isActionable: false };
  }

  return { playbook: 'standby_short', isActionable: false };
}

function buildLongCandidate(row, sectorSignal, swingSignal) {
  const price = toNumber(row.indicator_price);
  const sma50 = toNumber(row.sma50);
  const sma200 = toNumber(row.sma200);
  const dailyReturn = toNumber(row.daily_return_pct);
  const relativeVolume20 = toNumber(row.relative_volume20);
  const pctFrom52wHigh = toNumber(row.pct_from_52w_high);
  const pctFrom52wLow = toNumber(row.pct_from_52w_low);
  const sectorBase = getLongSectorBaseScore(sectorSignal.signal);

  if (
    price === null ||
    sma50 === null ||
    sma200 === null ||
    dailyReturn === null ||
    relativeVolume20 === null ||
    pctFrom52wHigh === null ||
    pctFrom52wLow === null ||
    sectorBase === null
  ) {
    return null;
  }

  const watchlistScore =
    sectorBase +
    (price > sma50 ? 2 : 0) +
    (price > sma200 ? 2 : 0) +
    (pctFrom52wHigh >= -10 ? 1 : 0) +
    (dailyReturn > 0 ? 1 : 0) +
    (relativeVolume20 >= 1 ? 1 : 0);

  if (watchlistScore < MIN_WATCHLIST_SCORE) {
    return null;
  }

  const playbook = derivePlaybook('long', swingSignal.decision);

  return {
    date: row.date,
    bias: 'long',
    ticker: row.ticker,
    sector: row.sector,
    sector_signal: sectorSignal.signal,
    swing_setup: swingSignal.setup,
    swing_decision: swingSignal.decision,
    playbook: playbook.playbook,
    is_actionable: playbook.isActionable,
    watchlist_score: watchlistScore,
    indicator_price: normalizeNumber(price),
    daily_return_pct: normalizeNumber(dailyReturn),
    relative_volume20: normalizeNumber(relativeVolume20),
    pct_from_52w_high: normalizeNumber(pctFrom52wHigh),
    pct_from_52w_low: normalizeNumber(pctFrom52wLow),
    distance_from_sma50_pct: calculateDistancePercent(price, sma50),
    distance_from_sma200_pct: calculateDistancePercent(price, sma200),
    reason_summary: sectorSignal.signal === 'leading'
      ? 'leading_sector_momentum'
      : 'improving_sector_momentum',
  };
}

function buildShortCandidate(row, sectorSignal, swingSignal) {
  const price = toNumber(row.indicator_price);
  const sma50 = toNumber(row.sma50);
  const sma200 = toNumber(row.sma200);
  const dailyReturn = toNumber(row.daily_return_pct);
  const relativeVolume20 = toNumber(row.relative_volume20);
  const pctFrom52wHigh = toNumber(row.pct_from_52w_high);
  const pctFrom52wLow = toNumber(row.pct_from_52w_low);
  const sectorBase = getShortSectorBaseScore(sectorSignal.signal);

  if (
    price === null ||
    sma50 === null ||
    sma200 === null ||
    dailyReturn === null ||
    relativeVolume20 === null ||
    pctFrom52wHigh === null ||
    pctFrom52wLow === null ||
    sectorBase === null
  ) {
    return null;
  }

  const watchlistScore =
    sectorBase +
    (price < sma50 ? 2 : 0) +
    (price < sma200 ? 2 : 0) +
    (pctFrom52wLow <= 15 ? 1 : 0) +
    (dailyReturn < 0 ? 1 : 0) +
    (relativeVolume20 >= 1 ? 1 : 0);

  if (watchlistScore < MIN_WATCHLIST_SCORE) {
    return null;
  }

  const playbook = derivePlaybook('short', swingSignal.decision);

  return {
    date: row.date,
    bias: 'short',
    ticker: row.ticker,
    sector: row.sector,
    sector_signal: sectorSignal.signal,
    swing_setup: swingSignal.setup,
    swing_decision: swingSignal.decision,
    playbook: playbook.playbook,
    is_actionable: playbook.isActionable,
    watchlist_score: watchlistScore,
    indicator_price: normalizeNumber(price),
    daily_return_pct: normalizeNumber(dailyReturn),
    relative_volume20: normalizeNumber(relativeVolume20),
    pct_from_52w_high: normalizeNumber(pctFrom52wHigh),
    pct_from_52w_low: normalizeNumber(pctFrom52wLow),
    distance_from_sma50_pct: calculateDistancePercent(price, sma50),
    distance_from_sma200_pct: calculateDistancePercent(price, sma200),
    reason_summary: sectorSignal.signal === 'lagging'
      ? 'lagging_sector_breakdown'
      : 'weakening_sector_breakdown',
  };
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const biasCompare = a.bias.localeCompare(b.bias);
    if (biasCompare !== 0) {
      return biasCompare;
    }

    return a.rank_in_bias - b.rank_in_bias;
  });
}

export function buildSwingWatchlistRowsFromSources(
  { indicatorRows, sectorSignalRows, swingSignalRows },
  { maxPerBias = DEFAULT_MAX_PER_BIAS } = {}
) {
  const sectorSignalByDateSector = buildSectorSignalMap(sectorSignalRows);
  const swingSignalByDate = buildSwingSignalMap(swingSignalRows);
  const candidatesByDate = new Map();

  for (const row of indicatorRows) {
    if (!row.sector) {
      continue;
    }

    const sectorSignal = sectorSignalByDateSector.get(`${row.date}__${row.sector}`);
    const swingSignal = swingSignalByDate.get(row.date);

    if (!sectorSignal || !swingSignal) {
      continue;
    }

    const bucket = candidatesByDate.get(row.date) ?? { long: [], short: [] };
    candidatesByDate.set(row.date, bucket);

    const longCandidate = buildLongCandidate(row, sectorSignal, swingSignal);
    if (longCandidate) {
      bucket.long.push(longCandidate);
    }

    const shortCandidate = buildShortCandidate(row, sectorSignal, swingSignal);
    if (shortCandidate) {
      bucket.short.push(shortCandidate);
    }
  }

  const rows = [];

  for (const [date, bucket] of candidatesByDate) {
    for (const [bias, candidates] of Object.entries(bucket)) {
      const rankedCandidates = sortCandidates(candidates).slice(0, maxPerBias);

      rankedCandidates.forEach((candidate, index) => {
        rows.push({
          date,
          bias,
          rank_in_bias: index + 1,
          ...candidate,
        });
      });
    }
  }

  return sortRows(rows);
}
