import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMacroMatrixUsGrowth,
  classifyMacroGrowthRegime,
  transformMacroSeriesToMonthlyObservations,
} from '../lib/indicators/macro-matrix-us-growth.js';

test('transformMacroSeriesToMonthlyObservations aligns weekly rows to monthly averages and computes YoY for jobless claims', () => {
  const rows = [
    { date: '2024-01-05', value: 100 },
    { date: '2024-01-12', value: 100 },
    { date: '2024-02-02', value: 100 },
    { date: '2024-02-09', value: 100 },
    { date: '2025-01-03', value: 80 },
    { date: '2025-01-10', value: 80 },
    { date: '2025-02-07', value: 120 },
    { date: '2025-02-14', value: 120 },
  ];

  const observations = transformMacroSeriesToMonthlyObservations(rows, {
    key: 'initial_jobless_claims_yoy',
    label: 'Initial Jobless Claims Y/Y %',
    category: 'labor',
    frequency: 'weekly',
    transform: 'yoy',
    direction: 'lower_is_better',
  });

  assert.deepEqual(
    observations.map((item) => ({
      periodDate: item.periodDate,
      rawValue: item.rawValue,
      transformedValue: item.transformedValue,
      momChange: item.momChange,
      directionScore: item.directionScore,
    })),
    [
      {
        periodDate: '2024-01-01',
        rawValue: 100,
        transformedValue: null,
        momChange: null,
        directionScore: 0,
      },
      {
        periodDate: '2024-02-01',
        rawValue: 100,
        transformedValue: null,
        momChange: null,
        directionScore: 0,
      },
      {
        periodDate: '2025-01-01',
        rawValue: 80,
        transformedValue: -20,
        momChange: null,
        directionScore: 0,
      },
      {
        periodDate: '2025-02-01',
        rawValue: 120,
        transformedValue: 20,
        momChange: 40,
        directionScore: -1,
      },
    ]
  );
});

test('transformMacroSeriesToMonthlyObservations applies inflation special rule when elevated inflation cools', () => {
  const observations = transformMacroSeriesToMonthlyObservations(
    [
      { date: '2024-01-01', value: 100 },
      { date: '2024-02-01', value: 100 },
      { date: '2025-01-01', value: 104 },
      { date: '2025-02-01', value: 103 },
    ],
    {
      key: 'core_pce_yoy',
      label: 'Core PCE Y/Y %',
      category: 'inflation',
      frequency: 'monthly',
      transform: 'yoy',
      direction: 'inflation',
    }
  );

  const latest = observations.at(-1);

  assert.equal(latest.transformedValue, 3);
  assert.equal(latest.momChange, -1);
  assert.equal(latest.directionScore, 1);
});

test('transformMacroSeriesToMonthlyObservations applies PMI diffusion rule', () => {
  const observations = transformMacroSeriesToMonthlyObservations(
    [
      { date: '2025-01-01', value: 49 },
      { date: '2025-02-01', value: 51 },
    ],
    {
      key: 'ism_manufacturing_index',
      label: 'ISM Manufacturing',
      category: 'survey',
      frequency: 'monthly',
      transform: 'raw',
      direction: 'pmi',
    }
  );

  assert.equal(observations.at(-1).momChange, 2);
  assert.equal(observations.at(-1).directionScore, 1);
});

test('buildMacroMatrixUsGrowth excludes missing rows from denominator and builds monthly summary', () => {
  const matrix = buildMacroMatrixUsGrowth(
    {
      exports_yoy: transformMacroSeriesToMonthlyObservations(
        [
          { date: '2024-01-01', value: 100 },
          { date: '2024-02-01', value: 100 },
          { date: '2025-01-01', value: 110 },
          { date: '2025-02-01', value: 130 },
        ],
        {
          key: 'exports_yoy',
          label: 'Exports Y/Y %',
          category: 'trade',
          frequency: 'monthly',
          transform: 'yoy',
          direction: 'higher_is_better',
        }
      ),
      initial_jobless_claims_yoy: transformMacroSeriesToMonthlyObservations(
        [
          { date: '2024-01-05', value: 100 },
          { date: '2024-01-12', value: 100 },
          { date: '2024-02-02', value: 100 },
          { date: '2024-02-09', value: 100 },
          { date: '2025-01-03', value: 90 },
          { date: '2025-01-10', value: 90 },
          { date: '2025-02-07', value: 80 },
          { date: '2025-02-14', value: 80 },
        ],
        {
          key: 'initial_jobless_claims_yoy',
          label: 'Initial Jobless Claims Y/Y %',
          category: 'labor',
          frequency: 'weekly',
          transform: 'yoy',
          direction: 'lower_is_better',
        }
      ),
      core_pce_yoy: transformMacroSeriesToMonthlyObservations(
        [
          { date: '2024-01-01', value: 100 },
          { date: '2024-02-01', value: 100 },
          { date: '2025-01-01', value: 104 },
          { date: '2025-02-01', value: 103 },
        ],
        {
          key: 'core_pce_yoy',
          label: 'Core PCE Y/Y %',
          category: 'inflation',
          frequency: 'monthly',
          transform: 'yoy',
          direction: 'inflation',
        }
      ),
      philadelphia_fed_general_activity: transformMacroSeriesToMonthlyObservations(
        [
          { date: '2025-01-01', value: 15 },
        ],
        {
          key: 'philadelphia_fed_general_activity',
          label: 'Philadelphia Fed',
          category: 'regional_survey',
          frequency: 'monthly',
          transform: 'raw',
          direction: 'higher_is_better',
        }
      ),
    },
    {
      monthCount: 2,
      quarterCount: 2,
    }
  );

  assert.deepEqual(matrix.months, ['2025-01-01', '2025-02-01']);
  assert.equal(matrix.rows.length, 4);
  assert.equal(matrix.summaryByMonth.at(-1).validRowCount, 3);
  assert.equal(matrix.summaryByMonth.at(-1).positiveCount, 3);
  assert.equal(matrix.summaryByMonth.at(-1).negativeCount, 0);
  assert.equal(matrix.summaryByMonth.at(-1).percentPositive, 100);
  assert.equal(matrix.latest.macroGrowthScore, 1);
  assert.equal(matrix.latest.macroGrowthRegime, 'expansion_improving');
  assert.equal(matrix.latest.macroGrowthRiskAction, 'RISK_ON');
});

test('classifyMacroGrowthRegime returns severe risk-off classification for broad contraction', () => {
  assert.deepEqual(
    classifyMacroGrowthRegime({
      macroGrowthScore: -0.6,
      percentPositive: 10,
      percentNegative: 80,
    }),
    {
      macroGrowthRegime: 'macro_stress',
      macroGrowthRiskAction: 'GO_TO_CASH',
    }
  );
});
