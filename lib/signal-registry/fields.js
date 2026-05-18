const NUMBER_OPERATORS = ['=', '!=', '>', '>=', '<', '<=', 'between', 'crossed_above', 'crossed_below'];
const BOOLEAN_OPERATORS = ['=', '!=', 'changed_to', 'changed_from', 'is_true', 'is_false'];
const ENUM_OPERATORS = ['=', '!=', 'changed_to', 'changed_from'];

function numberField(key, label, sourceTable, valueField, options = {}) {
  return {
    key,
    label,
    sourceTable,
    dateField: options.dateField ?? 'date',
    valueField,
    type: 'number',
    allowedOperators: options.allowedOperators ?? NUMBER_OPERATORS,
    scope: options.scope ?? 'global',
    tickerField: options.tickerField ?? null,
    requiredColumns: options.requiredColumns ?? [],
  };
}

function booleanField(key, label, sourceTable, valueField, options = {}) {
  return {
    key,
    label,
    sourceTable,
    dateField: options.dateField ?? 'date',
    valueField,
    type: 'boolean',
    allowedOperators: options.allowedOperators ?? BOOLEAN_OPERATORS,
    scope: options.scope ?? 'global',
    tickerField: options.tickerField ?? null,
    requiredColumns: options.requiredColumns ?? [],
  };
}

function enumField(key, label, sourceTable, valueField, possibleOptions, options = {}) {
  return {
    key,
    label,
    sourceTable,
    dateField: options.dateField ?? 'date',
    valueField,
    type: 'enum',
    allowedOperators: options.allowedOperators ?? ENUM_OPERATORS,
    possibleOptions,
    scope: options.scope ?? 'global',
    tickerField: options.tickerField ?? null,
    selectExpression: options.selectExpression ?? null,
    requiredColumns: options.requiredColumns ?? [],
  };
}

export const SIGNAL_STUDY_FIELDS = [
  numberField('position.target_equity_weight_pct', 'Position target equity weight %', 'position_signal_daily', 'target_equity_weight_pct'),
  enumField('position.signal', 'Position signal', 'position_signal_daily', 'signal', ['risk_on', 'risk_caution', 'risk_off']),
  numberField('market.pct_above_50', 'Market % above SMA50', 'market_signal_daily', 'pct_above_50'),
  numberField('market.vix', 'Market VIX', 'market_signal_daily', 'vix'),
  enumField('market.signal', 'Market signal', 'market_signal_daily', 'signal', ['risk_on', 'warning', 'risk_caution', 'risk_off']),
  enumField('trading.target_state', 'Trading target state', 'trading_signal_daily', 'target_state', ['long', 'cash', 'short']),
  enumField('trading.previous_state', 'Trading previous state', 'trading_signal_daily', 'previous_state', ['long', 'cash', 'short']),

  booleanField('stock.ryd_obv_buy_signal', 'Stock RYD OBV buy signal', 'stock_daily_indicators', 'ryd_obv_buy_signal', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('stock.ryd_obv_sell_signal', 'Stock RYD OBV sell signal', 'stock_daily_indicators', 'ryd_obv_sell_signal', { scope: 'ticker', tickerField: 'ticker' }),
  enumField('stock.ryd_obv_signal', 'Stock RYD OBV signal', 'stock_daily_indicators', 'ryd_obv_signal', ['buy', 'sell', 'none'], { scope: 'ticker', tickerField: 'ticker' }),

  booleanField('stock.price_zscore_buy_signal', 'Stock price z-score buy signal', 'stock_daily_indicators', 'price_zscore_buy_signal', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('stock.price_zscore_sell_signal', 'Stock price z-score sell signal', 'stock_daily_indicators', 'price_zscore_sell_signal', { scope: 'ticker', tickerField: 'ticker' }),
  enumField('stock.price_zscore_signal', 'Stock price z-score signal', 'stock_daily_indicators', 'price_zscore_signal', ['buy', 'sell', 'none'], { scope: 'ticker', tickerField: 'ticker' }),
  numberField('stock.price_zscore_20', 'Stock price z-score 20', 'stock_daily_indicators', 'price_zscore_20', { scope: 'ticker', tickerField: 'ticker' }),
  numberField('stock.price_zscore_avg_20', 'Stock price z-score avg 20', 'stock_daily_indicators', 'price_zscore_avg_20', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('zscore.buy_signal', 'Z-score buy signal', 'stock_daily_indicators', 'price_zscore_buy_signal', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('zscore.sell_signal', 'Z-score sell signal', 'stock_daily_indicators', 'price_zscore_sell_signal', { scope: 'ticker', tickerField: 'ticker' }),

  booleanField('stock.ibs_rsi_buy_signal', 'Stock IBS + RSI buy signal', 'stock_daily_indicators', 'ibs_rsi_buy_signal', { scope: 'ticker', tickerField: 'ticker' }),
  enumField('stock.ibs_rsi_signal', 'Stock IBS + RSI signal', 'stock_daily_indicators', 'ibs_rsi_signal', ['buy', 'none'], { scope: 'ticker', tickerField: 'ticker' }),
  numberField('stock.ibs_value', 'Stock IBS value', 'stock_daily_indicators', 'ibs_value', { scope: 'ticker', tickerField: 'ticker' }),
  numberField('stock.rsi14', 'Stock RSI14', 'stock_daily_indicators', 'rsi14', { scope: 'ticker', tickerField: 'ticker' }),

  booleanField('stock.macd_v_buy_signal', 'Stock MACD-V buy signal', 'stock_daily_indicators', 'macd_v_buy_signal', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('stock.macd_v_sell_signal', 'Stock MACD-V sell signal', 'stock_daily_indicators', 'macd_v_sell_signal', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('stock.macd_v_active', 'Stock MACD-V active', 'stock_daily_indicators', 'macd_v_active', { scope: 'ticker', tickerField: 'ticker' }),
  enumField('stock.macd_v_signal', 'Stock MACD-V signal', 'stock_daily_indicators', 'macd_v_signal', ['buy', 'sell', 'active', 'none'], { scope: 'ticker', tickerField: 'ticker' }),
  numberField('stock.macd_v', 'Stock MACD-V value', 'stock_daily_indicators', 'macd_v', { scope: 'ticker', tickerField: 'ticker' }),

  booleanField('stock.breakout_20d_buy_signal', 'Stock 20d breakout buy signal', 'stock_daily_indicators', 'breakout_20d_buy_signal', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('stock.breakout_20d_sell_signal', 'Stock 20d breakout sell signal', 'stock_daily_indicators', 'breakout_20d_sell_signal', { scope: 'ticker', tickerField: 'ticker' }),
  enumField('stock.breakout_20d_signal', 'Stock 20d breakout signal', 'stock_daily_indicators', 'breakout_20d_signal', ['buy', 'sell', 'none'], { scope: 'ticker', tickerField: 'ticker' }),

  booleanField('stock.plce_threshold_buy_signal', 'Stock PLCE threshold buy signal', 'stock_daily_indicators', 'plce_threshold_buy_signal', { scope: 'ticker', tickerField: 'ticker' }),
  enumField('stock.plce_threshold_signal', 'Stock PLCE threshold signal', 'stock_daily_indicators', 'plce_threshold_signal', ['buy', 'none'], { scope: 'ticker', tickerField: 'ticker' }),
  numberField('stock.plce_threshold_value', 'Stock PLCE threshold value', 'stock_daily_indicators', 'plce_threshold_value', { scope: 'ticker', tickerField: 'ticker' }),

  enumField('stock.volume_event', 'Stock volume event', 'stock_daily_indicators', 'volume_event', ['normal', 'accumulation', 'distribution', 'extreme_volume'], { scope: 'ticker', tickerField: 'ticker' }),
  enumField('stock.volume_event_tone', 'Stock volume tone', 'stock_daily_indicators', 'volume_event_tone', ['positive', 'danger', 'warning', 'caution', 'neutral'], { scope: 'ticker', tickerField: 'ticker' }),

  enumField(
    'tf_sync.state',
    'TF Sync state',
    'tf_sync_indicator_daily',
    'tf_sync_state',
    ['green', 'red', 'neutral'],
    {
      scope: 'ticker',
      tickerField: 'ticker',
      requiredColumns: [
        'tf_sync_daily_green',
        'tf_sync_weekly_green',
        'tf_sync_intraday_green',
        'tf_sync_daily_red',
        'tf_sync_weekly_red',
        'tf_sync_intraday_red',
      ],
      selectExpression: `case
        when tf_sync_daily_green = true and tf_sync_weekly_green = true and tf_sync_intraday_green = true then 'green'
        when tf_sync_daily_red = true and tf_sync_weekly_red = true and tf_sync_intraday_red = true then 'red'
        else 'neutral'
      end`,
    }
  ),
  enumField('tf_sync.signal', 'TF Sync signal', 'tf_sync_indicator_daily', 'tf_sync_signal', ['buy', 'sell', 'buy_active', 'sell_active', 'none'], { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('tf_sync.buy_signal', 'TF Sync buy signal', 'tf_sync_indicator_daily', 'tf_sync_buy_signal', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('tf_sync.sell_signal', 'TF Sync sell signal', 'tf_sync_indicator_daily', 'tf_sync_sell_signal', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('tf_sync.buy_active', 'TF Sync buy active', 'tf_sync_indicator_daily', 'tf_sync_buy_active', { scope: 'ticker', tickerField: 'ticker' }),
  booleanField('tf_sync.sell_active', 'TF Sync sell active', 'tf_sync_indicator_daily', 'tf_sync_sell_active', { scope: 'ticker', tickerField: 'ticker' }),
];

const FIELD_MAP = new Map(SIGNAL_STUDY_FIELDS.map((field) => [field.key, field]));

export function listSignalStudyFields() {
  return SIGNAL_STUDY_FIELDS.map((field) => ({ ...field }));
}

export function getSignalStudyField(key) {
  const field = FIELD_MAP.get(key);
  return field ? { ...field } : null;
}
