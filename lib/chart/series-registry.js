export const CHART_SERIES = Object.freeze({
  price: Object.freeze({
    key: 'price',
    label: 'Pris',
    kind: 'candlestick',
    pane: 0,
  }),
  volume: Object.freeze({
    key: 'volume',
    label: 'Volym',
    kind: 'histogram',
    pane: 1,
  }),
  sma5: Object.freeze({
    key: 'sma5',
    label: 'SMA5',
    kind: 'line',
    pane: 0,
    color: '#f59e0b',
  }),
  sma10: Object.freeze({
    key: 'sma10',
    label: 'SMA10',
    kind: 'line',
    pane: 0,
    color: '#eab308',
  }),
  sma20: Object.freeze({
    key: 'sma20',
    label: 'SMA20',
    kind: 'line',
    pane: 0,
    color: '#38bdf8',
  }),
  sma50: Object.freeze({
    key: 'sma50',
    label: 'SMA50',
    kind: 'line',
    pane: 0,
    color: '#a78bfa',
  }),
  sma200: Object.freeze({
    key: 'sma200',
    label: 'SMA200',
    kind: 'line',
    pane: 0,
    color: '#f472b6',
  }),
});

export const MOVING_AVERAGE_KEYS = Object.freeze([
  'sma5',
  'sma10',
  'sma20',
  'sma50',
  'sma200',
]);

export const DEFAULT_VISIBLE_OVERLAYS = Object.freeze(['sma20', 'sma50', 'sma200']);
