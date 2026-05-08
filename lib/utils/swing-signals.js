import { formatIndicatorValueForStorage } from './rolling-indicators.js';

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
  return [...rows].sort((a, b) => a.date.localeCompare(b.date));
}

function buildSectorSummaryByDate(rows) {
  const byDate = new Map();

  for (const row of rows) {
    const summary = byDate.get(row.date) ?? {
      date: row.date,
      active_sector_count: 0,
      leading_sector_count: 0,
      improving_sector_count: 0,
      weakening_sector_count: 0,
      lagging_sector_count: 0,
      mixed_sector_count: 0,
    };

    summary.active_sector_count += 1;

    if (row.signal === 'leading') {
      summary.leading_sector_count += 1;
    } else if (row.signal === 'improving') {
      summary.improving_sector_count += 1;
    } else if (row.signal === 'weakening') {
      summary.weakening_sector_count += 1;
    } else if (row.signal === 'lagging') {
      summary.lagging_sector_count += 1;
    } else {
      summary.mixed_sector_count += 1;
    }

    byDate.set(row.date, summary);
  }

  return byDate;
}

function getLeadershipThreshold(activeSectorCount) {
  return Math.max(2, Math.ceil(activeSectorCount * 0.25));
}

function getRiskOffThreshold(activeSectorCount) {
  return Math.max(3, Math.ceil(activeSectorCount * 0.33));
}

function classifySetup(summary, marketSignal) {
  const leadershipThreshold = getLeadershipThreshold(summary.active_sector_count);
  const riskOffThreshold = getRiskOffThreshold(summary.active_sector_count);

  if (marketSignal.signal === 'risk_off' || summary.lagging_sector_count >= riskOffThreshold) {
    return {
      setup: 'risk_off',
      reasonSummary: 'broad_sector_breakdown',
    };
  }

  if (marketSignal.signal === 'risk_on' && summary.leading_sector_count >= leadershipThreshold) {
    return {
      setup: 'bullish',
      reasonSummary: 'sector_leadership_expanding',
    };
  }

  if (summary.weakening_sector_count >= leadershipThreshold) {
    return {
      setup: 'weakening',
      reasonSummary: 'sector_rotation_weakening',
    };
  }

  if (summary.lagging_sector_count >= leadershipThreshold && marketSignal.signal !== 'risk_on') {
    return {
      setup: 'bearish_watch',
      reasonSummary: 'sector_short_watch',
    };
  }

  if (summary.improving_sector_count >= leadershipThreshold && marketSignal.signal !== 'risk_off') {
    return {
      setup: 'improving',
      reasonSummary: 'sector_rotation_improving',
    };
  }

  return {
    setup: 'neutral',
    reasonSummary: 'mixed_sector_rotation',
  };
}

function applyDecision(previousState, setup) {
  if (setup.setup === 'bullish') {
    if (previousState === 'long') {
      return {
        decision: 'BEHÅLL LONGS',
        targetState: 'long',
      };
    }

    if (previousState === 'short_watchlist') {
      return {
        decision: 'LONG WATCHLIST',
        targetState: 'long_watchlist',
      };
    }

    return {
      decision: 'KÖP STARKA SEKTORER',
      targetState: 'long',
    };
  }

  if (setup.setup === 'improving') {
    if (previousState === 'long') {
      return {
        decision: 'BEHÅLL LONGS',
        targetState: 'long',
      };
    }

    return {
      decision: 'LONG WATCHLIST',
      targetState: 'long_watchlist',
    };
  }

  if (setup.setup === 'weakening') {
    if (previousState === 'long') {
      return {
        decision: 'MINSKA RISK',
        targetState: 'cash',
      };
    }

    return {
      decision: 'SITT STILL',
      targetState: previousState,
    };
  }

  if (setup.setup === 'bearish_watch') {
    if (previousState === 'long') {
      return {
        decision: 'MINSKA RISK',
        targetState: 'cash',
      };
    }

    return {
      decision: 'SHORT WATCHLIST',
      targetState: 'short_watchlist',
    };
  }

  if (setup.setup === 'risk_off') {
    if (previousState === 'long') {
      return {
        decision: 'GÅ TILL CASH',
        targetState: 'cash',
      };
    }

    return {
      decision: 'SITT STILL',
      targetState: previousState,
    };
  }

  if (previousState === 'long') {
    return {
      decision: 'BEHÅLL LONGS',
      targetState: 'long',
    };
  }

  return {
    decision: 'SITT STILL',
    targetState: previousState,
  };
}

export function buildSwingSignalRowsFromSources({ sectorSignalRows, marketSignalRows }) {
  const sectorSummaryByDate = buildSectorSummaryByDate(sectorSignalRows);
  const swingRows = [];
  let previousState = 'cash';

  for (const marketSignal of sortRows(marketSignalRows)) {
    const sectorSummary = sectorSummaryByDate.get(marketSignal.date);

    if (!sectorSummary) {
      continue;
    }

    const setup = classifySetup(sectorSummary, marketSignal);
    const action = applyDecision(previousState, setup);

    swingRows.push({
      date: marketSignal.date,
      setup: setup.setup,
      decision: action.decision,
      previous_state: previousState,
      target_state: action.targetState,
      active_sector_count: sectorSummary.active_sector_count,
      leading_sector_count: sectorSummary.leading_sector_count,
      improving_sector_count: sectorSummary.improving_sector_count,
      weakening_sector_count: sectorSummary.weakening_sector_count,
      lagging_sector_count: sectorSummary.lagging_sector_count,
      mixed_sector_count: sectorSummary.mixed_sector_count,
      market_signal: marketSignal.signal,
      market_regime_score: normalizeNumber(marketSignal.market_regime_score),
      reason_summary: setup.reasonSummary,
    });

    previousState = action.targetState;
  }

  return swingRows;
}
