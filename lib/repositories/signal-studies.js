import { query } from '../db.js';
import { getSignalStudyField } from '../signal-registry/fields.js';

const RETURN_PRICE_SOURCES = [
  {
    table: 'benchmark_daily_prices',
    instrumentField: 'ticker',
    priceExpression: 'coalesce(adj_close, close)',
  },
  {
    table: 'stock_daily_prices',
    instrumentField: 'ticker',
    priceExpression: 'coalesce(adj_close, close)',
  },
  {
    table: 'macro_matrix_yahoo_proxy_daily',
    instrumentField: 'symbol',
    priceExpression: 'coalesce(adj_close, close)',
  },
];

async function listExistingTables(tableNames) {
  if (!tableNames.length) {
    return new Set();
  }

  const result = await query(
    `select table_name
     from information_schema.tables
     where table_schema = 'public'
       and table_name = any($1::text[])`,
    [tableNames]
  );

  return new Set(result.rows.map((row) => row.table_name));
}

function buildDateRangeWhere({ dateField, startDate, endDate, params }) {
  const clauses = [];

  if (startDate) {
    params.push(startDate);
    clauses.push(`${dateField} >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate);
    clauses.push(`${dateField} <= $${params.length}`);
  }

  return clauses;
}

function parseFieldValue(field, value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (field.type === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  if (field.type === 'boolean') {
    return value === true || value === 'true';
  }

  return value;
}

function summarizeFieldCoverage(fieldKey, rows) {
  const nonNullRows = rows.filter((row) => row.value !== null && row.value !== undefined);
  return {
    fieldKey,
    rowCount: rows.length,
    nonNullCount: nonNullRows.length,
    firstValueDate: nonNullRows[0]?.date ?? null,
    lastValueDate: nonNullRows.at(-1)?.date ?? null,
  };
}

function requireField(key) {
  const field = getSignalStudyField(key);
  if (!field) {
    throw new Error(`Unknown signal study field: ${key}`);
  }

  return field;
}

export function collectSignalStudyFieldKeys(config) {
  const keys = new Set();

  for (const condition of config.conditions ?? []) {
    keys.add(condition.field);
  }

  if (config.stateField) {
    keys.add(config.stateField);
  }

  for (const filter of config.filters ?? []) {
    keys.add(filter.field);
  }

  return [...keys];
}

export async function getReturnInstrumentPriceRows(instrument, { startDate = null, endDate = null } = {}) {
  const existingTables = await listExistingTables(RETURN_PRICE_SOURCES.map((source) => source.table));
  const availableSources = RETURN_PRICE_SOURCES.filter((source) => existingTables.has(source.table));

  for (const source of availableSources) {
    const params = [instrument];
    const dateClauses = buildDateRangeWhere({
      dateField: 'date',
      startDate,
      endDate,
      params,
    });
    const whereClauses = [
      `${source.instrumentField} = $1`,
      `${source.priceExpression} is not null`,
      ...dateClauses,
    ];

    const result = await query(
      `select
         date::text as date,
         ${source.priceExpression}::text as price
       from ${source.table}
       where ${whereClauses.join(' and ')}
       order by date asc`,
      params
    );

    if (!result.rows.length) {
      continue;
    }

    return result.rows.map((row) => ({
      date: row.date,
      price: Number(row.price),
      sourceTable: source.table,
    }));
  }

  throw new Error(`No price rows found for instrument ${instrument}`);
}

export async function getSignalStudyFieldSeries(fieldKey, { signalInstrument = null, startDate = null, endDate = null } = {}) {
  const field = requireField(fieldKey);
  const params = [];
  const whereClauses = [];

  if (field.scope === 'ticker') {
    if (!signalInstrument) {
      throw new Error(`signalInstrument is required for ticker-scoped field ${field.key}`);
    }

    params.push(signalInstrument);
    whereClauses.push(`${field.tickerField} = $${params.length}`);
  }

  whereClauses.push(
    ...buildDateRangeWhere({
      dateField: field.dateField,
      startDate,
      endDate,
      params,
    })
  );

  const selectValue = field.selectExpression
    ? `${field.selectExpression} as value`
    : field.type === 'boolean'
      ? `${field.valueField} as value`
      : `${field.valueField}::text as value`;

  const result = await query(
    `select
       ${field.dateField}::text as date,
       ${selectValue}
     from ${field.sourceTable}
     ${whereClauses.length ? `where ${whereClauses.join(' and ')}` : ''}
     order by ${field.dateField} asc`,
    params
  );

  return result.rows.map((row) => ({
    date: row.date,
    value: parseFieldValue(field, row.value),
  }));
}

export async function buildSignalStudyDataset({
  returnInstrument,
  signalInstrument = null,
  fieldKeys = [],
  startDate = null,
  endDate = null,
}) {
  const resolvedSignalInstrument = signalInstrument ?? returnInstrument;
  const priceRows = await getReturnInstrumentPriceRows(returnInstrument, { startDate, endDate });

  if (!priceRows.length) {
    throw new Error(`No price rows available for ${returnInstrument}`);
  }

  const effectiveStartDate = startDate ?? priceRows[0].date;
  const effectiveEndDate = endDate ?? priceRows.at(-1)?.date ?? null;
  const uniqueFieldKeys = [...new Set(fieldKeys)];
  const fieldSeriesEntries = await Promise.all(
    uniqueFieldKeys.map(async (fieldKey) => ([
      fieldKey,
      await getSignalStudyFieldSeries(fieldKey, {
        signalInstrument: resolvedSignalInstrument,
        startDate: effectiveStartDate,
        endDate: effectiveEndDate,
      }),
    ]))
  );

  const seriesByFieldKey = new Map(
    fieldSeriesEntries.map(([fieldKey, rows]) => [fieldKey, new Map(rows.map((row) => [row.date, row.value]))])
  );
  const fieldCoverage = fieldSeriesEntries.map(([fieldKey, rows]) => summarizeFieldCoverage(fieldKey, rows));

  const bars = priceRows.map((row) => ({
    date: row.date,
    price: row.price,
    values: Object.fromEntries(
      uniqueFieldKeys.map((fieldKey) => [fieldKey, seriesByFieldKey.get(fieldKey)?.get(row.date) ?? null])
    ),
  }));

  return {
    returnInstrument,
    signalInstrument: resolvedSignalInstrument,
    priceRows,
    bars,
    fieldKeys: uniqueFieldKeys,
    fieldCoverage,
  };
}

export async function listSignalStudyReturnInstruments() {
  const existingTables = await listExistingTables(RETURN_PRICE_SOURCES.map((source) => source.table));
  const queryParts = [];

  if (existingTables.has('benchmark_daily_prices')) {
    queryParts.push(`select ticker as instrument, 'benchmark_daily_prices' as source_table from benchmark_daily_prices`);
  }

  if (existingTables.has('stock_daily_prices')) {
    queryParts.push(`select ticker as instrument, 'stock_daily_prices' as source_table from stock_daily_prices`);
  }

  if (existingTables.has('macro_matrix_yahoo_proxy_daily')) {
    queryParts.push(`select symbol as instrument, 'macro_matrix_yahoo_proxy_daily' as source_table from macro_matrix_yahoo_proxy_daily`);
  }

  if (!queryParts.length) {
    return [];
  }

  const result = await query(`
    with instruments as (
      ${queryParts.join('\nunion\n')}
    )
    select
      instrument,
      min(source_table) as primary_source_table,
      count(*)::int as source_count
    from instruments
    group by instrument
    order by instrument asc
  `);

  return result.rows.map((row) => ({
    instrument: row.instrument,
    primarySourceTable: row.primary_source_table,
    sourceCount: Number(row.source_count),
  }));
}
