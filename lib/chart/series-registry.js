export const CHART_SERIES = Object.freeze({
  price: Object.freeze({ key: 'price', label: 'Pris', kind: 'candlestick', pane: 0 }),
  volume: Object.freeze({ key: 'volume', label: 'Volym', kind: 'histogram', pane: 1 }),
  sma5: Object.freeze({ key: 'sma5', label: 'SMA5', kind: 'line', pane: 0, color: '#f59e0b' }),
  sma10: Object.freeze({ key: 'sma10', label: 'SMA10', kind: 'line', pane: 0, color: '#eab308' }),
  sma20: Object.freeze({ key: 'sma20', label: 'SMA20', kind: 'line', pane: 0, color: '#38bdf8' }),
  sma50: Object.freeze({ key: 'sma50', label: 'SMA50', kind: 'line', pane: 0, color: '#a78bfa' }),
  sma200: Object.freeze({ key: 'sma200', label: 'SMA200', kind: 'line', pane: 0, color: '#f472b6' }),
  rydObvZscore: Object.freeze({ key: 'rydObvZscore', dataKey: 'ryd_obv_zscore_80', label: 'RYD Z-score', kind: 'histogram', pane: 2 }),
  rydObvRaw: Object.freeze({ key: 'rydObvRaw', dataKey: 'ryd_obv', label: 'Rå OBV', kind: 'line', pane: 2, priceScaleId: 'left', color: '#38bdf8' }),
  tfSync: Object.freeze({
    key: 'tfSync', dataKey: 'tf_sync_signal',
    availabilityKeys: Object.freeze(['tf_sync_buy_signal', 'tf_sync_sell_signal']),
    label: 'TF Sync', kind: 'markers', pane: 0, color: '#55ff55',
  }),
  plceVolumeExtreme: Object.freeze({
    key: 'plceVolumeExtreme', dataKey: 'plce_threshold_signal',
    availabilityKeys: Object.freeze(['plce_threshold_buy_signal']),
    label: 'PUT volym extrem', kind: 'markers', pane: 0, color: '#0004ff',
  }),
  cvolExtreme: Object.freeze({
    key: 'cvolExtreme', dataKey: 'cvol_signal',
    availabilityKeys: Object.freeze(['cvol_sell_signal_1', 'cvol_sell_signal_2', 'cvol_sell_signal_3']),
    label: 'CVOL extrem', kind: 'markers', pane: 0, color: '#0004ff',
  }),
  yield2y10y: Object.freeze({
    key: 'yield2y10y', dataKey: 'yield_2y_10y_signal',
    availabilityKeys: Object.freeze(['yield_2y_10y_buy_signal', 'yield_2y_10y_sell_signal']),
    label: '2Y + 10Y', kind: 'markers', pane: 0, color: '#ffffff',
  }),
});

export const MOVING_AVERAGE_KEYS = Object.freeze(['sma5', 'sma10', 'sma20', 'sma50', 'sma200']);
export const INDICATOR_KEYS = Object.freeze(['rydObvZscore', 'rydObvRaw']);
export const SIGNAL_KEYS = Object.freeze(['tfSync', 'plceVolumeExtreme', 'cvolExtreme', 'yield2y10y']);
export const DEFAULT_VISIBLE_OVERLAYS = Object.freeze(['sma20', 'sma50', 'sma200']);
export const DEFAULT_VISIBLE_INDICATORS = Object.freeze(['rydObvZscore']);
export const DEFAULT_VISIBLE_SIGNALS = Object.freeze(['tfSync', 'plceVolumeExtreme', 'cvolExtreme', 'yield2y10y']);
