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
  LineType,
} from 'lightweight-charts';
import {
  getCandlestickSeriesOptions,
  getChartTheme,
  getMovingAverageSeriesOptions,
  getRawObvSeriesOptions,
  getRydObvZscoreSeriesOptions,
  getVolumeSeriesOptions,
} from '../../lib/chart/chart-theme.js';
import { CHART_SERIES, MOVING_AVERAGE_KEYS, SIGNAL_KEYS } from '../../lib/chart/series-registry.js';
import {
  RYD_OBV_LEVELS,
  buildRawObvLineData,
  buildRydObvHistogramData,
  buildRydObvMarkerAnchorData,
  buildRydObvMarkers,
} from '../../lib/chart/ryd-obv-series.js';
import { buildTfSyncAnchorData, buildTfSyncMarkers } from '../../lib/chart/tf-sync-markers.js';
import { buildPlceAnchorData, buildPlceMarkers } from '../../lib/chart/plce-volume-markers.js';
import { buildCvolAnchorData, buildCvolMarkers } from '../../lib/chart/cvol-markers.js';
import { buildYieldAnchorData, buildYieldMarkers } from '../../lib/chart/yield-2y-10y-markers.js';
import { buildEarningsAnchorData, buildEarningsMarkers } from '../../lib/chart/earnings-markers.js';
import { buildGexDexLevelData, GEX_DEX_LEVEL_DEFINITIONS } from '../../lib/chart/gex-dex-levels.js';
import { GexDexInlineBarsPrimitive } from '../../lib/chart/gex-dex-inline-bars.js';
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
  return bars.filter((bar) => Number.isFinite(Number(bar[key])))
    .map((bar) => ({ time: bar.time, value: Number(bar[key]) }));
}

function invisibleMarkerSeriesOptions(visible) {
  return {
    color: 'rgba(0, 0, 0, 0)', lineWidth: 1, priceLineVisible: false,
    lastValueVisible: false, crosshairMarkerVisible: false, title: '', visible,
  };
}

function addMarkerLayer(chart, series, { key, pane = 0, anchorData, markers, visible }) {
  if (!anchorData.length || !markers.length) return null;
  const markerSeries = chart.addSeries(LineSeries, invisibleMarkerSeriesOptions(visible), pane);
  markerSeries.setData(anchorData);
  createSeriesMarkers(markerSeries, markers, { autoScale: false });
  series[key] = markerSeries;
  return markerSeries;
}

function addGexDexLevels(chart, series, snapshots, latestBarDate, visibleContextLayers) {
  const dataByLevel = buildGexDexLevelData(snapshots, latestBarDate);
  const latestSnapshot = snapshots.at(-1) ?? null;
  const stale = Boolean(latestSnapshot?.stale || latestSnapshot?.sourceStatus !== 'active');

  for (const [key, definition] of Object.entries(GEX_DEX_LEVEL_DEFINITIONS)) {
    const data = dataByLevel[key] ?? [];
    if (!data.some((point) => Number.isFinite(Number(point.value)))) continue;
    const visibilityKey = definition.group === 'main' ? 'gexDex' : 'gexDexMore';
    const levelSeries = chart.addSeries(LineSeries, {
      color: definition.color,
      lineWidth: 1,
      lineStyle: stale || definition.dashed ? LineStyle.Dashed : LineStyle.Solid,
      lineType: LineType.WithSteps,
      pointMarkersVisible: false,
      priceLineVisible: data.length === 1,
      priceLineWidth: 1,
      priceLineStyle: stale || definition.dashed ? LineStyle.Dashed : LineStyle.Solid,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      title: definition.label,
      visible: visibleContextLayers.includes(visibilityKey),
    }, 0);
    levelSeries.setData(data);
    series[`gexDex_${key}`] = levelSeries;
  }
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
    tf_sync_buy_signal: stored?.tf_sync_buy_signal === true,
    tf_sync_sell_signal: stored?.tf_sync_sell_signal === true,
    tf_sync_signal: stored?.tf_sync_signal ?? 'none',
    plce_threshold_buy_signal: stored?.plce_threshold_buy_signal === true,
    plce_threshold_value: stored?.plce_threshold_value ?? null,
    plce_threshold_signal: stored?.plce_threshold_signal ?? 'none',
    cvol_calls: stored?.cvol_calls ?? null,
    cvol_sell_signal_1: stored?.cvol_sell_signal_1 === true,
    cvol_sell_signal_2: stored?.cvol_sell_signal_2 === true,
    cvol_sell_signal_3: stored?.cvol_sell_signal_3 === true,
    cvol_signal: stored?.cvol_signal ?? 'none',
    yield_2y: stored?.yield_2y ?? null,
    yield_10y: stored?.yield_10y ?? null,
    yield_frr_2_10: stored?.yield_frr_2_10 ?? null,
    yield_2y_10y_buy_signal: stored?.yield_2y_10y_buy_signal === true,
    yield_2y_10y_sell_signal: stored?.yield_2y_10y_sell_signal === true,
    yield_2y_10y_signal: stored?.yield_2y_10y_signal ?? 'none',
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
  bars, currency = 'USD', earningsEvents = [], gexDexSnapshots = [], gexDexStrikes = [], period, resetToken, ticker,
  visibleContextLayers, visibleIndicators, visibleOverlays, visibleSignals,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const overlaySeriesRef = useRef({});
  const inlineExposurePrimitiveRef = useRef(null);
  const animationFrameRef = useRef(null);
  const latestPoint = useMemo(() => bars.at(-1) ?? null, [bars]);
  const barsByTime = useMemo(() => new Map(bars.map((bar) => [bar.time, bar])), [bars]);
  const [legendPoint, setLegendPoint] = useState(latestPoint);

  useEffect(() => setLegendPoint(latestPoint), [latestPoint]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !bars.length) return undefined;

    const currentTheme = themeName();
    const chartTheme = getChartTheme(currentTheme);
    const rydZscoreData = buildRydObvHistogramData(bars);
    const rydMarkerAnchorData = buildRydObvMarkerAnchorData(bars);
    const rawObvData = buildRawObvLineData(bars);
    const rawObvVisible = visibleIndicators.includes('rydObvRaw') && rawObvData.length > 0;
    const zscoreVisible = visibleIndicators.includes('rydObvZscore');

    const chart = createChart(container, {
      ...chartTheme,
      leftPriceScale: { ...chartTheme.leftPriceScale, visible: rawObvVisible },
      width: Math.max(320, Math.floor(container.clientWidth)),
      height: Math.max(620, Math.floor(container.clientHeight)),
    });

    const priceSeries = chart.addSeries(CandlestickSeries, getCandlestickSeriesOptions(), 0);
    const volumeSeries = chart.addSeries(HistogramSeries, getVolumeSeriesOptions(), 1);
    const series = { price: priceSeries, volume: volumeSeries };
    priceSeries.setData(candleData(bars));
    const inlineExposurePrimitive = new GexDexInlineBarsPrimitive({
      rows: gexDexStrikes,
      maxWidthRatio: 0.30,
    });
    priceSeries.attachPrimitive(inlineExposurePrimitive);
    inlineExposurePrimitiveRef.current = inlineExposurePrimitive;
    volumeSeries.setData(volumeData(bars));
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0 }, borderVisible: false });

    for (const key of MOVING_AVERAGE_KEYS) {
      const definition = CHART_SERIES[key];
      const lineSeries = chart.addSeries(LineSeries, {
        ...getMovingAverageSeriesOptions(definition.color),
        visible: visibleOverlays.includes(key),
        title: definition.label,
      }, definition.pane);
      lineSeries.setData(lineData(bars, key));
      series[key] = lineSeries;
    }

    addGexDexLevels(chart, series, gexDexSnapshots, latestPoint?.time, visibleContextLayers);

    addMarkerLayer(chart, series, {
      key: 'tfSync', pane: 0,
      anchorData: buildTfSyncAnchorData(bars), markers: buildTfSyncMarkers(bars),
      visible: visibleSignals.includes('tfSync'),
    });
    addMarkerLayer(chart, series, {
      key: 'plceVolumeExtreme', pane: 0,
      anchorData: buildPlceAnchorData(bars), markers: buildPlceMarkers(bars),
      visible: visibleSignals.includes('plceVolumeExtreme'),
    });
    addMarkerLayer(chart, series, {
      key: 'cvolExtreme', pane: 0,
      anchorData: buildCvolAnchorData(bars), markers: buildCvolMarkers(bars),
      visible: visibleSignals.includes('cvolExtreme'),
    });
    addMarkerLayer(chart, series, {
      key: 'yield2y10y', pane: 0,
      anchorData: buildYieldAnchorData(bars), markers: buildYieldMarkers(bars),
      visible: visibleSignals.includes('yield2y10y'),
    });
    addMarkerLayer(chart, series, {
      key: 'earnings', pane: 0,
      anchorData: buildEarningsAnchorData(bars, earningsEvents), markers: buildEarningsMarkers(earningsEvents),
      visible: visibleContextLayers.includes('earnings'),
    });

    let rydWatermark = null;
    if (rydZscoreData.length) {
      const definition = CHART_SERIES.rydObvZscore;
      const zscoreSeries = chart.addSeries(
        HistogramSeries,
        { ...getRydObvZscoreSeriesOptions(), visible: zscoreVisible },
        definition.pane
      );
      zscoreSeries.setData(rydZscoreData);
      zscoreSeries.priceScale().applyOptions({ scaleMargins: { top: 0.14, bottom: 0.14 }, borderVisible: false });
      for (const level of RYD_OBV_LEVELS) zscoreSeries.createPriceLine(rydLevelOptions(level, currentTheme));
      series.rydObvZscore = zscoreSeries;

      if (rydMarkerAnchorData.length) {
        const markerAnchorSeries = chart.addSeries(LineSeries, invisibleMarkerSeriesOptions(zscoreVisible), definition.pane);
        markerAnchorSeries.setData(rydMarkerAnchorData);
        createSeriesMarkers(markerAnchorSeries, buildRydObvMarkers(bars), { autoScale: false });
        series.rydObvMarkerAnchor = markerAnchorSeries;
      }
    }

    if (rawObvData.length) {
      const definition = CHART_SERIES.rydObvRaw;
      const rawSeries = chart.addSeries(LineSeries, {
        ...getRawObvSeriesOptions(definition.color, rawObvVisible), title: definition.label,
      }, definition.pane);
      rawSeries.setData(rawObvData);
      rawSeries.priceScale().applyOptions({ scaleMargins: { top: 0.12, bottom: 0.12 }, borderVisible: false });
      series.rydObvRaw = rawSeries;
    }

    const rydPane = chart.panes()[2];
    if (rydPane) {
      rydWatermark = createTextWatermark(rydPane, {
        horzAlign: 'left', vertAlign: 'top',
        lines: [{
          text: 'RYD OBV Z-Scores with Signals 2025',
          color: currentTheme === 'light' ? 'rgba(15, 23, 42, 0.66)' : 'rgba(244, 244, 245, 0.68)',
          fontSize: 12, fontStyle: 'normal',
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        }],
      });
    }

    chartRef.current = chart;
    overlaySeriesRef.current = series;
    const fitPaneHeights = () => {
      const height = Math.max(620, Math.floor(container.clientHeight));
      chart.resize(Math.max(320, Math.floor(container.clientWidth)), height);
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
    const handleCrosshairMove = (param) => scheduleLegend(crosshairPoint(param, series, barsByTime));
    chart.subscribeCrosshairMove(handleCrosshairMove);
    chart.timeScale().fitContent();

    const applyCurrentTheme = () => chart.applyOptions(getChartTheme(themeName()));
    const themeObserver = new MutationObserver(applyCurrentTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return () => {
      themeObserver.disconnect();
      resizeObserver.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
      rydWatermark?.detach();
      priceSeries.detachPrimitive(inlineExposurePrimitive);
      inlineExposurePrimitiveRef.current = null;
      chart.remove();
      chartRef.current = null;
      overlaySeriesRef.current = {};
    };
  }, [
    bars, earningsEvents, gexDexSnapshots, latestPoint, period, resetToken, ticker,
    visibleContextLayers, visibleIndicators, visibleOverlays, visibleSignals,
  ]);

  useEffect(() => {
    inlineExposurePrimitiveRef.current?.setRows(gexDexStrikes);
  }, [gexDexStrikes]);

  useEffect(() => {
    const series = overlaySeriesRef.current;
    for (const key of MOVING_AVERAGE_KEYS) series[key]?.applyOptions({ visible: visibleOverlays.includes(key) });
    for (const key of SIGNAL_KEYS) series[key]?.applyOptions({ visible: visibleSignals.includes(key) });
    series.rydObvZscore?.applyOptions({ visible: visibleIndicators.includes('rydObvZscore') });
    series.rydObvMarkerAnchor?.applyOptions({ visible: visibleIndicators.includes('rydObvZscore') });
    series.rydObvRaw?.applyOptions({ visible: visibleIndicators.includes('rydObvRaw') });
    for (const [key, definition] of Object.entries(GEX_DEX_LEVEL_DEFINITIONS)) {
      const visibilityKey = definition.group === 'main' ? 'gexDex' : 'gexDexMore';
      series[`gexDex_${key}`]?.applyOptions({ visible: visibleContextLayers.includes(visibilityKey) });
    }
    series.earnings?.applyOptions({ visible: visibleContextLayers.includes('earnings') });
  }, [visibleContextLayers, visibleIndicators, visibleOverlays, visibleSignals]);

  useEffect(() => {
    const handleTheme = () => chartRef.current?.applyOptions(getChartTheme(themeName()));
    window.addEventListener('marketsignals:theme', handleTheme);
    return () => window.removeEventListener('marketsignals:theme', handleTheme);
  }, []);

  return (
    <div className="financial-chart-shell">
      <CrosshairLegend
        point={legendPoint}
        currency={currency}
        visibleIndicators={visibleIndicators}
        visibleOverlays={visibleOverlays}
        visibleSignals={visibleSignals}
      />
      <div ref={containerRef} className="financial-chart-canvas" />
    </div>
  );
}
