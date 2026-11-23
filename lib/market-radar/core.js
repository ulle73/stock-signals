// Market Radar v1: descriptive research states, never trading instructions.
// Pure calculations over already stored observations.
const n = (x) => x == null || x === '' ? null : Number.isFinite(Number(x)) ? Number(x) : null;
const r = (x, digits = 2) => x == null ? null : Number(x.toFixed(digits));
const ordered = (rows = []) => [...rows].filter((x) => x.date).sort((a, b) => a.date.localeCompare(b.date));
const latestDate = (rows) => rows.at(-1)?.date ?? null;

function sma(values) {
  return values.reduce((sum, x) => sum + x, 0) / values.length;
}

function recentEnough(date, asOf, maxDays) {
  if (!date || !asOf) return false;
  const diff = (Date.parse(asOf + 'T00:00:00Z') - Date.parse(date + 'T00:00:00Z')) / 86400000;
  return Number.isFinite(diff) && diff >= 0 && diff <= maxDays;
}

export function calculateRsi2(prices) {
  if (prices.length < 4) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= 2; i++) {
    const d = prices[i] - prices[i - 1];
    gain += Math.max(0, d);
    loss += Math.max(0, -d);
  }
  gain /= 2;
  loss /= 2;
  for (let i = 3; i < prices.length; i++) {
    const d = prices[i] - prices[i - 1];
    gain = (gain + Math.max(0, d)) / 2;
    loss = (loss + Math.max(0, -d)) / 2;
  }
  if (loss === 0) return gain === 0 ? 50 : 100;
  return 100 - 100 / (1 + gain / loss);
}

function analyzePrice(rows, asOf) {
  const valid = ordered(rows).filter((x) => n(x.close) > 0 && x.date <= asOf);
  const close = valid.map((x) => Number(x.close));
  const current = close.at(-1);
  const currentMonth = asOf.slice(0, 7);
  const ends = new Map();
  for (const item of valid) {
    if (item.date.slice(0, 7) < currentMonth) ends.set(item.date.slice(0, 7), Number(item.close));
  }
  const completed = [...ends.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const recent10 = completed.slice(-10);
  const monthClose = recent10.at(-1)?.[1] ?? null;
  const sma10 = recent10.length === 10 ? sma(recent10.map((x) => x[1])) : null;
  const last200 = close.slice(-200);
  const sma200 = last200.length === 200 ? sma(last200) : null;
  const highest252 = close.length >= 252 ? Math.max(...close.slice(-252)) : null;
  const dd252 = highest252 ? (current / highest252 - 1) * 100 : null;
  const rsi2 = calculateRsi2(close);
  const prevRsi = close.length >= 9 ? calculateRsi2(close.slice(0, -1)) : null;
  const reversal5 = close.length > 5 ? current > Math.max(...close.slice(-6, -1)) : false;
  const wasOversold5 = close.length > 10 && Array.from({ length: 5 }, (_, i) =>
    calculateRsi2(close.slice(0, close.length - i - 1))
  ).some((v) => v !== null && v <= 10);
  return {
    date: latestDate(valid),
    close: r(current), sma10: r(sma10), sma200: r(sma200),
    monthClose: r(monthClose), completedMonth: recent10.at(-1)?.[0] ?? null,
    trend: sma10 == null ? 'unknown' : monthClose > sma10 ? 'positive' : 'negative',
    priceVs200: sma200 == null ? null : r((current / sma200 - 1) * 100),
    rsi2: r(rsi2, 1), prevRsi2: r(prevRsi, 1),
    drawdown252: r(dd252, 1), reversal5, wasOversold5
  };
}

function analyzeBreadth(rows, asOf) {
  const valid = ordered(rows).filter((x) => x.is_valid_signal_date === true && x.date <= asOf && n(x.pct_above_sma50) != null);
  const last = valid.at(-1);
  if (!last || !recentEnough(last.date, asOf, 0)) return { state: 'unknown', date: last?.date ?? null };
  const fiveAgo = valid.at(-6);
  const delta5 = fiveAgo ? n(last.pct_above_sma50) - n(fiveAgo.pct_above_sma50) : null;
  const delta200 = valid.length >= 21 ? n(last.pct_above_sma200) - n(valid.at(-21).pct_above_sma200) : null;
  const state = delta5 == null ? 'unknown' : delta5 >= 5 ? 'improving' : delta5 <= -5 ? 'weakening' : 'stable';
  return {
    state, date: last.date, pct20: r(n(last.pct_above_sma20), 1),
    pct50: r(n(last.pct_above_sma50), 1),
    pct200: r(n(last.pct_above_sma200), 1),
    delta5: r(delta5, 1), delta20020: r(delta200, 1),
    validCount: n(last.valid_sma200_count)
  };
}

function analyzeCredit(rows, asOf) {
  const valid = ordered(rows).filter((x) => x.date <= asOf && n(x.value) != null);
  const last = valid.at(-1);
  if (!last || !recentEnough(last.date, asOf, 5)) return { state: 'unknown', date: last?.date ?? null };
  const prior = valid.at(-21);
  const change20 = prior ? Number(last.value) - Number(prior.value) : null;
  return {
    date: last.date, value: r(Number(last.value)), change20: r(change20),
    state: change20 == null ? 'unknown' : change20 >= 0.20 ? 'stress_rising' : change20 <= -0.20 ? 'stress_easing' : 'stable'
  };
}

function monthIndex(date) {
  const [year, month] = date.slice(0, 7).split('-').map(Number);
  return year * 12 + month;
}

function analyzeMacro(series, asOf) {
  function delta3(id) {
    const rows = ordered(series[id] ?? []).filter((x) => x.date <= asOf && n(x.value) != null);
    const latest = rows.at(-1);
    if (!latest || !recentEnough(latest.date, asOf, 100) || rows.length < 4 || monthIndex(latest.date) - monthIndex(rows.at(-4).date) !== 3) return null;
    return { date: latest.date, value: Number(latest.value), change3: Number(latest.value) - Number(rows.at(-4).value) };
  }
  const jobs = delta3('UNRATE'), sentiment = delta3('UMCSENT');
  const jobScore = !jobs ? null : jobs.change3 >= 0.2 ? -1 : jobs.change3 <= -0.2 ? 1 : 0;
  const sentimentScore = !sentiment ? null : sentiment.change3 >= 3 ? 1 : sentiment.change3 <= -3 ? -1 : 0;
  let state = 'unknown';
  if (jobScore != null && sentimentScore != null) {
    const total = jobScore + sentimentScore;
    state = total > 0 ? 'improving' : total < 0 ? 'weakening' :
      jobScore !== sentimentScore ? 'mixed' : 'stable';
  }
  const cpi = ordered(series.CPIAUCSL ?? []).filter((x) => x.date <= asOf && n(x.value) > 0);
  const latestCpi = cpi.at(-1);
  let inflation = { state: 'unknown', date: latestCpi?.date ?? null };
  if (cpi.length >= 7 && recentEnough(latestCpi.date, asOf, 100) && monthIndex(latestCpi.date) - monthIndex(cpi.at(-7).date) === 6) {
    const a = cpi.map((x) => Number(x.value));
    const now = ((a.at(-1) / a.at(-4)) ** 4 - 1) * 100;
    const prev = ((a.at(-4) / a.at(-7)) ** 4 - 1) * 100;
    const diff = now - prev;
    inflation = { state: diff >= .5 ? 'accelerating' : diff <= -.5 ? 'decelerating' : 'stable',
      date: latestCpi.date, annualized3m: r(now, 1), prior3m: r(prev, 1), change: r(diff, 1) };
  }
  return {
    state, quality: 'provisional_not_point_in_time', // revised series; not validated as-of.
    jobs: jobs && { date: jobs.date, value: r(jobs.value, 1), change3: r(jobs.change3, 1) },
    sentiment: sentiment && { date: sentiment.date, value: r(sentiment.value, 1), change3: r(sentiment.change3, 1) },
    inflation
  };
}

export function buildMarketRadar(input) {
  const spyRows = ordered(input.prices?.SPY ?? []);
  const asOf = spyRows.at(-1)?.date ?? null;
  if (!asOf) throw new Error('Missing SPY benchmark candles');
  const spy = analyzePrice(spyRows, asOf);
  const qqq = analyzePrice(input.prices?.QQQ ?? [], asOf);
  const breadth = analyzeBreadth(input.breadth ?? [], asOf);
  const credit = analyzeCredit(input.series?.BAMLH0A0HYM2 ?? [], asOf);
  const macro = analyzeMacro(input.series ?? {}, asOf);
  const extreme = spy.rsi2 != null && spy.rsi2 <= 5 || spy.drawdown252 != null && spy.drawdown252 <= -15;
  const recovery = spy.wasOversold5 && spy.reversal5 && breadth.state === 'improving';
  const watch = recovery ? 'recovery_watch' : extreme ? 'oversold_watch' : 'none';
  let climate = 'unknown';
  if (spy.trend !== 'unknown' && breadth.state !== 'unknown') {
    if (spy.trend === 'negative' && breadth.state === 'weakening') climate = 'deteriorating';
    else if (spy.trend === 'negative' && breadth.state === 'improving') climate = 'stabilizing';
    else if (spy.trend === 'positive' && (breadth.state === 'weakening' || credit.state === 'stress_rising')) climate = 'early_warning';
    else if (spy.trend === 'positive') climate = 'positive_trend';
    else climate = 'negative_trend';
  }
  return {
    date: asOf, version: 'radar-v1-research', climate, watch,
    trend: { state: spy.trend, spy, qqq },
    breadth, credit, macro,
    quality: {
      pmiExcluded: true, // TE source currently stores scrape-month instead of observation period
      macroProvisional: true,
      breadthFresh: breadth.state !== 'unknown',
      creditFresh: credit.state !== 'unknown',
      latestDataDate: asOf
    }
  };
}

// Two stored daily states are required before noisy breadth/credit transitions alert.
export function buildRadarChanges(snapshot, previous = []) {
  const recent = [...previous].filter((x) => x?.date < snapshot.date).sort((a, b) => a.date.localeCompare(b.date));
  const p1 = recent.at(-1), p2 = recent.at(-2);
  if (!p1) return [];
  const events = [];
  function add(type, from, to, confirmed = true) {
    if (confirmed && to && to !== 'unknown' && from && from !== 'unknown' && to !== from) {
      events.push({ id: snapshot.date + ':' + type + ':' + to, date: snapshot.date, type, from, to });
    }
  }
  add('long_trend', p1.trend?.state, snapshot.trend.state);
  add('oversold_watch', p1.watch, snapshot.watch, snapshot.watch !== 'none');
  for (const [type, key] of [['breadth', 'breadth'], ['credit', 'credit']]) {
    const earlier = p2?.[key]?.state, prior = p1[key]?.state, current = snapshot[key].state;
    // Alert on the second consecutive observation in the new state.
    if (p2 && earlier && earlier !== 'unknown' && prior !== earlier && prior === current) {
      events.push({ id: snapshot.date + ':' + type + ':' + current, date: snapshot.date, type, from: earlier, to: current });
    }
  }
  return events;
}

export function isMarketDataFresh(snapshot, today) {
  return recentEnough(snapshot.date, today, 4);
}
