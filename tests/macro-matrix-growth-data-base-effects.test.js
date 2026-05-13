import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGrowthDataBaseEffectsMatrix,
  classifyBaseEffectRegime,
  classifyGrowthDataBaseEffectRegime,
  transformGrowthDataBaseEffectSeriesToMonthlyObservations,
} from '../lib/indicators/macro-matrix-growth-data-base-effects.js';

test('transformGrowthDataBaseEffectSeriesToMonthlyObservations computes YoY, MoM and base-effect fields', () => {
  const observations = transformGrowthDataBaseEffectSeriesToMonthlyObservations(
    [
      { date: '2024-01-01', value: 100 },
      { date: '2024-02-01', value: 100 },
      { date: '2025-01-01', value: 110 },
      { date: '2025-02-01', value: 121 },
    ],
    {
      key: 'export_yoy',
      label: 'Export %Y/Y',
      category: 'trade',
      transform: 'yoy',
      direction: 'higher_is_better',
    }
  );

  assert.deepEqual(
    observations.map((item) => ({
      periodDate: item.periodDate,
      transformedValue: item.transformedValue,
      momChange: item.momChange,
      baseValue12mAgo: item.baseValue12mAgo,
      directionScore: item.directionScore,
    })),
    [
      { periodDate: '2024-01-01', transformedValue: null, momChange: null, baseValue12mAgo: null, directionScore: 0 },
      { periodDate: '2024-02-01', transformedValue: null, momChange: null, baseValue12mAgo: null, directionScore: 0 },
      { periodDate: '2025-01-01', transformedValue: 10, momChange: null, baseValue12mAgo: 100, directionScore: 0 },
      { periodDate: '2025-02-01', transformedValue: 21, momChange: 11, baseValue12mAgo: 100, directionScore: 1 },
    ]
  );
});

test('classifyBaseEffectRegime maps easy, normal and hard comparison regimes', () => {
  assert.deepEqual(classifyBaseEffectRegime(-0.8), {
    baseEffectRegime: 'easy_comparisons',
    confidence: 'medium_positive_may_be_overstated',
  });
  assert.deepEqual(classifyBaseEffectRegime(0), {
    baseEffectRegime: 'normal_comparisons',
    confidence: 'normal',
  });
  assert.deepEqual(classifyBaseEffectRegime(0.9), {
    baseEffectRegime: 'hard_comparisons',
    confidence: 'medium_negative_may_be_overstated',
  });
});

test('classifyGrowthDataBaseEffectRegime reduces severity when falling growth has hard comparisons', () => {
  assert.deepEqual(
    classifyGrowthDataBaseEffectRegime({
      growthMomentumScore: -0.2,
      percentPositive: 20,
      percentNegative: 40,
      baseEffectRegime: 'hard_comparisons',
    }),
    {
      growthBaseEffectRegime: 'growth_falling_hard_base',
      growthBaseEffectRiskAction: 'NEUTRAL',
    }
  );
});

test('buildGrowthDataBaseEffectsMatrix excludes missing rows from denominator and calculates category scores', () => {
  const matrix = buildGrowthDataBaseEffectsMatrix(
    {
      export_yoy: transformGrowthDataBaseEffectSeriesToMonthlyObservations(
        [
          { date: '2024-01-01', value: 100 },
          { date: '2024-02-01', value: 100 },
          { date: '2025-01-01', value: 110 },
          { date: '2025-02-01', value: 120 },
        ],
        {
          key: 'export_yoy',
          label: 'Export %Y/Y',
          category: 'trade',
          transform: 'yoy',
          direction: 'higher_is_better',
        }
      ),
      retail_sales_ex_vehicles_yoy: transformGrowthDataBaseEffectSeriesToMonthlyObservations(
        [
          { date: '2024-01-01', value: 100 },
          { date: '2024-02-01', value: 100 },
          { date: '2025-01-01', value: 100 },
          { date: '2025-02-01', value: 95 },
        ],
        {
          key: 'retail_sales_ex_vehicles_yoy',
          label: 'Retail Sales excl. Vehicles %Y/Y',
          category: 'consumption',
          transform: 'yoy',
          direction: 'higher_is_better',
        }
      ),
    },
    { monthCount: 2, quarterCount: 1 }
  );

  assert.equal(matrix.latest.validRowCount, 2);
  assert.equal(matrix.latest.tradeScore, 1);
  assert.equal(matrix.latest.consumptionScore, -1);
  assert.equal(matrix.latest.percentPositive, 50);
  assert.equal(matrix.latest.percentNegative, 50);
});
