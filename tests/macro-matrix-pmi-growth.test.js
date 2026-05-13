import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMacroMatrixPmiGrowth,
  classifyPmiGrowthRegime,
  transformPmiMacroSeriesToMonthlyObservations,
} from '../lib/indicators/macro-matrix-pmi-growth.js';

test('transformPmiMacroSeriesToMonthlyObservations aligns monthly rows and computes YoY momentum', () => {
  const observations = transformPmiMacroSeriesToMonthlyObservations(
    [
      { date: '2024-01-01', value: 100 },
      { date: '2024-02-01', value: 100 },
      { date: '2025-01-01', value: 110 },
      { date: '2025-02-01', value: 125 },
    ],
    {
      key: 'exports_yoy',
      label: 'Export Y/Y',
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
      directionScore: item.directionScore,
    })),
    [
      { periodDate: '2024-01-01', transformedValue: null, momChange: null, directionScore: 0 },
      { periodDate: '2024-02-01', transformedValue: null, momChange: null, directionScore: 0 },
      { periodDate: '2025-01-01', transformedValue: 10, momChange: null, directionScore: 0 },
      { periodDate: '2025-02-01', transformedValue: 25, momChange: 15, directionScore: 1 },
    ]
  );
});

test('transformPmiMacroSeriesToMonthlyObservations applies PMI 50-line direction scoring', () => {
  const observations = transformPmiMacroSeriesToMonthlyObservations(
    [
      { date: '2025-01-01', value: 52 },
      { date: '2025-02-01', value: 51 },
      { date: '2025-03-01', value: 49 },
      { date: '2025-04-01', value: 48 },
      { date: '2025-05-01', value: 49 },
    ],
    {
      key: 'manufacturing_pmi_total',
      label: 'Manufacturing PMI Total',
      category: 'manufacturing_pmi',
      transform: 'raw',
      direction: 'pmi',
    }
  );

  assert.equal(observations[1].directionScore, 0);
  assert.equal(observations[3].directionScore, -1);
  assert.equal(observations[4].directionScore, 0);
});

test('transformPmiMacroSeriesToMonthlyObservations applies neutral-level confidence scoring', () => {
  const observations = transformPmiMacroSeriesToMonthlyObservations(
    [
      { date: '2025-01-01', value: 101 },
      { date: '2025-02-01', value: 100 },
      { date: '2025-03-01', value: 99 },
      { date: '2025-04-01', value: 98 },
      { date: '2025-05-01', value: 99 },
    ],
    {
      key: 'economic_tendency_total',
      label: 'Economic Tendency Indicator Total',
      category: 'broad_cycle',
      transform: 'raw',
      direction: 'neutral_level',
      neutralLevel: 100,
    }
  );

  assert.equal(observations[1].directionScore, 0);
  assert.equal(observations[3].directionScore, -1);
  assert.equal(observations[4].directionScore, 0);
});

test('buildMacroMatrixPmiGrowth calculates services-led expansion from category scores', () => {
  const matrix = buildMacroMatrixPmiGrowth(
    {
      manufacturing_pmi_total: transformPmiMacroSeriesToMonthlyObservations(
        [
          { date: '2025-01-01', value: 49 },
          { date: '2025-02-01', value: 48 },
        ],
        {
          key: 'manufacturing_pmi_total',
          label: 'Manufacturing PMI Total',
          category: 'manufacturing_pmi',
          transform: 'raw',
          direction: 'pmi',
        }
      ),
      services_pmi_total: transformPmiMacroSeriesToMonthlyObservations(
        [
          { date: '2025-01-01', value: 51 },
          { date: '2025-02-01', value: 52 },
        ],
        {
          key: 'services_pmi_total',
          label: 'Services PMI Total',
          category: 'services_pmi',
          transform: 'raw',
          direction: 'pmi',
        }
      ),
      composite_leading_indicators_yoy: transformPmiMacroSeriesToMonthlyObservations(
        [
          { date: '2024-01-01', value: 100 },
          { date: '2024-02-01', value: 100 },
          { date: '2025-01-01', value: 100 },
          { date: '2025-02-01', value: 101 },
        ],
        {
          key: 'composite_leading_indicators_yoy',
          label: 'Composite Leading Indicators Y/Y',
          category: 'leading_indicators',
          transform: 'yoy',
          direction: 'higher_is_better',
        }
      ),
    },
    { monthCount: 2, quarterCount: 1 }
  );

  assert.equal(matrix.latest.manufacturingPmiScore, -1);
  assert.equal(matrix.latest.servicesPmiScore, 1);
  assert.equal(matrix.latest.manufacturingServicesSpread, 2);
  assert.equal(matrix.latest.pmiGrowthRegime, 'services_led_expansion_manufacturing_slowdown');
  assert.equal(matrix.latest.pmiGrowthRiskAction, 'NEUTRAL_TO_RISK_ON');
});

test('classifyPmiGrowthRegime prioritizes severe stress before broad contraction', () => {
  assert.deepEqual(
    classifyPmiGrowthRegime({
      pmiGrowthScore: -0.6,
      percentNegative: 75,
      manufacturingPmiScore: -1,
      servicesPmiScore: -1,
      leadingIndicatorsScore: -1,
    }),
    {
      pmiGrowthRegime: 'pmi_macro_stress',
      pmiGrowthRiskAction: 'GO_TO_CASH',
    }
  );
});
