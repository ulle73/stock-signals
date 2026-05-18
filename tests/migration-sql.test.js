import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitSqlStatements,
  shouldUseCockroachMigrationCompatibility,
  transformMigrationSqlForCockroach,
} from '../lib/utils/migration-sql.js';

test('shouldUseCockroachMigrationCompatibility detects Cockroach from the selected connection string', () => {
  assert.equal(
    shouldUseCockroachMigrationCompatibility({
      DATABASE_TARGET: 'cockroach',
      DATABASE_URL_COCKROACH: 'postgresql://user:pw@cluster-name.aws-us-east-1.cockroachlabs.cloud:26257/defaultdb?sslmode=verify-full',
    }),
    true
  );

  assert.equal(
    shouldUseCockroachMigrationCompatibility({
      DATABASE_TARGET: 'default',
      DATABASE_URL: 'postgresql://user:pw@ep-name.us-east-1.aws.neon.tech/neondb?sslmode=require',
    }),
    false
  );
});

test('transformMigrationSqlForCockroach converts add-constraint DO blocks into rerunnable constraint statements', () => {
  const source = `create table if not exists demo (
  value text not null
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'demo_value_check'
      and conrelid = 'public.demo'::regclass
  ) then
    alter table demo
      add constraint demo_value_check
      check (value in ('a', 'b'));
  end if;
end
$$;`;

  const transformed = transformMigrationSqlForCockroach(source);

  assert.match(transformed, /create table if not exists demo/i);
  assert.match(transformed, /alter table demo\s+drop constraint if exists demo_value_check/i);
  assert.match(transformed, /alter table demo\s+add constraint demo_value_check\s+check \(value in \('a', 'b'\)\)/i);
  assert.doesNotMatch(transformed, /do \$\$/i);
  assert.doesNotMatch(transformed, /pg_constraint/i);
});

test('transformMigrationSqlForCockroach drops legacy rename DO blocks that are only needed for old schemas', () => {
  const source = `do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'benchmark_daily_prices'
      and column_name = 'symbol'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'benchmark_daily_prices'
      and column_name = 'ticker'
  ) then
    alter table benchmark_daily_prices rename column symbol to ticker;
  end if;
end
$$;`;

  const transformed = transformMigrationSqlForCockroach(source);

  assert.equal(transformed.trim(), '');
});

test('splitSqlStatements splits transformed Cockroach SQL into sequential statements', () => {
  const source = `alter table backtest_runs
  add column if not exists out_of_market_mode text,
  add column if not exists rule_source text;

update backtest_runs
set rule_source = 'a;b'
where rule_source is null;

alter table backtest_runs
  alter column rule_source set not null;`;

  assert.deepEqual(splitSqlStatements(source), [
    `alter table backtest_runs
  add column if not exists out_of_market_mode text,
  add column if not exists rule_source text`,
    `update backtest_runs
set rule_source = 'a;b'
where rule_source is null`,
    `alter table backtest_runs
  alter column rule_source set not null`,
  ]);
});
