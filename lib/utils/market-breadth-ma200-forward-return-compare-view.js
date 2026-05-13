function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  if (value === null || value === undefined) {
    return null;
  }

  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function bucketLabel(bucketKey) {
  if (!bucketKey?.startsWith('breadth_')) {
    return '—';
  }

  return bucketKey.replace('breadth_', '').replaceAll('_', '-') + '%';
}

function toneFromDelta(delta) {
  if (delta === null) return 'neutral';
  if (delta > 0) return 'positive';
  if (delta < 0) return 'danger';
  return 'neutral';
}

const HORIZONS = [
  ['5d', '5d'],
  ['10d', '10d'],
  ['1m', '1m'],
  ['3m', '3m'],
  ['6m', '6m'],
  ['12m', '12m'],
];

export function buildMarketBreadthForwardReturnComparisonViewModel({ staticRow, empiricalRow }) {
  if (!staticRow || !empiricalRow) {
    return null;
  }

  const horizons = HORIZONS.map(([key, label]) => {
    const staticExpectedReturn = round(toNumber(staticRow[`ma200_expected_return_${key}`]));
    const empiricalExpectedReturn = round(toNumber(empiricalRow[`ma200_empirical_expected_return_${key}`]));
    const staticWinRatio = round(toNumber(staticRow[`ma200_win_ratio_${key}`]));
    const empiricalWinRatio = round(toNumber(empiricalRow[`ma200_empirical_win_ratio_${key}`]));
    const expectedReturnDelta = staticExpectedReturn !== null && empiricalExpectedReturn !== null
      ? round(empiricalExpectedReturn - staticExpectedReturn)
      : null;
    const winRatioDelta = staticWinRatio !== null && empiricalWinRatio !== null
      ? round(empiricalWinRatio - staticWinRatio)
      : null;

    return {
      key,
      label,
      sampleCount: empiricalRow[`ma200_empirical_sample_count_${key}`] ?? 0,
      staticExpectedReturn,
      empiricalExpectedReturn,
      expectedReturnDelta,
      expectedReturnTone: toneFromDelta(expectedReturnDelta),
      staticWinRatio,
      empiricalWinRatio,
      winRatioDelta,
      winRatioTone: toneFromDelta(winRatioDelta),
    };
  });

  const comparableHorizons = horizons.filter(
    (item) => item.staticExpectedReturn !== null && item.empiricalExpectedReturn !== null
  );
  const strongerHorizons = comparableHorizons.filter((item) => item.expectedReturnDelta > 0).length;
  const weakerHorizons = comparableHorizons.filter((item) => item.expectedReturnDelta < 0).length;
  const agreementCount = comparableHorizons.filter((item) => {
    const staticSign = Math.sign(item.staticExpectedReturn);
    const empiricalSign = Math.sign(item.empiricalExpectedReturn);
    return staticSign === empiricalSign;
  }).length;
  const positiveSampleCounts = horizons
    .map((item) => item.sampleCount)
    .filter((value) => Number.isFinite(value) && value > 0);
  const minimumSampleCount = positiveSampleCounts.length ? Math.min(...positiveSampleCounts) : 0;
  const largestExpectedReturnDeltaHorizon = comparableHorizons.reduce((best, current) => {
    if (!best) {
      return current;
    }

    return Math.abs(current.expectedReturnDelta) > Math.abs(best.expectedReturnDelta)
      ? current
      : best;
  }, null);

  return {
    date: staticRow.date ?? empiricalRow.date ?? null,
    breadthPct: round(toNumber(staticRow.ma200_breadth_pct)),
    bucketKey: staticRow.ma200_breadth_bucket ?? empiricalRow.ma200_breadth_bucket ?? null,
    bucketLabel: bucketLabel(staticRow.ma200_breadth_bucket ?? empiricalRow.ma200_breadth_bucket ?? null),
    benchmarkSymbol: empiricalRow.benchmark_symbol ?? null,
    staticSignal: staticRow.ma200_breadth_signal ?? null,
    staticAction: staticRow.ma200_breadth_action ?? null,
    staticConfidence: staticRow.ma200_breadth_confidence ?? null,
    staticWarning: staticRow.ma200_breadth_warning ?? null,
    summary: {
      overallTone: strongerHorizons > weakerHorizons
        ? 'positive'
        : weakerHorizons > strongerHorizons
          ? 'danger'
          : 'neutral',
      strongerHorizons,
      weakerHorizons,
      agreementCount,
      minimumSampleCount,
      largestExpectedReturnDelta: largestExpectedReturnDeltaHorizon
        ? {
            horizonKey: largestExpectedReturnDeltaHorizon.key,
            horizonLabel: largestExpectedReturnDeltaHorizon.label,
            delta: largestExpectedReturnDeltaHorizon.expectedReturnDelta,
            sampleCount: largestExpectedReturnDeltaHorizon.sampleCount,
          }
        : null,
    },
    horizons,
  };
}
