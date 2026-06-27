import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SignalStudyConfigError,
  SignalStudyPersistenceError,
} from '../lib/utils/signal-study-runner.js';
import { handleSignalStudyRunRequest } from '../lib/utils/signal-study-run-endpoint.js';

function buildRequest({ token = '', json = async () => ({}) } = {}) {
  return {
    headers: {
      get(name) {
        return name === 'x-signal-study-access-token' ? token : null;
      },
    },
    json,
  };
}

test('signal study run endpoint returns 404 when feature flag is disabled', async () => {
  const response = await handleSignalStudyRunRequest(
    buildRequest(),
    { env: { ENABLE_SIGNAL_STUDY_LAB: 'false', SIGNAL_STUDY_ACCESS_TOKEN: 'secret' } }
  );

  assert.equal(response.status, 404);
});

test('signal study run endpoint returns 401 on missing or wrong token', async () => {
  const response = await handleSignalStudyRunRequest(
    buildRequest({ token: 'wrong' }),
    { env: { ENABLE_SIGNAL_STUDY_LAB: 'true', SIGNAL_STUDY_ACCESS_TOKEN: 'secret' } }
  );

  assert.equal(response.status, 401);
});

test('signal study run endpoint returns 400 for invalid json payloads', async () => {
  const response = await handleSignalStudyRunRequest(
    buildRequest({
      token: 'secret',
      json: async () => {
        throw new SyntaxError('Unexpected token');
      },
    }),
    { env: { ENABLE_SIGNAL_STUDY_LAB: 'true', SIGNAL_STUDY_ACCESS_TOKEN: 'secret' } }
  );

  assert.equal(response.status, 400);
});

test('signal study run endpoint returns 400 for config validation errors', async () => {
  const response = await handleSignalStudyRunRequest(
    buildRequest({ token: 'secret' }),
    {
      env: { ENABLE_SIGNAL_STUDY_LAB: 'true', SIGNAL_STUDY_ACCESS_TOKEN: 'secret' },
      executeStudy: async () => {
        throw new SignalStudyConfigError('name krävs.');
      },
    }
  );

  assert.equal(response.status, 400);
  assert.match(response.body.error, /name krävs/i);
});

test('signal study run endpoint returns 500 for persistence errors', async () => {
  const response = await handleSignalStudyRunRequest(
    buildRequest({ token: 'secret' }),
    {
      env: { ENABLE_SIGNAL_STUDY_LAB: 'true', SIGNAL_STUDY_ACCESS_TOKEN: 'secret' },
      executeStudy: async () => {
        throw new SignalStudyPersistenceError('insert failed');
      },
    }
  );

  assert.equal(response.status, 500);
  assert.match(response.body.error, /insert failed/i);
});

test('signal study run endpoint returns 200 and payload on success', async () => {
  const response = await handleSignalStudyRunRequest(
    buildRequest({ token: 'secret' }),
    {
      env: { ENABLE_SIGNAL_STUDY_LAB: 'true', SIGNAL_STUDY_ACCESS_TOKEN: 'secret' },
      executeStudy: async () => ({
        meta: {
          storageKind: 'database',
          savedResultRef: 'signal-study-result:1',
          savedLatestRef: 'signal-study-latest:test',
        },
        result: { studyType: 'forward_horizon' },
      }),
    }
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.meta.storageKind, 'database');
});
