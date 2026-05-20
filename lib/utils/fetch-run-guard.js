export function createFetchRunGuard({ finishRun, closePool, setExitCode, taskLabel = 'fetch:daily' }) {
  let fetchRunId = null;
  let fetchRunClosed = false;
  let shuttingDown = false;

  async function closeRun(status, details) {
    if (!fetchRunId || fetchRunClosed) {
      return;
    }

    fetchRunClosed = true;
    await finishRun(fetchRunId, status, details);
  }

  async function handleSignal(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;

    try {
      await closeRun('failure', {
        errorMessage: `${taskLabel} interrupted by ${signal}`,
        metadata: { signal },
      });
    } finally {
      await closePool();
      setExitCode(1);
    }
  }

  return {
    setRunId(id) {
      fetchRunId = id;
    },
    async finish(status, details) {
      await closeRun(status, details);
    },
    async handleSignal(signal) {
      await handleSignal(signal);
    },
    register(processLike) {
      const onSigint = () => {
        void handleSignal('SIGINT');
      };
      const onSigterm = () => {
        void handleSignal('SIGTERM');
      };

      processLike.on('SIGINT', onSigint);
      processLike.on('SIGTERM', onSigterm);

      return () => {
        processLike.off('SIGINT', onSigint);
        processLike.off('SIGTERM', onSigterm);
      };
    },
  };
}
