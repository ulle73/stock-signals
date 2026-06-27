import { query } from '../db.js';

export function buildInsertSignalStudyResultStatement(record) {
  return {
    sql: `insert into signal_study_results (
      id,
      slug,
      study_name,
      study_type,
      return_instrument,
      signal_instrument,
      config_path,
      payload_json,
      created_at
    ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
    params: [
      record.id,
      record.slug,
      record.studyName,
      record.studyType,
      record.returnInstrument,
      record.signalInstrument,
      record.configPath,
      JSON.stringify(record.payloadJson),
      record.createdAt,
    ],
  };
}

function mapSignalStudyResultRow(row = {}) {
  return {
    id: row.id,
    slug: row.slug,
    studyName: row.study_name,
    studyType: row.study_type,
    returnInstrument: row.return_instrument,
    signalInstrument: row.signal_instrument,
    configPath: row.config_path,
    payloadJson: row.payload_json,
    createdAt: row.created_at,
  };
}

export async function saveSignalStudyResult(record, { execute = query } = {}) {
  const statement = buildInsertSignalStudyResultStatement(record);
  await execute(statement.sql, statement.params);
  return record;
}

export async function getLatestSignalStudyResultBySlug(slug, { execute = query } = {}) {
  const result = await execute(
    `select
       id,
       slug,
       study_name,
       study_type,
       return_instrument,
       signal_instrument,
       config_path,
       payload_json,
       created_at
     from signal_study_results
     where slug = $1
     order by created_at desc, id desc
     limit 1`,
    [slug]
  );

  return result.rows[0] ? mapSignalStudyResultRow(result.rows[0]) : null;
}
