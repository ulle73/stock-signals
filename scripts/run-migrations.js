import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool, query } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import {
  splitSqlStatements,
  shouldUseCockroachMigrationCompatibility,
  transformMigrationSqlForCockroach,
} from '../lib/utils/migration-sql.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');

ensureEnvLoaded();

async function ensureSchemaMigrationsTable() {
  await query(`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`);
}

async function getAppliedMigrationFilenames() {
  const result = await query(
    `select filename
     from schema_migrations`
  );

  return new Set(result.rows.map((row) => row.filename));
}

async function markMigrationApplied(filename) {
  await query(
    `insert into schema_migrations (filename)
     values ($1)
     on conflict (filename) do nothing`,
    [filename]
  );
}

async function run() {
  const migrationCompatibilityMode = shouldUseCockroachMigrationCompatibility()
    ? 'cockroach'
    : 'default';
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  await ensureSchemaMigrationsTable();
  const appliedMigrations = await getAppliedMigrationFilenames();

  for (const file of files) {
    if (appliedMigrations.has(file)) {
      console.log(`Skipping migration: ${file} (already applied)`);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sourceSql = await fs.readFile(fullPath, 'utf8');
    const sql = migrationCompatibilityMode === 'cockroach'
      ? transformMigrationSqlForCockroach(sourceSql)
      : sourceSql;
    console.log(`Running migration: ${file}`);

    if (sql.trim()) {
      if (migrationCompatibilityMode === 'cockroach') {
        const statements = splitSqlStatements(sql);
        for (const statement of statements) {
          await query(statement);
        }
      } else {
        await query(sql);
      }
    }

    await markMigrationApplied(file);
  }

  console.log('Migrations completed.');
}

run()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
