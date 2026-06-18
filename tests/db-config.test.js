import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPoolConfig, getDatabaseTarget, getDatabaseUrl } from '../lib/db.js';

test('getDatabaseTarget falls back to default', () => {
  assert.equal(getDatabaseTarget({}), 'default');
  assert.equal(getDatabaseTarget({ DATABASE_TARGET: '   ' }), 'default');
});

test('getDatabaseUrl uses DATABASE_URL for the implicit standard target', () => {
  const env = {
    DATABASE_URL: 'postgresql://default-user:pw@default-host/defaultdb?sslmode=require',
  };

  assert.equal(
    getDatabaseUrl(env),
    'postgresql://default-user:pw@default-host/defaultdb?sslmode=require'
  );
});

test('getDatabaseUrl uses a named database target when configured', () => {
  const env = {
    DATABASE_TARGET: 'cockroach',
    DATABASE_URL: 'postgresql://default-user:pw@default-host/defaultdb?sslmode=require',
    DATABASE_URL_COCKROACH: 'postgresql://cockroach-user:pw@cockroach-host/stock_signals?sslmode=verify-full',
  };

  assert.equal(
    getDatabaseUrl(env),
    'postgresql://cockroach-user:pw@cockroach-host/stock_signals?sslmode=verify-full'
  );
});

test('getDatabaseUrl throws when the selected named target is missing', () => {
  assert.throws(
    () => getDatabaseUrl({ DATABASE_TARGET: 'cockroach', DATABASE_URL: 'postgresql://default-user:pw@default-host/defaultdb?sslmode=require' }),
    /DATABASE_URL_COCKROACH is missing/i
  );
});

test('buildPoolConfig strips sslrootcert when the referenced file is missing in the current runtime', () => {
  const env = {
    DATABASE_TARGET: 'cockroach',
    DATABASE_URL_COCKROACH: 'postgresql://cockroach-user:pw@cockroach-host/stock_signals?sslmode=verify-full&sslrootcert=C:/Users/ryd/AppData/Roaming/postgresql/root.crt',
  };

  assert.deepEqual(buildPoolConfig(env, { fileExists: () => false }), {
    connectionString: 'postgresql://cockroach-user:pw@cockroach-host/stock_signals?sslmode=verify-full',
  });
});

test('buildPoolConfig keeps sslrootcert when the referenced file exists', () => {
  const env = {
    DATABASE_TARGET: 'cockroach',
    DATABASE_URL_COCKROACH: 'postgresql://cockroach-user:pw@cockroach-host/stock_signals?sslmode=verify-full&sslrootcert=C:/Users/ryd/AppData/Roaming/postgresql/root.crt',
  };

  assert.deepEqual(buildPoolConfig(env, { fileExists: () => true }), {
    connectionString: 'postgresql://cockroach-user:pw@cockroach-host/stock_signals?sslmode=verify-full&sslrootcert=C:/Users/ryd/AppData/Roaming/postgresql/root.crt',
  });
});

test('buildPoolConfig adds a permissive SSL fallback for remote URLs without explicit SSL settings', () => {
  const env = {
    DATABASE_TARGET: 'default',
    DATABASE_URL: 'postgresql://default-user:pw@remote-host/defaultdb',
  };

  assert.deepEqual(buildPoolConfig(env), {
    connectionString: 'postgresql://default-user:pw@remote-host/defaultdb',
    ssl: { rejectUnauthorized: false },
  });
});

test('buildPoolConfig leaves localhost URLs without an injected SSL fallback', () => {
  const env = {
    DATABASE_TARGET: 'default',
    DATABASE_URL: 'postgresql://local-user:pw@localhost:5432/localdb',
  };

  assert.deepEqual(buildPoolConfig(env), {
    connectionString: 'postgresql://local-user:pw@localhost:5432/localdb',
  });
});
