import { query } from '../db.js';

export async function failRunningFetchRuns(jobName, errorMessage, metadata = {}) {
  await query(
    `update data_fetch_runs set
      status = 'failure',
      finished_at = coalesce(finished_at, now()),
      error_message = $2,
      metadata = $3
     where job_name = $1 and status = 'running'`,
    [
      jobName,
      errorMessage,
      JSON.stringify(metadata),
    ]
  );
}

export async function startFetchRun(jobName) {
  const result = await query(
    `insert into data_fetch_runs (job_name, status, started_at)
     values ($1, 'running', now())
     returning id`,
    [jobName]
  );

  return result.rows[0].id;
}

export async function finishFetchRun(id, status, details = {}) {
  await query(
    `update data_fetch_runs set
      status = $2,
      finished_at = now(),
      total_items = $3,
      successful_items = $4,
      failed_items = $5,
      error_message = $6,
      metadata = $7
     where id = $1`,
    [
      id,
      status,
      details.totalItems ?? null,
      details.successfulItems ?? null,
      details.failedItems ?? null,
      details.errorMessage ?? null,
      details.metadata ? JSON.stringify(details.metadata) : null,
    ]
  );
}
