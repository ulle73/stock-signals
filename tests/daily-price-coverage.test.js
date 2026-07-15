import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MIN_DAILY_PRICE_COVERAGE_RATIO,
  buildDailyPriceCoverageDecision,
} from '../lib/utils/daily-price-coverage.js';

test('daily coverage defaults to a 98 percent operational threshold', () => {
  assert.equal(DEFAULT_MIN_DAILY_PRICE_COVERAGE_RATIO, 0.98);
});

test('one persistent ticker failure does not stop a 507 ticker daily run', () => {
  const decision = buildDailyPriceCoverageDecision({
    observedCount: 506,
    expectedCount: 507,
  });

  assert.equal(decision.canContinue, true);
  assert.equal(decision.isPartial, true);
  assert.equal(decision.coveragePercent, 99.8);
  assert.equal(decision.missingCount, 1);
});

test('eight intermittent ticker failures still allow calculation to continue', () => {
  const decision = buildDailyPriceCoverageDecision({
    observedCount: 499,
    expectedCount: 507,
  });

  assert.equal(decision.canContinue, true);
  assert.equal(decision.coveragePercent, 98.42);
  assert.equal(decision.missingCount, 8);
});

test('coverage below 98 percent remains a hard stop', () => {
  const decision = buildDailyPriceCoverageDecision({
    observedCount: 496,
    expectedCount: 507,
  });

  assert.equal(decision.canContinue, false);
  assert.equal(decision.coveragePercent, 97.83);
  assert.match(decision.reason, /below the required 98%/i);
});

test('missing or invalid universe counts remain a hard stop', () => {
  assert.equal(buildDailyPriceCoverageDecision({ observedCount: 0, expectedCount: 0 }).canContinue, false);
  assert.equal(buildDailyPriceCoverageDecision({ observedCount: null, expectedCount: 507 }).canContinue, false);
});
