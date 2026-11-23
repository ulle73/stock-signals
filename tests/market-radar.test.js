import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMarketRadar, buildRadarChanges, calculateRsi2, isMarketDataFresh } from '../lib/market-radar/core.js';
import { buildDiscordRadarAlert, buildDiscordRadarEmbed, formatRadarPlaintext } from '../lib/market-radar/discord.js';
import { sendRadarStatus } from '../lib/market-radar/webhook.js';

function marketInputs() {
  // Synthetic weekdays: enough history for SMA10, SMA200 and RSI(2).
  const dates = [];
  const start = Date.UTC(2024, 0, 1);
  for (let day = 0; dates.length < 420; day++) {
    const date = new Date(start + day * 86400000);
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) dates.push(date.toISOString().slice(0, 10));
  }
  const date = dates.at(-1);
  const price = dates.map((d, i) => ({ date: d, close: String(100 + i * 0.3) }));
  const breadth = dates.slice(-30).map((d, i) => ({
    date: d, pct_above_sma20: '40', pct_above_sma50: String(20 + i * 2),
    pct_above_sma200: '45', valid_sma200_count: 500, is_valid_signal_date: true
  }));
  const credit = dates.slice(-50).map((d, i) => ({ date: d, value: String(2.5 + i * 0.02) }));
  return { date, prices: { SPY: price, QQQ: price }, breadth, series: { BAMLH0A0HYM2: credit } };
}

test('Wilder RSI2 handles monotonic and flat price changes', () => {
  assert.equal(calculateRsi2([10, 9, 8, 7, 6]), 0);
  assert.equal(calculateRsi2([10, 11, 12, 13, 14]), 100);
  assert.equal(calculateRsi2([10, 10, 10, 10, 10]), 50);
});

test('Market Radar uses last complete SMA10 month and reports macro as provisional, not a buy instruction', () => {
  const inputs = marketInputs();
  const radar = buildMarketRadar(inputs);
  assert.equal(radar.date, inputs.date);
  assert.equal(radar.trend.state, 'positive');
  assert.notEqual(radar.trend.spy.completedMonth, radar.date.slice(0, 7));
  assert.equal(radar.breadth.state, 'improving');
  assert.equal(radar.credit.state, 'stress_rising');
  assert.equal(radar.macro.state, 'unknown');
  assert.equal(radar.quality.pmiExcluded, true);
  assert.equal(radar.quality.macroProvisional, true);
  assert.equal(radar.watch, 'none');
  const plaintext = formatRadarPlaintext(radar);
  assert.match(plaintext, /Inga automatiska köp\/sälj/);
  const embed = buildDiscordRadarEmbed(radar);
  assert.equal(embed.embeds[0].fields.length, 5);
  assert.match(embed.embeds[0].footer.text, /PMI exkluderat/);
});

test('latest invalid breadth cannot masquerade as fresh market confirmation', () => {
  const inputs = marketInputs();
  inputs.breadth.at(-1).is_valid_signal_date = false;
  const radar = buildMarketRadar(inputs);
  assert.equal(radar.breadth.state, 'unknown');
  assert.equal(radar.quality.breadthFresh, false);
});

test('one new noisy breadth reading does not trigger an alert; second day does', () => {
  const base = { trend: { state: 'negative' }, watch: 'none', credit: { state: 'stable' } };
  const p2 = { ...base, date: '2026-11-16', breadth: { state: 'weakening' } };
  const p1 = { ...base, date: '2026-11-17', breadth: { state: 'improving' } };
  const p0 = { ...base, date: '2026-11-18', breadth: { state: 'improving' } };
  assert.equal(buildRadarChanges(p1, [p2]).length, 0);
  assert.deepEqual(buildRadarChanges(p0, [p2, p1]).map((x) => x.type), ['breadth']);
});

test('a real monthly long-trend change is reported but not translated to BUY', () => {
  const p1 = { date: '2026-10-30', trend: { state: 'positive' }, breadth: { state: 'stable' },
    credit: { state: 'stable' }, watch: 'none' };
  const p0 = { date: '2026-11-02', trend: { state: 'negative' }, breadth: { state: 'stable' },
    credit: { state: 'stable' }, watch: 'none' };
  const events = buildRadarChanges(p0, [p1]);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'long_trend');
  assert.equal(events[0].to, 'negative');
});

test('data age cutoff prevents stale Discord status', () => {
  assert.equal(isMarketDataFresh({ date: '2026-11-20' }, '2026-11-23'), true);
  assert.equal(isMarketDataFresh({ date: '2026-11-17' }, '2026-11-23'), false);
});

test('Discord webhook edits the existing status instead of posting another', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push({ url, method: init.method });
    return { ok: true, status: 200, json: async () => ({ id: '222' }) };
  };
  const url = 'https://discord.com/api/webhooks/111/secret_token';
  const result = await sendRadarStatus(url, { embeds: [{ title: 'RADAR' }] }, '222', fakeFetch);
  assert.deepEqual(result, { messageId: '222', edited: true });
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/messages\/222$/);
  assert.equal(calls[0].method, 'PATCH');
});

test('Discord webhook recreates an accidentally deleted status post', async () => {
  const calls = [];
  const fakeFetch = async (url, init) => {
    calls.push(init.method);
    if (init.method === 'PATCH') return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => ({ id: '333' }) };
  };
  const result = await sendRadarStatus('https://discord.com/api/webhooks/111/secret_token', { embeds: [] }, '222', fakeFetch);
  assert.deepEqual(result, { messageId: '333', edited: false });
  assert.deepEqual(calls, ['PATCH', 'POST']);
});

test('Unsafe webhook destinations are rejected', async () => {
  await assert.rejects(sendRadarStatus('https://example.com/api/webhooks/111/token', { embeds: [] }));
  await assert.rejects(sendRadarStatus('', { embeds: [] }));
});

test('Weekly recap reports a change over time and states its research limitation', () => {
  const embed = buildDiscordRadarAlert({ date: '2026-11-20', watch: 'none' }, {
    type: 'weekly_digest', from: 'deteriorating', to: 'stabilizing', beforeDate: '2026-11-13', breadthChange: 10
  });
  assert.match(embed.embeds[0].description, /Veck|MA50-bredd/);
  assert.match(embed.embeds[0].description, /\+10,0 pp/);
});
