import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeSignalStudy,
  resolveSignalStudyResultStorage,
  SignalStudyConfigError,
  SignalStudyPersistenceError,
} from '../lib/utils/signal-study-runner.js';

test('signal study runner resolves storage kinds predictably', () => {
  assert.equal(resolveSignalStudyResultStorage({ saveResult: false, resultStorage: 'database' }), 'none');
  assert.equal(resolveSignalStudyResultStorage({ saveResult: true, resultStorage: 'database' }), 'database');
  assert.equal(resolveSignalStudyResultStorage({ saveResult: true, resultStorage: 'filesystem' }), 'filesystem');
});

test('signal study runner wraps validation errors as config errors', async () => {
  await assert.rejects(
    executeSignalStudy({
      config: {},
      normalizeConfig: () => {
        throw new Error('name krävs.');
      },
    }),
    (error) => error instanceof SignalStudyConfigError && /name krävs/i.test(error.message)
  );
});

test('signal study runner writes filesystem refs for local CLI flow', async () => {
  const writes = [];
  const payload = await executeSignalStudy({
    config: {
      name: 'Breadth Cross',
      studyType: 'forward_horizon',
      returnInstrument: 'SPY',
      maxHorizonDays: 10,
      conditionMode: 'ALL',
      eventMode: 'signal_start',
      conditions: [{ field: 'market.pct_above_50', operator: '>', value: 50 }],
    },
    now: new Date('2026-06-15T22:45:00.000Z'),
    normalizeConfig: (value) => value,
    buildDataset: async () => ({
      returnInstrument: 'SPY',
      signalInstrument: 'SPY',
      priceRows: [{ date: '2026-06-01', price: 100, sourceTable: 'benchmark_daily_prices' }],
      bars: [{ date: '2026-06-01', price: 100, values: { 'market.pct_above_50': 55 } }],
      fieldKeys: ['market.pct_above_50'],
      fieldCoverage: [{ fieldKey: 'market.pct_above_50', rowCount: 1, nonNullCount: 1, firstValueDate: '2026-06-01', lastValueDate: '2026-06-01' }],
    }),
    runForwardStudy: () => ({ studyType: 'forward_horizon', eventCount: 1, entryDelayBars: 1, horizons: [], events: [], summary: {} }),
    writeFilesystemResult: async (input) => {
      writes.push(input);
    },
  });

  assert.equal(payload.meta.storageKind, 'filesystem');
  assert.match(payload.meta.savedResultRef, /studies[\\/]results[\\/]breadth-cross--20260615-224500\.json$/i);
  assert.match(payload.meta.savedLatestRef, /studies[\\/]results[\\/]breadth-cross\.latest\.json$/i);
  assert.equal(writes.length, 1);
});

test('signal study runner saves database-backed results with stable refs', async () => {
  const savedRecords = [];
  const payload = await executeSignalStudy({
    config: {
      name: 'TF Sync Green',
      studyType: 'state_period',
      returnInstrument: 'SPY',
      stateField: 'market.signal',
      entryState: 'risk_on',
      oppositeState: 'risk_off',
      neutralState: 'warning',
    },
    now: new Date('2026-06-15T22:50:00.000Z'),
    resultStorage: 'database',
    createResultId: () => 'unit-id',
    normalizeConfig: (value) => value,
    buildDataset: async () => ({
      returnInstrument: 'SPY',
      signalInstrument: 'SPY',
      priceRows: [{ date: '2026-06-01', price: 100, sourceTable: 'benchmark_daily_prices' }],
      bars: [{ date: '2026-06-01', price: 100, values: { 'market.signal': 'risk_on' } }],
      fieldKeys: ['market.signal'],
      fieldCoverage: [{ fieldKey: 'market.signal', rowCount: 1, nonNullCount: 1, firstValueDate: '2026-06-01', lastValueDate: '2026-06-01' }],
    }),
    runStateStudy: () => ({ studyType: 'state_period', summary: { period_count: 1 }, periods: [], maxHoldBars: null }),
    saveDatabaseResult: async (record) => {
      savedRecords.push(record);
      return record;
    },
  });

  assert.equal(payload.meta.storageKind, 'database');
  assert.equal(payload.meta.savedResultRef, 'signal-study-result:tf-sync-green--20260615-225000--unit-id');
  assert.equal(payload.meta.savedLatestRef, 'signal-study-latest:tf-sync-green');
  assert.equal(savedRecords.length, 1);
  assert.equal(savedRecords[0].id, 'tf-sync-green--20260615-225000--unit-id');
});

test('signal study runner wraps database persistence failures', async () => {
  await assert.rejects(
    executeSignalStudy({
      config: {
        name: 'TF Sync Green',
        studyType: 'state_period',
        returnInstrument: 'SPY',
        stateField: 'market.signal',
        entryState: 'risk_on',
        oppositeState: 'risk_off',
      },
      resultStorage: 'database',
      normalizeConfig: (value) => value,
      buildDataset: async () => ({
        returnInstrument: 'SPY',
        signalInstrument: 'SPY',
        priceRows: [{ date: '2026-06-01', price: 100, sourceTable: 'benchmark_daily_prices' }],
        bars: [],
        fieldKeys: [],
        fieldCoverage: [],
      }),
      runStateStudy: () => ({ studyType: 'state_period', summary: { period_count: 0 }, periods: [], maxHoldBars: null }),
      saveDatabaseResult: async () => {
        throw new Error('insert failed');
      },
    }),
    (error) => error instanceof SignalStudyPersistenceError && /insert failed/i.test(error.message)
  );
});
