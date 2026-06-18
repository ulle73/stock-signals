import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';

ensureEnvLoaded();

console.log('build:ticker-sparkline-cache placeholder');

await closePool();
