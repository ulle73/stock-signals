import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInsertSignalStudyResultStatement,
  getLatestSignalStudyResultBySlug,
  saveSignalStudyResult,
} from '../lib/repositories/signal-study-results.js';

test('signal study results repository builds insert statements with serialized payload json', () => {
  const statement = buildInsertSignalStudyResultStatement({
    id: 'study-1',
    slug: 'tf-sync-green',
    studyName: 'TF Sync Green',
    studyType: 'state_period',
    returnInstrument: 'SPY',
    signalInstrument: 'AAPL',
    configPath: 'ui://signal-study-lab',
    payloadJson: { meta: { storageKind: 'database' }, result: { studyType: 'state_period' } },
    createdAt: '2026-06-15T22:10:00.000Z',
  });

  assert.match(statement.sql, /insert into signal_study_results/i);
  assert.deepEqual(statement.params, [
    'study-1',
    'tf-sync-green',
    'TF Sync Green',
    'state_period',
    'SPY',
    'AAPL',
    'ui://signal-study-lab',
    JSON.stringify({ meta: { storageKind: 'database' }, result: { studyType: 'state_period' } }),
    '2026-06-15T22:10:00.000Z',
  ]);
});

test('signal study results repository persists records through injected query executor', async () => {
  const calls = [];
  const record = {
    id: 'study-2',
    slug: 'breadth-cross',
    studyName: 'Breadth Cross',
    studyType: 'forward_horizon',
    returnInstrument: 'SPY',
    signalInstrument: 'SPY',
    configPath: 'ui://signal-study-lab',
    payloadJson: { meta: { savedResultRef: 'signal-study-result:study-2' }, result: { studyType: 'forward_horizon' } },
    createdAt: '2026-06-15T22:15:00.000Z',
  };

  await saveSignalStudyResult(record, {
    execute: async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [] };
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /insert into signal_study_results/i);
  assert.equal(calls[0].params[0], 'study-2');
});

test('signal study results repository maps latest rows into app-friendly objects', async () => {
  const row = await getLatestSignalStudyResultBySlug('tf-sync-green', {
    execute: async () => ({
      rows: [{
        id: 'study-3',
        slug: 'tf-sync-green',
        study_name: 'TF Sync Green',
        study_type: 'state_period',
        return_instrument: 'SPY',
        signal_instrument: 'QQQ',
        config_path: 'ui://signal-study-lab',
        payload_json: { meta: { storageKind: 'database' } },
        created_at: '2026-06-15T22:30:00.000Z',
      }],
    }),
  });

  assert.deepEqual(row, {
    id: 'study-3',
    slug: 'tf-sync-green',
    studyName: 'TF Sync Green',
    studyType: 'state_period',
    returnInstrument: 'SPY',
    signalInstrument: 'QQQ',
    configPath: 'ui://signal-study-lab',
    payloadJson: { meta: { storageKind: 'database' } },
    createdAt: '2026-06-15T22:30:00.000Z',
  });
});
