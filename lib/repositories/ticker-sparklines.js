import { query } from '../db.js';

export async function getTickerSparklinesForTickers() {
  await query('select 1');
  return new Map();
}
