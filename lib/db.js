import fs from 'node:fs';
import pg from 'pg';
import { ensureEnvLoaded } from './env.js';

const { Pool } = pg;

let pool;

function isLocalDatabaseHost(hostname) {
  const normalized = hostname?.trim().toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
}

function toDatabaseUrlEnvKey(target) {
  if (target === 'default') {
    return 'DATABASE_URL';
  }

  const suffix = target
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

  return `DATABASE_URL_${suffix}`;
}

export function getDatabaseTarget(env = process.env) {
  const target = env.DATABASE_TARGET?.trim().toLowerCase();
  return target || 'cockroach';
}

export function getDatabaseUrl(env = process.env) {
  const target = getDatabaseTarget(env);
  const envKey = toDatabaseUrlEnvKey(target);
  const databaseUrl = env[envKey]?.trim();

  if (!databaseUrl) {
    if (target === 'default') {
      throw new Error('DATABASE_URL is missing. Add it to .env.local or your environment.');
    }

    throw new Error(
      `${envKey} is missing for DATABASE_TARGET=${target}. Add it to .env.local or your environment.`
    );
  }

  return databaseUrl;
}

function normalizeConnectionString(connectionString, { fileExists = fs.existsSync } = {}) {
  const databaseUrl = new URL(connectionString);
  const sslRootCertPath = databaseUrl.searchParams.get('sslrootcert')?.trim();

  if (!sslRootCertPath || fileExists(sslRootCertPath)) {
    return connectionString;
  }

  databaseUrl.searchParams.delete('sslrootcert');
  return databaseUrl.toString();
}

export function buildPoolConfig(env = process.env, options = {}) {
  const connectionString = normalizeConnectionString(getDatabaseUrl(env), options);
  const databaseUrl = new URL(connectionString);
  const hasExplicitSslConfig =
    databaseUrl.searchParams.has('sslmode') ||
    databaseUrl.searchParams.has('sslrootcert') ||
    databaseUrl.searchParams.has('sslcert') ||
    databaseUrl.searchParams.has('sslkey');

  if (hasExplicitSslConfig || isLocalDatabaseHost(databaseUrl.hostname)) {
    return { connectionString };
  }

  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
  };
}

export function getPool() {
  ensureEnvLoaded();

  if (!pool) {
    pool = new Pool(buildPoolConfig());
  }

  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
