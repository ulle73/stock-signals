const DARK_THEME = Object.freeze({
  background: '#0b0d12',
  text: '#a1a1aa',
  grid: 'rgba(255, 255, 255, 0.055)',
  border: 'rgba(255, 255, 255, 0.12)',
  crosshair: 'rgba(250, 250, 250, 0.42)',
});

const LIGHT_THEME = Object.freeze({
  background: '#ffffff',
  text: '#64748b',
  grid: 'rgba(15, 23, 42, 0.07)',
  border: 'rgba(15, 23, 42, 0.12)',
  crosshair: 'rgba(15, 23, 42, 0.35)',
});

export function getChartTheme(themeName = 'dark') {
  const theme = themeName === 'light' ? LIGHT_THEME : DARK_THEME;

  return {
    layout: {
      background: { type: 'solid', color: theme.background },
      textColor: theme.text,
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      fontSize: 12,
      panes: {
        separatorColor: theme.border,
        separatorHoverColor: theme.crosshair,
        enableResize: true,
      },
    },
    grid: {
      vertLines: { color: theme.grid },
      horzLines: { color: theme.grid },
    },
    crosshair: {
      mode: 0,
      vertLine: { color: theme.crosshair, width: 1, style: 3, labelBackgroundColor: theme.background },
      horzLine: { color: theme.crosshair, width: 1, style: 3, labelBackgroundColor: theme.background },
    },
    rightPriceScale: {
      borderColor: theme.border,
      scaleMargins: { top: 0.08, bottom: 0.06 },
      minimumWidth: 74,
    },
    timeScale: {
      borderColor: theme.border,
      timeVisible: false,
      secondsVisible: false,
      rightOffset: 4,
      barSpacing: 7,
      minBarSpacing: 2,
      fixLeftEdge: true,
      lockVisibleTimeRangeOnResize: true,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: true,
      mouseWheel: true,
      pinch: true,
    },
  };
}

export function getCandlestickSeriesOptions() {
  return {
    upColor: '#00d084',
    downColor: '#ef5350',
    borderUpColor: '#00d084',
    borderDownColor: '#ef5350',
    wickUpColor: '#35d9a2',
    wickDownColor: '#ff6b68',
    priceLineVisible: true,
    lastValueVisible: true,
  };
}

export function getVolumeSeriesOptions() {
  return {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
    lastValueVisible: false,
    priceLineVisible: false,
  };
}

export function getMovingAverageSeriesOptions(color) {
  return {
    color,
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  };
}
