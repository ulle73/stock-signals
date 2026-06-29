import { countUsEquityMarketDaysBetween } from './us-market-calendar.js';

const PASS = 'pass';
const WARN = 'warn';
const BLOCK = 'block';

const FULL_COVERAGE_THRESHOLD = 1;
const CORE_COVERAGE_WARN_THRESHOLD = 0.95;
const INTRADAY_COVERAGE_PASS_THRESHOLD = 0.95;
const INTRADAY_COVERAGE_WARN_THRESHOLD = 0.8;
const EXTERNAL_SOURCE_WARN_STALE_DAYS = 1;

function toNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toCoverageRatio(observedCount, expectedCount) {
  const observed = toNumber(observedCount);
  const expected = toNumber(expectedCount);

  if (expected <= 0) {
    return null;
  }

  return observed / expected;
}

function toCoveragePercent(ratio) {
  if (ratio === null) {
    return null;
  }

  return Number((ratio * 100).toFixed(2));
}

function createGateRow({
  date,
  gate_key,
  status,
  reason_code,
  summary,
  details = {},
}) {
  return {
    date,
    gate_key,
    status,
    reason_code,
    summary,
    details,
  };
}

function getStaleMarketDays(latestDate, expectedDate) {
  if (!latestDate || !expectedDate || latestDate >= expectedDate) {
    return 0;
  }

  return countUsEquityMarketDaysBetween(latestDate, expectedDate);
}

function buildCoreFreshnessGate({
  date,
  gateKey,
  label,
  latestDate,
  expectedDate,
}) {
  if (!latestDate) {
    return createGateRow({
      date,
      gate_key: gateKey,
      status: BLOCK,
      reason_code: 'missing',
      summary: `${label} have no stored rows yet.`,
      details: {
        expected_date: expectedDate,
        latest_date: null,
        stale_by_market_days: null,
      },
    });
  }

  if (latestDate >= expectedDate) {
    return createGateRow({
      date,
      gate_key: gateKey,
      status: PASS,
      reason_code: 'current',
      summary: `${label} are current for ${expectedDate}.`,
      details: {
        expected_date: expectedDate,
        latest_date: latestDate,
        stale_by_market_days: 0,
      },
    });
  }

  const staleByMarketDays = getStaleMarketDays(latestDate, expectedDate);

  return createGateRow({
    date,
    gate_key: gateKey,
    status: BLOCK,
    reason_code: 'stale',
    summary: `${label} are stale by ${staleByMarketDays} US market day${staleByMarketDays === 1 ? '' : 's'} for expected date ${expectedDate}.`,
    details: {
      expected_date: expectedDate,
      latest_date: latestDate,
      stale_by_market_days: staleByMarketDays,
    },
  });
}

function buildCoverageGate({
  date,
  gateKey,
  label,
  observedCount,
  expectedCount,
  passCoverageThreshold = FULL_COVERAGE_THRESHOLD,
  warnCoverageThreshold = CORE_COVERAGE_WARN_THRESHOLD,
  details = {},
}) {
  const observed = toNumber(observedCount);
  const expected = toNumber(expectedCount);
  const coverageRatio = toCoverageRatio(observed, expected);
  const coveragePercent = toCoveragePercent(coverageRatio);

  if (coverageRatio === null) {
    return createGateRow({
      date,
      gate_key: gateKey,
      status: BLOCK,
      reason_code: 'missing_expected_count',
      summary: `${label} cannot be evaluated because the expected universe size is missing.`,
      details: {
        observed_count: observed,
        expected_count: expected,
        coverage_ratio: null,
        coverage_percent: null,
        ...details,
      },
    });
  }

  let status = BLOCK;
  let reason_code = 'insufficient_coverage';

  if (coverageRatio >= passCoverageThreshold) {
    status = PASS;
    reason_code = 'full_coverage';
  } else if (coverageRatio >= warnCoverageThreshold) {
    status = WARN;
    reason_code = 'partial_coverage';
  }

  return createGateRow({
    date,
    gate_key: gateKey,
    status,
    reason_code,
    summary: `${label} are ${coveragePercent}% (${observed}/${expected}).`,
    details: {
      observed_count: observed,
      expected_count: expected,
      coverage_ratio: Number(coverageRatio.toFixed(6)),
      coverage_percent: coveragePercent,
      pass_coverage_threshold: passCoverageThreshold,
      warn_coverage_threshold: warnCoverageThreshold,
      ...details,
    },
  });
}

function buildExternalFreshnessGate({
  date,
  gateKey,
  label,
  latestDate,
  expectedDate,
  warnStaleDays = EXTERNAL_SOURCE_WARN_STALE_DAYS,
}) {
  if (!latestDate) {
    return createGateRow({
      date,
      gate_key: gateKey,
      status: BLOCK,
      reason_code: 'missing',
      summary: `${label} have no stored rows yet.`,
      details: {
        expected_date: expectedDate,
        latest_date: null,
        stale_by_market_days: null,
        warn_stale_days: warnStaleDays,
      },
    });
  }

  if (latestDate >= expectedDate) {
    return createGateRow({
      date,
      gate_key: gateKey,
      status: PASS,
      reason_code: 'current',
      summary: `${label} are current for ${expectedDate}.`,
      details: {
        expected_date: expectedDate,
        latest_date: latestDate,
        stale_by_market_days: 0,
        warn_stale_days: warnStaleDays,
      },
    });
  }

  const staleByMarketDays = getStaleMarketDays(latestDate, expectedDate);
  const isWarning = staleByMarketDays <= warnStaleDays;

  return createGateRow({
    date,
    gate_key: gateKey,
    status: isWarning ? WARN : BLOCK,
    reason_code: isWarning ? 'stale_warn' : 'stale_block',
    summary: `${label} are stale by ${staleByMarketDays} US market day${staleByMarketDays === 1 ? '' : 's'} for expected date ${expectedDate}.`,
    details: {
      expected_date: expectedDate,
      latest_date: latestDate,
      stale_by_market_days: staleByMarketDays,
      warn_stale_days: warnStaleDays,
    },
  });
}

function buildIntradayCoverageGate({
  date,
  latestSessionDate,
  expectedDate,
  observedCount,
  expectedCount,
}) {
  if (!latestSessionDate) {
    return createGateRow({
      date,
      gate_key: 'intraday_60m_coverage',
      status: BLOCK,
      reason_code: 'missing',
      summary: 'Intraday 60m coverage has no stored sessions yet.',
      details: {
        expected_date: expectedDate,
        latest_session_date: null,
        stale_by_market_days: null,
        observed_count: toNumber(observedCount),
        expected_count: toNumber(expectedCount),
        coverage_ratio: null,
        coverage_percent: null,
      },
    });
  }

  if (latestSessionDate < expectedDate) {
    const staleByMarketDays = getStaleMarketDays(latestSessionDate, expectedDate);

    return createGateRow({
      date,
      gate_key: 'intraday_60m_coverage',
      status: BLOCK,
      reason_code: 'stale',
      summary: `Intraday 60m coverage is stale by ${staleByMarketDays} US market day${staleByMarketDays === 1 ? '' : 's'} for expected date ${expectedDate}.`,
      details: {
        expected_date: expectedDate,
        latest_session_date: latestSessionDate,
        stale_by_market_days: staleByMarketDays,
        observed_count: toNumber(observedCount),
        expected_count: toNumber(expectedCount),
      },
    });
  }

  return buildCoverageGate({
    date,
    gateKey: 'intraday_60m_coverage',
    label: 'Intraday 60m coverage',
    observedCount,
    expectedCount,
    passCoverageThreshold: INTRADAY_COVERAGE_PASS_THRESHOLD,
    warnCoverageThreshold: INTRADAY_COVERAGE_WARN_THRESHOLD,
    details: {
      expected_date: expectedDate,
      latest_session_date: latestSessionDate,
    },
  });
}

function buildIvolSourceStatusGate({
  date,
  latestDate,
  totalCount,
  activeCount,
  missingAssetKeys = [],
}) {
  const total = toNumber(totalCount);
  const active = toNumber(activeCount);
  const inactive = Math.max(total - active, 0);
  const normalizedMissingAssetKeys = Array.isArray(missingAssetKeys)
    ? missingAssetKeys.filter(Boolean)
    : [];

  if (total <= 0) {
    return createGateRow({
      date,
      gate_key: 'ivol_rvol_source_status',
      status: BLOCK,
      reason_code: 'missing_snapshot',
      summary: 'IVOL/RVOL source status has no stored snapshot rows yet.',
      details: {
        latest_date: latestDate ?? null,
        total_count: total,
        active_count: active,
        inactive_count: inactive,
        missing_asset_keys: normalizedMissingAssetKeys,
      },
    });
  }

  if (active === total) {
    return createGateRow({
      date,
      gate_key: 'ivol_rvol_source_status',
      status: PASS,
      reason_code: 'all_sources_active',
      summary: `IVOL/RVOL source status is complete (${active}/${total} active).`,
      details: {
        latest_date: latestDate ?? null,
        total_count: total,
        active_count: active,
        inactive_count: inactive,
        missing_asset_keys: normalizedMissingAssetKeys,
      },
    });
  }

  if (active > 0) {
    return createGateRow({
      date,
      gate_key: 'ivol_rvol_source_status',
      status: WARN,
      reason_code: 'partial_sources_missing',
      summary: `IVOL/RVOL source status is partial (${active}/${total} active).`,
      details: {
        latest_date: latestDate ?? null,
        total_count: total,
        active_count: active,
        inactive_count: inactive,
        missing_asset_keys: normalizedMissingAssetKeys,
      },
    });
  }

  return createGateRow({
    date,
    gate_key: 'ivol_rvol_source_status',
    status: BLOCK,
    reason_code: 'no_sources_active',
    summary: `IVOL/RVOL source status is unusable (${active}/${total} active).`,
    details: {
      latest_date: latestDate ?? null,
      total_count: total,
      active_count: active,
      inactive_count: inactive,
      missing_asset_keys: normalizedMissingAssetKeys,
    },
  });
}

export function buildSignalDataQualityRows(snapshot, { expectedDate } = {}) {
  return [
    buildCoreFreshnessGate({
      date: expectedDate,
      gateKey: 'stock_daily_prices_freshness',
      label: 'Stock daily prices',
      latestDate: snapshot.latestPriceDate,
      expectedDate,
    }),
    buildCoreFreshnessGate({
      date: expectedDate,
      gateKey: 'benchmark_spy_freshness',
      label: 'Benchmark SPY prices',
      latestDate: snapshot.latestBenchmarkDate,
      expectedDate,
    }),
    buildCoreFreshnessGate({
      date: expectedDate,
      gateKey: 'market_signal_freshness',
      label: 'Market regime rows',
      latestDate: snapshot.latestMarketSignalDate,
      expectedDate,
    }),
    buildCoreFreshnessGate({
      date: expectedDate,
      gateKey: 'relative_strength_freshness',
      label: 'Relative strength rows',
      latestDate: snapshot.latestRelativeStrengthDate,
      expectedDate,
    }),
    buildCoverageGate({
      date: expectedDate,
      gateKey: 'stock_daily_price_coverage',
      label: 'Stock daily price coverage',
      observedCount: snapshot.priceTickerCountForDate,
      expectedCount: snapshot.activeTickerCount,
      details: {
        expected_date: expectedDate,
      },
    }),
    buildCoverageGate({
      date: expectedDate,
      gateKey: 'relative_strength_coverage',
      label: 'Relative strength coverage',
      observedCount: snapshot.relativeStrengthTickerCountForDate,
      expectedCount: snapshot.activeTickerCount,
      details: {
        expected_date: expectedDate,
      },
    }),
    buildIntradayCoverageGate({
      date: expectedDate,
      latestSessionDate: snapshot.latestIntradaySessionDate,
      expectedDate,
      observedCount: snapshot.intradayTickerCountForDate,
      expectedCount: snapshot.activeTickerCount,
    }),
    buildExternalFreshnessGate({
      date: expectedDate,
      gateKey: 'occ_volume_totals_freshness',
      label: 'OCC daily volume totals',
      latestDate: snapshot.latestOccReportDate,
      expectedDate,
    }),
    buildExternalFreshnessGate({
      date: expectedDate,
      gateKey: 'finra_short_volume_freshness',
      label: 'FINRA short volume rows',
      latestDate: snapshot.latestFinraDate,
      expectedDate,
    }),
    buildExternalFreshnessGate({
      date: expectedDate,
      gateKey: 'ivol_rvol_freshness',
      label: 'IVOL/RVOL rows',
      latestDate: snapshot.latestIvolDate,
      expectedDate,
    }),
    buildIvolSourceStatusGate({
      date: expectedDate,
      latestDate: snapshot.latestIvolDate,
      totalCount: snapshot.ivolTotalCount,
      activeCount: snapshot.ivolActiveCount,
      missingAssetKeys: snapshot.ivolMissingAssetKeys,
    }),
  ];
}
