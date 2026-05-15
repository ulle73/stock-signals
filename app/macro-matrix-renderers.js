const REGIME_LABELS = {
  recovery: 'Recovery',
  expansion: 'Expansion',
  slowdown: 'Slowdown',
  contraction: 'Contraction',
};

const REGIME_METRIC_GROUPS = [
  { key: 'avgReturn', label: 'Average Returns' },
  { key: 'medianReturn', label: 'Median Returns' },
  { key: 'volatility', label: 'Volatility' },
  { key: 'sharpe', label: 'Sharpe' },
  { key: 'winRatio', label: 'Win Ratio' },
  { key: 'beta', label: 'Beta with OMXS30' },
  { key: 'observations', label: '# Observations' },
];

export function formatMatrixNumber(value, digits = 2) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const resolvedDigits = Math.abs(number) >= 1000 ? 0 : digits;

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: resolvedDigits,
    maximumFractionDigits: resolvedDigits,
  }).format(number);
}

export function formatMatrixPercent(value, digits = 1) {
  return value === null || value === undefined ? '—' : `${formatMatrixNumber(value, digits)}%`;
}

export function formatMatrixMonth(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
    .format(new Date(`${value}T00:00:00Z`))
    .replace(' ', '-');
}

function status(value) {
  return value ? value.replaceAll('_', ' ') : 'No data';
}

function formatDelta(value, digits = 1) {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number > 0 ? '+' : ''}${formatMatrixNumber(number, digits)}`;
}

function getDeltaDirection(value, fallback = 'flat') {
  if (fallback && fallback !== 'flat') return fallback;
  if (value === null || value === undefined) return 'flat';
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return 'flat';
  return number > 0 ? 'up' : 'down';
}

function TimelineDeltaCell({ value, direction }) {
  const resolvedDirection = getDeltaDirection(value, direction);

  return (
    <td className={`macro-slide-delta-cell delta-${resolvedDirection}`}>
      <span className={`macro-slide-delta-arrow macro-slide-delta-arrow-${resolvedDirection}`} aria-hidden="true" />
      <span>{formatDelta(value)}</span>
    </td>
  );
}

function getCellTitle(row, cell) {
  return `${row.label} · ${formatMatrixMonth(cell.periodDate)} · ${cell.transformedValue === null ? 'No data' : formatMatrixNumber(cell.transformedValue)}`;
}

function renderTimelineCells(row, { showQuarters, showDelta, valueDigits, highlightLatestKeys }) {
  const shouldHighlightLatest = highlightLatestKeys.includes(row.key);
  const latestCellIndex = row.cells.length - 1;

  return (
    <>
      {row.cells.map((cell, index) => (
        <td
          className={`macro-cell macro-slide-cell macro-${cell.colorBucket}${shouldHighlightLatest && index === latestCellIndex ? ' macro-slide-cell-ring' : ''}`}
          key={`${row.key}-${cell.periodDate}`}
          title={getCellTitle(row, cell)}
        >
          {cell.transformedValue === null ? '—' : formatMatrixNumber(cell.transformedValue, valueDigits)}
        </td>
      ))}
      {showQuarters
        ? row.quarterlyCells.map((cell) => (
          <td
            className={`macro-cell macro-slide-cell macro-slide-quarter-cell macro-${cell.colorBucket}`}
            key={`${row.key}-${cell.quarterKey}`}
            title={`${row.label} · ${cell.label} · ${cell.transformedValue === null ? 'No data' : formatMatrixNumber(cell.transformedValue)}`}
          >
            {cell.transformedValue === null ? '—' : formatMatrixNumber(cell.transformedValue, valueDigits)}
          </td>
        ))
        : null}
      {showDelta ? <TimelineDeltaCell value={row.delta} direction={row.deltaDirection} /> : null}
    </>
  );
}

function summaryForRows(rows, matrix, { showQuarters }) {
  const summaryByMonth = matrix.months.map((periodDate, index) => {
    const validCells = rows
      .map((row) => row.cells[index])
      .filter((cell) => cell?.transformedValue !== null && cell?.transformedValue !== undefined && cell?.momChange !== null && cell?.momChange !== undefined);
    const positiveCount = validCells.filter((cell) => Number(cell.directionScore) > 0).length;
    const percentPositive = validCells.length ? (positiveCount / validCells.length) * 100 : null;

    return { periodDate, percentPositive };
  });

  const summaryByQuarter = showQuarters
    ? matrix.quarters.map((quarter) => {
      const validCells = rows
        .flatMap((row) => row.quarterlyCells.filter((cell) => cell.quarterKey === quarter.key))
        .filter((cell) => cell?.transformedValue !== null && cell?.transformedValue !== undefined && cell?.directionScore !== null && cell?.directionScore !== undefined);
      const positiveCount = validCells.filter((cell) => Number(cell.directionScore) > 0).length;
      const percentPositive = validCells.length ? (positiveCount / validCells.length) * 100 : null;

      return { quarterKey: quarter.key, label: quarter.label, percentPositive };
    })
    : [];

  const previous = summaryByMonth.at(-2);
  const latest = summaryByMonth.at(-1);
  const delta = previous?.percentPositive !== null &&
    previous?.percentPositive !== undefined &&
    latest?.percentPositive !== null &&
    latest?.percentPositive !== undefined
    ? latest.percentPositive - previous.percentPositive
    : null;

  return { summaryByMonth, summaryByQuarter, delta };
}

function renderTimelineSummaryRow({ rows, matrix, showQuarters, showDelta, label = '% Positive Change M/M', rowKey = 'summary' }) {
  const summary = rows ? summaryForRows(rows, matrix, { showQuarters }) : {
    summaryByMonth: matrix.summaryByMonth ?? [],
    summaryByQuarter: matrix.summaryByQuarter ?? [],
    delta: null,
  };

  if (!rows) {
    const previous = summary.summaryByMonth?.at(-2);
    const latest = summary.summaryByMonth?.at(-1);
    summary.delta = previous?.percentPositive !== null &&
      previous?.percentPositive !== undefined &&
      latest?.percentPositive !== null &&
      latest?.percentPositive !== undefined
      ? Number(latest.percentPositive) - Number(previous.percentPositive)
      : null;
  }

  return (
    <tr className="macro-summary-row macro-slide-summary-row" key={rowKey}>
      <th scope="row">{label}</th>
      {summary.summaryByMonth.map((item) => (
        <td key={item.periodDate}>{formatMatrixPercent(item.percentPositive, 0)}</td>
      ))}
      {showQuarters
        ? summary.summaryByQuarter.map((item) => (
          <td className="macro-slide-quarter-cell" key={item.quarterKey}>{formatMatrixPercent(item.percentPositive, 0)}</td>
        ))
        : null}
      {showDelta ? <TimelineDeltaCell value={summary.delta} /> : null}
    </tr>
  );
}

function renderRepeatedTimelineHeader(matrix, { rowHeader, showQuarters, showDelta }) {
  return (
    <>
      <th>{rowHeader}</th>
      {matrix.months.map((periodDate) => <th key={periodDate}>{formatMatrixMonth(periodDate)}</th>)}
      {showQuarters
        ? matrix.quarters.map((quarter) => <th className="macro-slide-quarter-head" key={quarter.key}>{quarter.label}</th>)
        : null}
      {showDelta ? <th className="macro-slide-delta-head">Δ</th> : null}
    </>
  );
}

export function MacroMatrixSlide({
  title,
  subtitle,
  className = '',
  caption,
  footnote,
  children,
}) {
  return (
    <section className={`card macro-matrix-card macro-slide-card ${className}`}>
      <div className="macro-slide-header">
        <div className="macro-slide-heading">
          <span className="macro-slide-rail" aria-hidden="true" />
          <div>
            <h2>{title}</h2>
          </div>
        </div>
        <div className="macro-slide-badge">
          <span>Macro</span>
          <strong>Medium/Long-Term</strong>
        </div>
      </div>

      {subtitle ? <p className="macro-slide-subtitle">{subtitle}</p> : null}
      {caption ? <div className="macro-slide-caption">{caption}</div> : null}
      {children}
      {footnote ? <p className="footnote macro-slide-footnote">{footnote}</p> : null}
    </section>
  );
}

export function TimelineMacroMatrix({
  matrix,
  rowHeader,
  showQuarters = true,
  showDelta = true,
  valueDigits = 2,
  groups = null,
  highlightLatestKeys = [],
  annotationRanges = [],
}) {
  if (!matrix) return null;

  const rowsByKey = new Map(matrix.rows.map((row) => [row.key, row]));
  const groupedRows = groups
    ? groups.map((group) => ({
      ...group,
      rows: group.rowKeys.map((key) => rowsByKey.get(key)).filter(Boolean),
    }))
    : null;

  return (
    <div className={`macro-slide-table-frame${annotationRanges.length ? ' macro-slide-table-frame-annotated' : ''}`}>
      <div className="macro-matrix-scroll macro-slide-scroll">
        <table className="macro-matrix-table macro-slide-table">
          <thead>
            <tr>{renderRepeatedTimelineHeader(matrix, { rowHeader: groupedRows?.[0]?.label ?? rowHeader, showQuarters, showDelta })}</tr>
          </thead>
          <tbody>
            {groupedRows
              ? groupedRows.flatMap((group, groupIndex) => {
                const groupRows = [
                  ...(groupIndex > 0
                    ? [
                      <tr className="macro-slide-group-head" key={`${group.key}-head`}>
                        {renderRepeatedTimelineHeader(matrix, { rowHeader: group.label, showQuarters, showDelta })}
                      </tr>,
                    ]
                    : []),
                  ...group.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row"><div className="macro-row-label">{row.label}</div></th>
                      {renderTimelineCells(row, { showQuarters, showDelta, valueDigits, highlightLatestKeys })}
                    </tr>
                  )),
                  renderTimelineSummaryRow({
                    rows: group.rows,
                    matrix,
                    showQuarters,
                    showDelta,
                    label: group.summaryLabel ?? '% Positive Change M/M',
                    rowKey: `${group.key}-summary`,
                  }),
                ];

                return groupRows;
              })
              : (
                <>
                  {matrix.rows.map((row) => (
                    <tr key={row.key}>
                      <th scope="row"><div className="macro-row-label">{row.label}</div></th>
                      {renderTimelineCells(row, { showQuarters, showDelta, valueDigits, highlightLatestKeys })}
                    </tr>
                  ))}
                  {renderTimelineSummaryRow({ matrix, showQuarters, showDelta })}
                </>
              )}
          </tbody>
        </table>
      </div>

      {annotationRanges.length ? (
        <div className="macro-slide-annotations" aria-hidden="true">
          {annotationRanges.map((annotation) => (
            <span
              className="macro-slide-annotation"
              data-label={annotation.label}
              key={annotation.label}
              style={{
                left: annotation.left,
                width: annotation.width,
              }}
            >
              {annotation.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function regimeMetricValue(metricKey, cell) {
  if (!cell) return '—';
  if (metricKey === 'avgReturn') return formatMatrixPercent(cell.avgReturn, 1);
  if (metricKey === 'medianReturn') return formatMatrixPercent(cell.medianReturn, 1);
  if (metricKey === 'volatility') return formatMatrixPercent(cell.volatility, 1);
  if (metricKey === 'sharpe') return formatMatrixNumber(cell.sharpe, 2);
  if (metricKey === 'winRatio') return formatMatrixPercent(cell.winRatio, 1);
  if (metricKey === 'beta') return formatMatrixNumber(cell.beta, 2);
  if (metricKey === 'observations') return cell.observations ? formatMatrixNumber(cell.observations, 0) : '—';
  return '—';
}

function regimeMetricClass(metricKey, cell) {
  if (metricKey === 'observations') return 'regime-stat-observation';
  return `macro-${cell?.metricBuckets?.[metricKey] ?? 'missing'}`;
}

function regimeCellTitle(row, cell, metricLabel, metricKey) {
  if (!cell) return row.label;
  return `${row.label} · ${metricLabel} · ${REGIME_LABELS[cell.regime] ?? cell.regime} · ${regimeMetricValue(metricKey, cell)}`;
}

function defaultRegimeRowBucket(row) {
  const type = row.assetType ?? row.assetGroup ?? '';

  if (['equity_index', 'thematic_equity'].includes(type)) return 'equity';
  if (['commodity_index', 'commodity'].includes(type)) return 'commodity';
  if (type === 'crypto') return 'crypto';
  if (type === 'volatility') return 'volatility';
  if (['credit', 'inflation_linked_bond', 'government_bond', 'bond_index'].includes(type)) return 'fixedincome';
  if (['currency_index', 'fx_basket', 'fx'].includes(type)) return 'fx';
  return 'neutral';
}

export function RegimePerformanceMatrix({
  matrix,
  rowHeader = 'Markets',
  rowBucket = defaultRegimeRowBucket,
}) {
  if (!matrix) return null;

  return (
    <div className="macro-matrix-scroll regime-stat-scroll macro-slide-scroll">
      <table className="macro-matrix-table regime-stat-table macro-slide-table">
        <thead>
          <tr>
            <th rowSpan="2">{rowHeader}</th>
            {REGIME_METRIC_GROUPS.map((metric) => (
              <th className="regime-stat-group-head" colSpan={matrix.regimes.length} key={metric.key}>
                {metric.label}
              </th>
            ))}
          </tr>
          <tr>
            {REGIME_METRIC_GROUPS.flatMap((metric) => matrix.regimes.map((regime) => (
              <th className="regime-stat-subhead" key={`${metric.key}-${regime}`}>
                {REGIME_LABELS[regime] ?? regime}
              </th>
            )))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row, index) => {
            const bucket = rowBucket(row);
            const previousBucket = index > 0 ? rowBucket(matrix.rows[index - 1]) : null;
            const isGroupStart = index === 0 || previousBucket !== bucket;

            return (
              <tr className={isGroupStart ? 'regime-stat-group-start' : undefined} key={row.key}>
                <th
                  className={`regime-stat-rowhead regime-stat-rowhead-${bucket}`}
                  scope="row"
                  title={`${row.label} · ${row.sourceSymbol ?? 'no symbol'} · ${row.sourceStatus ?? 'active'}`}
                >
                  <div className="macro-row-label">{row.label}</div>
                </th>
                {REGIME_METRIC_GROUPS.flatMap((metric) => row.regimeCells.map((cell) => (
                  <td
                    className={`macro-cell regime-stat-cell ${regimeMetricClass(metric.key, cell)}`}
                    key={`${row.key}-${metric.key}-${cell.regime}`}
                    title={regimeCellTitle(row, cell, metric.label, metric.key)}
                  >
                    {regimeMetricValue(metric.key, cell)}
                  </td>
                )))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function formatRegimeStatus(value) {
  return status(value);
}
