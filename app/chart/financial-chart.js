'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  createTextWatermark,
  HistogramSeries,
  LineSeries,
  LineStyle,
} from 'lightweight-charts';
import {
  getCandlestickSeriesOptions,
  getChartTheme,
  getMovingAverageSeriesOptions,
  getRawObvSeriesOptions,
  getRydObvZscoreSeriesOptions,
  getVolumeSeriesOptions,
} from '../../lib/chart/chart-theme.js';
import {
  CHART_SERIES,
  MOVING_AVERAGE_KEYS,
} from '../../lib/chart/series-registry.js';
import {
  RYD_OBV_LEVELS,
  buildRawObvLineData,
  buildRydObvHistogramData,
  buildRydObvMarkers,
} from '../../lib/chart/ryd-obv-series.js';
import CrosshairLegend from './crosshair-legend.js';

function themeName() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function chartTimeToDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value * 1000).toISOString().slice(0, 10);
  if (typeof value === 'object' && value.year && value.month && value.day) {
    return `${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
  }
  return null;
}

function candleData(bars) {
  return bars.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
}

function volumeData(bars) {
  return bars.map((bar) => ({
    time: bar.time,
    value: bar.volume,
    color: bar.close >= bar.open ? 'rgba(0, 208, 132, 0.48)' : 'rgba(239, 83, 80, 0.48)',
  }));
}

function lineData(bars, key) {
  return bars
    .filter((bar) => Number.isFinite(Number(bar[key])))
    .map((bar) => ({ time: bar.time, value: Number(bar[key]) }));
}

function rydLevelOptions(level, currentTheme) {
  const light = currentTheme === 'light';
  const colorByKind = {
    extreme: light ? 'rgba(71, 85, 105, 0.34)' : 'rgba(161, 161, 170, 0.34)',
    signal: light ? 'rgba(71, 85, 105, 0.58)' : 'rgba(212, 212, 216, 0.56)',
    neutral: light ? 'rgba(100, 116, 139, 0.42)' : 'rgba(161, 161, 170, 0.42)',
    zero: light ? 'rgba(15, 23, 42, 0.68)' : 'rgba(244, 244, 245, 0.7)',
  };

  return {
    price: level.value,
    color: colorByKind[level.kind],
    lineWidth: 1,
    lineStyle: level.kind === 'neutral' ? LineStyle.Dashed : LineStyle.Solid,
    lineVisible: true,
    axisLabelVisible: false,
    title: '',
  };
}

function crosshairPoint(param, series, barsByTime) {
  const price = param.seriesData.get(series.price);
  if (!price || !param.time) return null;

  const time = chartTimeToDate(param.time);
  const stored = barsByTime.get(time) ?? null;
  const point = {
    time,
    open: price.open,
    high: price.high,
    low: price.low,
    close: price.close,
    volume: param.seriesData.get(series.volume)?.value ?? null,
    ryd_obv_signal: stored?.ryd_obv_signal ?? 'none',
  };

  for (const key of MOVING_AVERAGE_KEYS) {
    const value = param.seriesData.get(series[key])?.value;
    if (Number.isFinite(Number(value))) point[key] = Number(value);
  }

  const zscore = param.seriesData.get(series.rydObvZscore)?.value ?? stored?.ryd_obv_zscore_80;
  const rawObv = param.seriesData.get(series.rydObvRaw)?.value ?? stored?.ryd_obv;
  if (Number.isFinite(Number(zscore))) point.ryd_obv_zscore_80 = Number(zscore);
  if (Number.isFinite(Number(rawObv))) point.ryd_obv = Number(rawObv);

  return point;
}

export default function FinancialChart({
  bars,
  currency = 'USD',
  period,
  resetToken,
  ticker,
  visibleIndicators,
  visibleOverlays,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const overlaySeriesRef = useRef({});
  const animationFrameRef = useRef(null);
  const latestPoint = useMemo(() => bars.at(-1) ?? null, [bars]);
  const barsByTime = useMemo(() => new Map(bars.map((bar) => [bar.time, bar])), [bars]);
  const [legendPoint, setLegendPoint] = useState(latestPoint);

  useEffect(() => {
    setLegendPoint(latestPoint);
  }, [latestPoint]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !bars.length) return undefined;

    const currentTheme = themeName();
    const chartTheme = getChartTheme(currentTheme);
    const rydZscoreData = buildRydObvHistogramData(bars);
    const rawObvData = buildRawObvLineData(bars);
    const rawObvVisible = visibleIndicators.includes('rydObvRaw') && rawObvData.length > 0;

    const chart = createChart(container, {
      ...chartTheme,
      leftPriceScale: {
        ...chartTheme.leftPriceScale,
        visible: rawObvVisible,
      },
      width: Math.max(320, Math.floor(container.clientWidth)),
      height: Math.max(620, Math.floor(container.clientHeight)),
    });

    const priceSeries = chart.addSeries(CandlestickSeries, getCandlestickSeriesOptions(), 0);
    const volumeSeries = chart.addSeries(HistogramSeries, getVolumeSeriesOptions(), 1);
    const series = { price: priceSeries, volume: volumeSeries };

    priceSeries.setData(candleData(bars));
    volumeSeries.setData(volumeData(bars));
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.12, bottom: 0 },
      borderVisible: false,
    });

    for (const key of MOVING_AVERAGE_KEYS) {
      const definition = CHART_SERIES[key];
      const lineSeries = chart.addSeries(
        LineSeries,
        {
          ...getMovingAverageSeriesOptions(definition.color),
          visible: visibleOverlays.includes(key),
          title: definition.label,
        },
        definition.pane
      );
      lineSeries.setData(lineData(bars, key));
      series[key] = lineSeries;
    }

    let rydWatermark = null;
    if (rydZscoreData.length) {
      const definition = CHART_SERIES.rydObvZscore;
      const zscoreSeries = chart.addSeries(
        HistogramSeries,
        {
          ...getRydObvZscoreSeriesOptions(),
          visible: visibleIndicators.includes('rydObvZscore'),
          title: definition.label,
        },
        definition.pane
      );
      zscoreSeries.setData(rydZscoreData);
      zscoreSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.14, bottom: 0.14 },
        borderVisible: false,
      });
      for (const level of RYD_OBV_LEVELS) {
        zscoreSeries.createPriceLine(rydLevelOptions(level, currentTheme));
      }
      createSeriesMarkers(zscoreSeries, buildRydObvMarkers(bars));
      series.rydObvZscore = zscoreSeries;
    }

    if (rawObvData.length) {
      const definition = CHART_SERIES.rydObvRaw;
      const rawSeries = chart.addSeries(
        LineSeries,
        {
          ...getRawObvSeriesOptions(definition.color, rawObvVisible),
          title: definition.label,
        },
        definition.pane
      );
      rawSeries.setData(rawObvData);
      rawSeries.priceScale().applyOptions({
        scaleMargins: { top: 0.12, bottom: 0.12 },
        borderVisible: false,
      });
      series.rydObvRaw = rawSeries;
    }

    const rydPane = chart.panes()[2];
    if (rydPane) {
      rydWatermark = createTextWatermark(rydPane, {
        horzAlign: 'left',
        vertAlign: 'top',
        lines: [{
          text: 'RYD OBV Z-Scores with Signals 2025',
          color: currentTheme === 'light' ? 'rgba(15, 23, 42, 0.66)' : 'rgba(244, 244, 245, 0.68)',
          fontSize: 12,
          fontStyle: 'normal',
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }],
      });
    }

    chartRef.current = chart;
    overlaySeriesRef.current = series;

    const fitPaneHeights = () => {
      const height = Math.max(620, Math.floor(container.clientHeight));
      const width = Math.max(320, Math.floor(container.clientWidth));
      chart.resize(width, height);

      const panes = chart.panes();
      if (panes[2]) {
        panes[0]?.setStretchFactor(64);
        panes[1]?.setStretchFactor(14);
        panes[2].setStretchFactor(22);
      } else {
        panes[0]?.setStretchFactor(80);
        panes[1]?.setStretchFactor(20);
      }
    };

    const resizeObserver = new ResizeObserver(fitPaneHeights);
    resizeObserver.observe(container);
    fitPaneHeights();

    const scheduleLegend = (point) => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = requestAnimationFrame(() => {
        setLegendPoint(point ?? latestPoint);
        animationFrameRef.current = null;
      });
    };

    const handleCrosshairMove = (param) => {
      scheduleLegend(crosshairPoint(param, series, barsByTime));
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().fitContent();

    const applyCurrentTheme = () => chart.applyOptions(getChartTheme(themeName()));
    const themeObserver = new MutationObserver(applyCurrentTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      themeObserver.disconnect();
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      rydWatermark?.detach();
      chart.remove();
      chartRef.current = null;
      overlaySeriesRef.current = {};
    };
  }, [bars, barsByTime, latestPoint, period, ticker]);

  useEffect(() => {
    for (const key of MOVING_AVERAGE_KEYS) {
      overlaySeriesRef.current[key]?.applyOptions({ visible: visibleOverlays.includes(key) });
    }
  }, [visibleOverlays]);

  useEffect(() => {
    const zscoreVisible = visibleIndicators.includes('rydObvZscore');
    const rawVisible = visibleIndicators.includes('rydObvRaw') && Boolean(overlaySeriesRef.current.rydObvRaw);
    overlaySeriesRef.current.rydObvZscore?.applyOptions({ visible: zscoreVisible });
    overlaySeriesRef.current.rydObvRaw?.applyOptions({ visible: rawVisible });
    chartRef.current?.applyOptions({ leftPriceScale: { visible: rawVisible } });
  }, [visibleIndicators]);

  useEffect(() => {
    chartRef.current?.timeScale().fitContent();
  }, [resetToken]);

  if (!bars.length) {
    return (
      <div className="financial-chart-empty" role="status">
        <strong>Ingen användbar prishistorik</strong>
        <span>Den valda tickern och perioden saknar kompletta OHLC-rader.</span>
      </div>
    );
  }

  return (
    <div className="financial-chart-shell">
      <CrosshairLegend
        currency={currency}
        point={legendPoint ?? latestPoint}
        visibleIndicators={visibleIndicators}
        visibleOverlays={visibleOverlays}
      />
      <div
        ref={containerRef}
        className="financial-chart-canvas"
        role="img"
        aria-label={`${ticker} daglig prisgraf för perioden ${period} med candlesticks, volym, glidande medelvärden och RYD OBV`}
      />
    </div>
  );
}
