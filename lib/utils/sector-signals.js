import { formatIndicatorValueForStorage } from './rolling-indicators.js';

const LOOKBACK_DAYS = 14;

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

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.sector.localeCompare(b.sector);
  });
}

function calculateAdNet(row) {
  return Number(row.advancers ?? 0) - Number(row.decliners ?? 0);
}

function calculateHighLowSpread(row) {
  return Number(row.new_highs_52w ?? 0) - Number(row.new_lows_52w ?? 0);
}

function calculateSectorRegimeScore(metrics) {
  let score = 0;

  if (metrics.pctAboveSma50 >= 60) {
    score += 1;
  } else if (metrics.pctAboveSma50 <= 40) {
    score -= 1;
  }

  if (metrics.pctAboveSma200 >= 60) {
    score += 1;
  } else if (metrics.pctAboveSma200 <= 40) {
    score -= 1;
  }

  if (metrics.pctAboveSma50Change >= 10) {
    score += 1;
  } else if (metrics.pctAboveSma50Change <= -10) {
    score -= 1;
  }

  if (metrics.adNet >= 15) {
    score += 1;
  } else if (metrics.adNet <= -15) {
    score -= 1;
  }

  if (metrics.highLowSpread >= 3) {
    score += 1;
  } else if (metrics.highLowSpread <= -3) {
    score -= 1;
  }

  return score;
}

function classifySectorSignal(metrics) {
  if (metrics.sectorRegimeScore >= 4 && metrics.pctAboveSma50Change > 0) {
    return {
      signal: 'leading',
      reasonSummary: 'strong_sector_breadth',
    };
  }

  if (metrics.sectorRegimeScore <= -4 && metrics.pctAboveSma50Change < 0) {
    return {
      signal: 'lagging',
      reasonSummary: 'broad_sector_weakness',
    };
  }

  if (metrics.pctAboveSma50Change >= 10 && metrics.adNet > 0 && metrics.sectorRegimeScore > 0) {
    return {
      signal: 'improving',
      reasonSummary: 'sector_breadth_improving',
    };
  }

  if (metrics.pctAboveSma50Change <= -10 && metrics.adNet < 0 && metrics.sectorRegimeScore < 0) {
    return {
      signal: 'weakening',
      reasonSummary: 'sector_breadth_weakening',
    };
  }

  return {
    signal: 'mixed',
    reasonSummary: 'mixed_sector_signals',
  };
}

function groupRowsBySector(rows) {
  const bySector = new Map();

  for (const row of sortRows(rows)) {
    if (!row.sector) {
      continue;
    }

    const sectorRows = bySector.get(row.sector) ?? [];
    sectorRows.push(row);
    bySector.set(row.sector, sectorRows);
  }

  return bySector;
}

export function buildSectorSignalRowsFromSources({ sectorBreadthRows }) {
  const bySector = groupRowsBySector(sectorBreadthRows);
  const signalRows = [];

  for (const [sector, rows] of bySector) {
    for (let index = LOOKBACK_DAYS; index < rows.length; index += 1) {
      const currentRow = rows[index];
      const lookbackRow = rows[index - LOOKBACK_DAYS];

      if (!currentRow.is_valid_signal_date || !lookbackRow.is_valid_signal_date) {
        continue;
      }

      const pctAboveSma50 = toNumber(currentRow.pct_above_sma50);
      const pctAboveSma200 = toNumber(currentRow.pct_above_sma200);
      const lookbackPctAboveSma50 = toNumber(lookbackRow.pct_above_sma50);
      const lookbackPctAboveSma200 = toNumber(lookbackRow.pct_above_sma200);

      if (
        pctAboveSma50 === null ||
        pctAboveSma200 === null ||
        lookbackPctAboveSma50 === null ||
        lookbackPctAboveSma200 === null
      ) {
        continue;
      }

      const adNet = calculateAdNet(currentRow);
      const lookbackAdNet = calculateAdNet(lookbackRow);
      const highLowSpread = calculateHighLowSpread(currentRow);
      const metrics = {
        pctAboveSma50,
        pctAboveSma200,
        pctAboveSma50Change: pctAboveSma50 - lookbackPctAboveSma50,
        pctAboveSma200Change: pctAboveSma200 - lookbackPctAboveSma200,
        adNet,
        adNetChange: adNet - lookbackAdNet,
        highLowSpread,
      };
      const sectorRegimeScore = calculateSectorRegimeScore(metrics);
      const classification = classifySectorSignal({
        ...metrics,
        sectorRegimeScore,
      });

      signalRows.push({
        date: currentRow.date,
        sector,
        active_ticker_count: Number(currentRow.active_ticker_count ?? 0),
        pct_above_sma50: normalizeNumber(pctAboveSma50),
        pct_above_sma50_14d_change: normalizeNumber(metrics.pctAboveSma50Change),
        pct_above_sma200: normalizeNumber(pctAboveSma200),
        pct_above_sma200_14d_change: normalizeNumber(metrics.pctAboveSma200Change),
        ad_net: adNet,
        ad_net_14d_change: normalizeNumber(metrics.adNetChange),
        new_highs_52w: Number(currentRow.new_highs_52w ?? 0),
        new_lows_52w: Number(currentRow.new_lows_52w ?? 0),
        sector_regime_score: sectorRegimeScore,
        signal: classification.signal,
        reason_summary: classification.reasonSummary,
      });
    }
  }

  return sortRows(signalRows);
}
