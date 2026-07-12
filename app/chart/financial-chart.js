'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
} from 'lightweight-charts';
import {
  getCandlestickSeriesOptions,
  getChartTheme,
  getMovingAverageSeriesOptions,
  getVolumeSeriesOptions,
} from '../../lib/chart/chart-theme.js';
import {
  CHART_SERIES,
  MOVING_AVERAGE_KEYS,
} from '../../lib/chart/series-registry.js';
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

function crosshairPoint(param, series) {
  const price = param.seriesData.get(series.price);
  if (!price || !param.time) return null;

  const point = {
    time: chartTimeToDate(param.time),
    open: price.open,
    high: price.high,
    low: price.low,
    close: price.close,
    volume: param.seriesData.get(series.volume)?.value ?? null,
  };

  for (const key of MOVING_AVERAGE_KEYS) {
    const value = param.seriesData.get(series[key])?.value;
    if (Number.isFinite(Number(value))) point[key] = Number(value);
  }

  return point;
}

export default function FinancialChart({
  bars,
  currency = 'USD',
  period,
  resetToken,
  ticker,
  visibleOverlays,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const overlaySeriesRef = useRef({});
  const animationFrameRef = useRef(null);
  const latestPoint = useMemo(() => bars.at(-1) ?? null, [bars]);
  const [legendPoint, setLegendPoint] = useState(latestPoint);

  useEffect(() => {
    setLegendPoint(latestPoint);
  }, [latestPoint]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !bars.length) return undefined;

    const chart = createChart(container, {
      ...getChartTheme(themeName()),
      width: Math.max(320, Math.floor(container.clientWidth)),
      height: Math.max(420, Math.floor(container.clientHeight)),
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

    chartRef.current = chart;
    overlaySeriesRef.current = series;

    const fitPaneHeights = () => {
      const height = Math.max(420, Math.floor(container.clientHeight));
      const width = Math.max(320, Math.floor(container.clientWidth));
      chart.resize(width, height);
      const panes = chart.panes();
      if (panes[1]) panes[1].setHeight(Math.max(92, Math.min(150, Math.round(height * 0.2))));
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
      scheduleLegend(crosshairPoint(param, series));
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
      chart.remove();
      chartRef.current = null;
      overlaySeriesRef.current = {};
    };
  }, [bars, latestPoint, period, ticker]);

  useEffect(() => {
    for (const key of MOVING_AVERAGE_KEYS) {
      overlaySeriesRef.current[key]?.applyOptions({ visible: visibleOverlays.includes(key) });
    }
  }, [visibleOverlays]);

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
        visibleOverlays={visibleOverlays}
      />
      <div
        ref={containerRef}
        className="financial-chart-canvas"
        role="img"
        aria-label={`${ticker} daglig prisgraf för perioden ${period} med candlesticks, volym och glidande medelvärden`}
      />
    </div>
  );
}
