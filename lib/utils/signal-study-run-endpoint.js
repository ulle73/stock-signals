import {
  SignalStudyConfigError,
  SignalStudyPersistenceError,
  executeSignalStudy,
} from './signal-study-runner.js';
import { getSignalStudyAccessToken, isSignalStudyLabEnabled } from './signal-study-feature.js';

export const SIGNAL_STUDY_ACCESS_HEADER = 'x-signal-study-access-token';

function unauthorizedResponse() {
  return {
    status: 401,
    body: {
      error: 'Unauthorized signal study request.',
    },
  };
}

function internalErrorResponse(message) {
  return {
    status: 500,
    body: {
      error: message,
    },
  };
}

export async function handleSignalStudyRunRequest(
  request,
  {
    env = process.env,
    executeStudy = executeSignalStudy,
  } = {}
) {
  if (!isSignalStudyLabEnabled(env)) {
    return {
      status: 404,
      body: {
        error: 'Signal study lab is disabled.',
      },
    };
  }

  const expectedToken = getSignalStudyAccessToken(env);
  if (!expectedToken) {
    return internalErrorResponse('SIGNAL_STUDY_ACCESS_TOKEN is not configured.');
  }

  const suppliedToken = request.headers.get(SIGNAL_STUDY_ACCESS_HEADER)?.trim();
  if (!suppliedToken || suppliedToken !== expectedToken) {
    return unauthorizedResponse();
  }

  let config;
  try {
    config = await request.json();
  } catch {
    return {
      status: 400,
      body: {
        error: 'Study config must be valid JSON.',
      },
    };
  }

  try {
    const payload = await executeStudy({
      config,
      configPath: 'ui://signal-study-lab',
      saveResult: true,
      resultStorage: 'database',
    });

    return {
      status: 200,
      body: payload,
    };
  } catch (error) {
    if (error instanceof SignalStudyConfigError) {
      return {
        status: 400,
        body: {
          error: error.message,
        },
      };
    }

    if (error instanceof SignalStudyPersistenceError) {
      return internalErrorResponse(error.message);
    }

    return internalErrorResponse(error.message ?? 'Unknown signal study error.');
  }
}
