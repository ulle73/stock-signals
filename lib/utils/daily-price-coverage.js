export const DEFAULT_MIN_DAILY_PRICE_COVERAGE_RATIO = 0.98;

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function buildDailyPriceCoverageDecision({
  observedCount,
  expectedCount,
  minimumCoverageRatio = DEFAULT_MIN_DAILY_PRICE_COVERAGE_RATIO,
} = {}) {
  const observed = finiteNumber(observedCount);
  const expected = finiteNumber(expectedCount);
  const minimum = finiteNumber(minimumCoverageRatio);
  const validCounts = observed !== null
    && expected !== null
    && expected > 0
    && observed >= 0
    && observed <= expected;
  const validMinimum = minimum !== null && minimum > 0 && minimum <= 1;

  if (!validCounts || !validMinimum) {
    return {
      observedCount: observed,
      expectedCount: expected,
      missingCount: null,
      coverageRatio: null,
      coveragePercent: null,
      requiredCoverageRatio: validMinimum ? minimum : DEFAULT_MIN_DAILY_PRICE_COVERAGE_RATIO,
      requiredCoveragePercent: round((validMinimum ? minimum : DEFAULT_MIN_DAILY_PRICE_COVERAGE_RATIO) * 100),
      canContinue: false,
      isPartial: false,
      reason: 'Daily price coverage cannot be evaluated because the observed or expected universe count is invalid.',
    };
  }

  const missingCount = Math.max(expected - observed, 0);
  const coverageRatio = observed / expected;
  const coveragePercent = round(coverageRatio * 100);
  const requiredCoveragePercent = round(minimum * 100);
  const canContinue = coverageRatio >= minimum;
  const isPartial = missingCount > 0;

  return {
    observedCount: observed,
    expectedCount: expected,
    missingCount,
    coverageRatio: round(coverageRatio, 6),
    coveragePercent,
    requiredCoverageRatio: minimum,
    requiredCoveragePercent,
    canContinue,
    isPartial,
    reason: canContinue
      ? `Daily price coverage is ${coveragePercent}% (${observed}/${expected}), meeting the required ${requiredCoveragePercent}%.`
      : `Daily price coverage is ${coveragePercent}% (${observed}/${expected}), below the required ${requiredCoveragePercent}%.`,
  };
}
