import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { buildMarketRadar, buildRadarChanges, isMarketDataFresh } from '../lib/market-radar/core.js';
import { buildDiscordRadarAlert, buildDiscordRadarEmbed, formatRadarPlaintext } from '../lib/market-radar/discord.js';
import { sendRadarAlert, sendRadarStatus } from '../lib/market-radar/webhook.js';
import {
  getPendingRadarAlerts, loadMarketRadarInputs, loadRadarDelivery,
  loadRadarPreviousSnapshots, markRadarAlertSent, queueRadarAlerts,
  saveRadarDelivery, saveRadarSnapshot
} from '../lib/repositories/market-radar.js';

ensureEnvLoaded();
const publish = process.argv.includes('--publish');

async function run() {
  const snapshot = buildMarketRadar(await loadMarketRadarInputs());
  console.log(formatRadarPlaintext(snapshot));

  if (!publish) {
    console.log('\nPreview only. No database writes or Discord messages.');
    return;
  }

  const webhook = process.env.DISCORD_MARKET_RADAR_WEBHOOK_URL;
  if (!webhook) throw new Error('Configure DISCORD_MARKET_RADAR_WEBHOOK_URL in GitHub Actions secrets');
  const today = new Date().toISOString().slice(0, 10);
  if (!isMarketDataFresh(snapshot, today)) {
    throw new Error('Refusing to publish stale SPY benchmark: last=' + snapshot.date + ', now=' + today);
  }
  if (!snapshot.quality.breadthFresh) {
    throw new Error('Refusing to publish: latest valid breadth does not match SPY benchmark date');
  }

  const previous = await loadRadarPreviousSnapshots(snapshot.date);
  const changes = buildRadarChanges(snapshot, previous);
  // Publish/update exactly one status post; do not flood Discord every day.
  const currentMessageId = await loadRadarDelivery();
  const status = await sendRadarStatus(webhook, buildDiscordRadarEmbed(snapshot), currentMessageId);
  await saveRadarDelivery(status.messageId);

  // Changes are a separate research channel in DB, never order/execution events.
  await saveRadarSnapshot(snapshot);
  // Weekly digest on Saturday UTC, after Friday US market fetch.
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay();
  if (weekday === 6 && previous.length) {
    const before = previous[0];
    changes.push({
      id: 'weekly:' + snapshot.date, date: snapshot.date, type: 'weekly_digest',
      from: before.climate, to: snapshot.climate, beforeDate: before.date,
      breadthChange: snapshot.breadth.pct50 == null || before.breadth?.pct50 == null
        ? null : Number((snapshot.breadth.pct50 - before.breadth.pct50).toFixed(1))
    });
  }
  await queueRadarAlerts(changes);
  for (const row of await getPendingRadarAlerts(snapshot.date)) {
    await sendRadarAlert(webhook, buildDiscordRadarAlert(snapshot, row.payload));
    await markRadarAlertSent(row.id);
    console.log('Sent change alert: ' + row.id);
  }
  console.log('Discord status ' + (status.edited ? 'updated' : 'created') + ', market date ' + snapshot.date);
}

run()
  .catch((error) => { console.error(error.message); process.exitCode = 1; })
  .finally(async () => closePool());
