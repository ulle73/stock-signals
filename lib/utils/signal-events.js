function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function sortRows(rows) {
  return [...rows].sort((left, right) => left.date.localeCompare(right.date));
}

function buildDirection(signal) {
  if (signal === 'risk_on') return 'bullish';
  if (signal === 'risk_off') return 'bearish';
  return 'neutral';
}

function buildSeverity(signal) {
  if (signal === 'risk_off') return 'high';
  if (signal === 'risk_on') return 'medium';
  return 'medium';
}

function buildSignalName(signal) {
  return `Market regime changed to ${signal}`;
}

function buildBreakoutSignalName(row) {
  return `${row.ticker} regime-gated breakout`;
}

export function buildMarketRegimeChangeSignalEvents(rows, options = {}) {
  const assetKey = options.assetKey ?? 'MARKET';
  const signalKey = options.signalKey ?? 'market_regime_change';
  const signalType = options.signalType ?? 'state_change';
  const timeframe = options.timeframe ?? 'daily';
  const category = options.category ?? 'market_regime';

  const sortedRows = sortRows(rows);
  const events = [];
  let previousSignalRow = null;

  for (const row of sortedRows) {
    if (!row.signal) {
      continue;
    }

    if (!previousSignalRow) {
      previousSignalRow = row;
      continue;
    }

    if (row.signal === previousSignalRow.signal) {
      previousSignalRow = row;
      continue;
    }

    events.push({
      event_date: row.date,
      asset_key: assetKey,
      ticker: null,
      signal_key: signalKey,
      signal_name: buildSignalName(row.signal),
      signal_type: signalType,
      timeframe,
      direction: buildDirection(row.signal),
      severity: buildSeverity(row.signal),
      category,
      channel_key: null,
      source_table: 'market_signal_daily',
      source_payload: {
        previous_signal: previousSignalRow.signal,
        signal: row.signal,
        previous_market_regime_score: toNumber(previousSignalRow.market_regime_score),
        market_regime_score: toNumber(row.market_regime_score),
        divergence_status: row.divergence_status ?? 'none',
        short_divergence_status: row.short_divergence_status ?? 'none',
      },
    });

    previousSignalRow = row;
  }

  return events;
}

export function buildRegimeGatedBreakoutSignalEvents(rows, options = {}) {
  const signalKey = options.signalKey ?? 'regime_gated_breakout_long';
  const signalType = options.signalType ?? 'entry_signal';
  const timeframe = options.timeframe ?? 'daily';
  const category = options.category ?? 'breakout';
  const channelKey = options.channelKey ?? 'breakout';

  return rows
    .filter((row) => row.decision === 'trigger' && row.qualifies === true)
    .sort((left, right) => {
      const dateCompare = left.date.localeCompare(right.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return String(left.ticker).localeCompare(String(right.ticker));
    })
    .map((row) => {
      const warningGateKeys = Array.isArray(row.row_values?.warning_gate_keys)
        ? row.row_values.warning_gate_keys
        : [];

      return {
        event_date: row.date,
        asset_key: row.ticker,
        ticker: row.ticker,
        signal_key: signalKey,
        signal_name: buildBreakoutSignalName(row),
        signal_type: signalType,
        timeframe,
        direction: 'bullish',
        severity: row.market_signal === 'risk_on' && row.data_quality_status === 'pass'
          ? 'high'
          : 'medium',
        category,
        channel_key: channelKey,
        source_table: 'regime_gated_breakout_daily',
        source_payload: {
          company_name: row.company_name ?? null,
          sector: row.sector ?? null,
          market_signal: row.market_signal ?? null,
          market_regime_score: toNumber(row.market_regime_score),
          sector_signal: row.sector_signal ?? null,
          breakout_20d_high: toNumber(row.breakout_20d_high),
          indicator_price: toNumber(row.indicator_price),
          relative_volume20: toNumber(row.relative_volume20),
          rs_63d_vs_spy: toNumber(row.rs_63d_vs_spy),
          rs_rank_63d: row.rs_rank_63d ?? null,
          rs_percentile_63d: toNumber(row.rs_percentile_63d),
          data_quality_status: row.data_quality_status ?? null,
          warning_gate_keys: warningGateKeys,
          reason_summary: row.reason_summary ?? null,
          setup_score: row.setup_score ?? null,
          earnings_filter_status: row.row_values?.earnings_filter_status ?? 'not_available',
          earnings_reason: row.row_values?.earnings_reason ?? null,
          earnings_date: row.row_values?.earnings_date ?? null,
          days_to_earnings: row.row_values?.days_to_earnings ?? null,
          earnings_confirmed: row.row_values?.earnings_confirmed ?? null,
        },
      };
    });
}
