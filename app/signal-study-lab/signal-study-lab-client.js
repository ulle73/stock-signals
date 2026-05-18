'use client';

import { useMemo, useState, useTransition } from 'react';

function groupFields(fields) {
  const groups = new Map();
  for (const field of fields) {
    const key = field.key.split('.')[0];
    const label = key === 'tf_sync'
      ? 'TF Sync'
      : key === 'stock'
        ? 'Stock'
        : key === 'zscore'
          ? 'Z-score'
          : key.charAt(0).toUpperCase() + key.slice(1);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(field);
  }
  return [...groups.entries()];
}

function fieldLabel(field) {
  return field.isAvailable === false
    ? `${field.label} (saknar tabell/kolumn)`
    : field.label;
}

function defaultOperatorForField(field) {
  return field?.allowedOperators?.[0] ?? '=';
}

function defaultValueForField(field, operator) {
  if (!field || operator === 'is_true' || operator === 'is_false') return null;
  if (operator === 'between') return [0, 100];
  if (field.type === 'number') return 0;
  if (field.type === 'boolean') return true;
  return field.possibleOptions?.[0] ?? '';
}

function buildConditionFromField(field) {
  const operator = defaultOperatorForField(field);
  return {
    field: field.key,
    operator,
    value: defaultValueForField(field, operator),
  };
}

function resolveStateDefaults(field) {
  const options = field?.possibleOptions ?? [];
  const greenLike = options.find((item) => item === 'green' || item === 'risk_on' || item === 'long');
  const redLike = options.find((item) => item === 'red' || item === 'risk_off' || item === 'short');
  const neutralLike = options.find((item) => item === 'neutral' || item === 'warning' || item === 'risk_caution' || item === 'cash');
  return {
    entryState: greenLike ?? options[0] ?? '',
    oppositeState: redLike ?? options[1] ?? options[0] ?? '',
    neutralState: neutralLike ?? options[2] ?? options[0] ?? '',
  };
}

function normalizeExampleConfig(config, fieldsByKey) {
  const example = structuredClone(config);
  if (example.studyType === 'forward_horizon') {
    return {
      name: example.name ?? '',
      studyType: 'forward_horizon',
      returnInstrument: example.returnInstrument ?? 'SPY',
      signalInstrument: example.signalInstrument ?? '',
      startDate: example.startDate ?? '',
      endDate: example.endDate ?? '',
      conditionMode: example.conditionMode ?? 'ALL',
      eventMode: example.eventMode ?? 'signal_start',
      maxHorizonDays: example.maxHorizonDays ?? 60,
      entryDelayBars: example.entryDelayBars ?? 1,
      minBarsBetweenEvents: example.minBarsBetweenEvents ?? 0,
      allowOverlappingEvents: example.allowOverlappingEvents ?? true,
      conditions: example.conditions?.length
        ? example.conditions
        : [buildConditionFromField(fieldsByKey.get('market.pct_above_50'))],
    };
  }

  const stateField = fieldsByKey.get(example.stateField) ?? fieldsByKey.get('market.signal');
  const defaults = resolveStateDefaults(stateField);
  return {
    name: example.name ?? '',
    studyType: 'state_period',
    returnInstrument: example.returnInstrument ?? 'SPY',
    signalInstrument: example.signalInstrument ?? '',
    startDate: example.startDate ?? '',
    endDate: example.endDate ?? '',
    stateField: stateField?.key ?? 'market.signal',
    entryState: example.entryState ?? defaults.entryState,
    oppositeState: example.oppositeState ?? defaults.oppositeState,
    neutralState: example.neutralState ?? defaults.neutralState,
    neutralEndDays: example.neutralEndDays ?? 3,
    entryDelayBars: example.entryDelayBars ?? 1,
    exitDelayBars: example.exitDelayBars ?? 1,
    maxHoldBars: example.maxHoldBars ?? '',
    filtersApplyAt: example.filtersApplyAt ?? 'entry',
    filterMode: example.filterMode ?? 'ALL',
    filters: example.filters ?? [],
  };
}

function buildPayload(config) {
  const payload = {
    name: config.name,
    studyType: config.studyType,
    returnInstrument: config.returnInstrument,
    conditionMode: config.conditionMode,
  };
  if (config.signalInstrument) payload.signalInstrument = config.signalInstrument;
  if (config.startDate) payload.startDate = config.startDate;
  if (config.endDate) payload.endDate = config.endDate;

  if (config.studyType === 'forward_horizon') {
    payload.maxHorizonDays = Number(config.maxHorizonDays);
    payload.entryDelayBars = Number(config.entryDelayBars ?? 1);
    payload.minBarsBetweenEvents = Number(config.minBarsBetweenEvents ?? 0);
    payload.allowOverlappingEvents = Boolean(config.allowOverlappingEvents);
    payload.eventMode = config.eventMode;
    payload.conditions = config.conditions;
    return payload;
  }

  payload.stateField = config.stateField;
  payload.entryState = config.entryState;
  payload.oppositeState = config.oppositeState;
  payload.neutralState = config.neutralState;
  payload.neutralEndDays = Number(config.neutralEndDays);
  payload.entryDelayBars = Number(config.entryDelayBars);
  payload.exitDelayBars = Number(config.exitDelayBars);
  if (config.maxHoldBars !== '' && config.maxHoldBars !== null && config.maxHoldBars !== undefined) {
    payload.maxHoldBars = Number(config.maxHoldBars);
  }
  payload.filtersApplyAt = config.filtersApplyAt;
  payload.filterMode = config.filterMode;
  payload.filters = config.filters;
  return payload;
}

function formatPercent(value, digits = 2) {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(digits)}%`;
}

function formatNumber(value, digits = 2) {
  return value === null || value === undefined ? '—' : Number(value).toFixed(digits);
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('sv-SE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
}

function scopeNeedsSignalInstrument(config, fieldsByKey) {
  const selectedKeys = [];
  if (config.studyType === 'forward_horizon') {
    for (const condition of config.conditions) selectedKeys.push(condition.field);
  } else {
    selectedKeys.push(config.stateField);
    for (const filter of config.filters) selectedKeys.push(filter.field);
  }
  return selectedKeys.some((key) => fieldsByKey.get(key)?.scope === 'ticker');
}

function ResultMeta({ meta }) {
  if (!meta) return null;
  return (
    <div className="study-lab-result-meta">
      <div className="metric-grid compact-grid">
        <div className="metric-tile">
          <span>Return-instrument</span>
          <strong>{meta.returnInstrument}</strong>
          <p className="footnote compact">Signalinstrument {meta.signalInstrument}</p>
        </div>
        <div className="metric-tile">
          <span>Prisrader</span>
          <strong>{meta.priceBarCount}</strong>
          <p className="footnote compact">{formatDate(meta.firstDate)} → {formatDate(meta.lastDate)}</p>
        </div>
        <div className="metric-tile">
          <span>Källa</span>
          <strong>{meta.priceSourceTable}</strong>
          <p className="footnote compact">{formatTimestamp(meta.generatedAt)}</p>
        </div>
      </div>
      {meta.warnings?.length ? (
        <div className="study-lab-warning-list">
          {meta.warnings.map((warning) => <div className="study-lab-warning" key={warning}>{warning}</div>)}
        </div>
      ) : null}
      <details className="study-lab-details">
        <summary>Visa täckning per valt fält</summary>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fält</th><th>Rader</th><th>Non-null</th><th>Första värde</th><th>Sista värde</th></tr></thead>
            <tbody>
              {meta.fieldCoverage?.map((item) => (
                <tr key={item.fieldKey}>
                  <td>{item.fieldKey}</td><td>{item.rowCount}</td><td>{item.nonNullCount}</td>
                  <td>{formatDate(item.firstValueDate)}</td><td>{formatDate(item.lastValueDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function ForwardResultView({ payload }) {
  const summary = payload.result.summary ?? {};
  return (
    <>
      <div className="study-lab-metric-strip">
        <div className="metric-tile"><span>Events</span><strong>{payload.result.eventCount}</strong><p className="footnote compact">Signalstarter hittade</p></div>
        <div className="metric-tile"><span>Entry delay</span><strong>{payload.result.entryDelayBars}</strong><p className="footnote compact">bars efter signal</p></div>
        <div className="metric-tile"><span>Bästa avg</span><strong>T+{summary.best_avg_return_horizon_days ?? '—'}</strong><p className="footnote compact">{formatPercent(summary.best_avg_return_pct)}</p></div>
        <div className="metric-tile"><span>Bästa win rate</span><strong>T+{summary.best_win_rate_horizon_days ?? '—'}</strong><p className="footnote compact">{formatPercent(summary.best_win_rate_pct)}</p></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Horisont</th><th>Samples</th><th>Avg</th><th>Median</th><th>Win rate</th><th>Best</th><th>Worst</th></tr></thead>
          <tbody>
            {payload.result.horizons.map((row) => (
              <tr key={row.horizon_days}>
                <td>T+{row.horizon_days}</td><td>{row.sample_count}</td><td>{formatPercent(row.avg_return_pct)}</td>
                <td>{formatPercent(row.median_return_pct)}</td><td>{formatPercent(row.win_rate_pct)}</td>
                <td>{formatPercent(row.best_return_pct)}</td><td>{formatPercent(row.worst_return_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="study-lab-details">
        <summary>Visa signalstarter ({payload.result.events.length})</summary>
        <div className="table-wrap"><table><thead><tr><th>Signaldatum</th><th>Signalpris</th><th>Entry</th><th>Entrypris</th></tr></thead><tbody>
          {payload.result.events.length ? payload.result.events.map((row) => (
            <tr key={`${row.signal_date}-${row.entry_date}-${row.entry_price}`}>
              <td>{formatDate(row.signal_date)}</td><td>{formatNumber(row.signal_price)}</td>
              <td>{formatDate(row.entry_date)}</td><td>{formatNumber(row.entry_price)}</td>
            </tr>
          )) : <tr><td colSpan="4">Inga signalstarter matchade nuvarande config.</td></tr>}
        </tbody></table></div>
      </details>
    </>
  );
}

function StatePeriodResultView({ payload }) {
  const summary = payload.result.summary;
  return (
    <>
      <div className="study-lab-metric-strip">
        <div className="metric-tile"><span>Perioder</span><strong>{summary.period_count}</strong><p className="footnote compact">Identifierade regimfönster</p></div>
        <div className="metric-tile"><span>Avg return</span><strong>{formatPercent(summary.avg_return_pct)}</strong><p className="footnote compact">Median {formatPercent(summary.median_return_pct)}</p></div>
        <div className="metric-tile"><span>Win rate</span><strong>{formatPercent(summary.win_rate_pct)}</strong><p className="footnote compact">Avg bars {formatNumber(summary.avg_bars_held, 1)}</p></div>
        <div className="metric-tile"><span>Max hold</span><strong>{payload.result.maxHoldBars ?? '—'}</strong><p className="footnote compact">bars</p></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Signalstart</th><th>Entry</th><th>Signalslut</th><th>Exit</th><th>Bars</th><th>Entrypris</th><th>Exitpris</th><th>Return</th><th>Slutorsak</th></tr></thead>
          <tbody>
            {payload.result.periods.length ? payload.result.periods.map((row) => (
              <tr key={`${row.signal_start_date}-${row.exit_date}-${row.end_reason}`}>
                <td>{formatDate(row.signal_start_date)}</td><td>{formatDate(row.entry_date)}</td><td>{formatDate(row.end_signal_date)}</td><td>{formatDate(row.exit_date)}</td>
                <td>{row.bars_held}</td><td>{formatNumber(row.entry_price)}</td><td>{formatNumber(row.exit_price)}</td><td>{formatPercent(row.return_pct)}</td><td>{row.end_reason}</td>
              </tr>
            )) : <tr><td colSpan="9">Inga state-perioder matchade nuvarande config.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ConditionValueInput({ condition, field, onChange }) {
  if (!field || condition.operator === 'is_true' || condition.operator === 'is_false') return null;
  if (condition.operator === 'between') {
    const [min = 0, max = 0] = Array.isArray(condition.value) ? condition.value : [0, 0];
    return <div className="study-lab-inline-pair"><input type="number" value={min} onChange={(event) => onChange([Number(event.target.value), max])} /><input type="number" value={max} onChange={(event) => onChange([min, Number(event.target.value)])} /></div>;
  }
  if (field.type === 'enum') {
    return <select value={condition.value ?? ''} onChange={(event) => onChange(event.target.value)}>{field.possibleOptions?.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  }
  if (field.type === 'boolean') {
    return <select value={condition.value ? 'true' : 'false'} onChange={(event) => onChange(event.target.value === 'true')}><option value="true">true</option><option value="false">false</option></select>;
  }
  return <input type="number" value={condition.value ?? 0} onChange={(event) => onChange(Number(event.target.value))} />;
}

function ConditionBuilder({ title, description, rows, fields, fieldsByKey, mode, onModeChange, onAdd, onRemove, onUpdate, emptyCopy }) {
  const groupedFields = useMemo(() => groupFields(fields), [fields]);
  return (
    <article className="card study-lab-panel">
      <div className="study-lab-panel-head"><div><p className="section-kicker">{title}</p><p className="footnote">{description}</p></div>{onModeChange ? <select value={mode} onChange={(event) => onModeChange(event.target.value)}><option value="ALL">ALL</option><option value="ANY">ANY</option></select> : null}</div>
      <div className="study-lab-condition-list">
        {rows.length ? rows.map((condition, index) => {
          const field = fieldsByKey.get(condition.field);
          const sourceLabel = field ? `${field.sourceTable} · ${field.scope}${field.isAvailable === false ? ' · saknar datafält' : ''}` : 'okänt fält';
          return (
            <div className="study-lab-condition-row" key={`${title}-${index}`}>
              <div className="study-lab-condition-grid">
                <select value={condition.field} onChange={(event) => onUpdate(index, 'field', event.target.value)}>
                  {groupedFields.map(([groupLabel, items]) => <optgroup key={groupLabel} label={groupLabel}>{items.map((item) => <option key={item.key} value={item.key} disabled={item.isAvailable === false}>{fieldLabel(item)}</option>)}</optgroup>)}
                </select>
                <select value={condition.operator} onChange={(event) => onUpdate(index, 'operator', event.target.value)}>{(field?.allowedOperators ?? []).map((operator) => <option key={operator} value={operator}>{operator}</option>)}</select>
                <ConditionValueInput condition={condition} field={field} onChange={(value) => onUpdate(index, 'value', value)} />
              </div>
              <div className="study-lab-condition-footer"><span>{sourceLabel}</span><button type="button" className="study-lab-text-button" onClick={() => onRemove(index)}>Ta bort</button></div>
            </div>
          );
        }) : <p className="footnote">{emptyCopy}</p>}
      </div>
      <button type="button" className="study-lab-secondary-button" onClick={onAdd}>Lägg till rad</button>
    </article>
  );
}

export default function SignalStudyLabClient({ examples, fields, returnInstrumentOptions, signalInstrumentOptions }) {
  const activeFields = useMemo(() => fields.filter((field) => field.isAvailable !== false), [fields]);
  const fieldsByKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const initialConfig = useMemo(() => normalizeExampleConfig(examples[0].config, fieldsByKey), [examples, fieldsByKey]);
  const [config, setConfig] = useState(initialConfig);
  const [selectedExampleId, setSelectedExampleId] = useState(examples[0]?.id ?? '');
  const [resultPayload, setResultPayload] = useState(null);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [isPending, startTransition] = useTransition();
  const needsSignalInstrument = scopeNeedsSignalInstrument(config, fieldsByKey);
  const stateField = config.studyType === 'state_period' ? fieldsByKey.get(config.stateField) : null;
  const payload = buildPayload(config);

  function replaceConfig(nextConfig) { setConfig(nextConfig); setError(''); }
  function loadExample(exampleId) {
    const example = examples.find((item) => item.id === exampleId);
    if (!example) return;
    setSelectedExampleId(exampleId);
    replaceConfig(normalizeExampleConfig(example.config, fieldsByKey));
    setResultPayload(null);
  }
  function updateConfigField(key, value) { replaceConfig({ ...config, [key]: value }); }
  function updateConditionRow(collectionKey, index, fieldName, value) {
    const nextRows = config[collectionKey].map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      if (fieldName === 'field') return buildConditionFromField(fieldsByKey.get(value));
      if (fieldName === 'operator') {
        const field = fieldsByKey.get(row.field);
        return { ...row, operator: value, value: defaultValueForField(field, value) };
      }
      return { ...row, [fieldName]: value };
    });
    replaceConfig({ ...config, [collectionKey]: nextRows });
  }
  function addConditionRow(collectionKey) {
    const fallbackField = activeFields[0] ?? fields[0];
    replaceConfig({ ...config, [collectionKey]: [...config[collectionKey], buildConditionFromField(fallbackField)] });
  }
  function removeConditionRow(collectionKey, index) { replaceConfig({ ...config, [collectionKey]: config[collectionKey].filter((_, rowIndex) => rowIndex !== index) }); }
  function changeStudyType(nextType) {
    if (nextType === config.studyType) return;
    const nextExample = nextType === 'forward_horizon' ? examples.find((item) => item.id === 'breadth-cross-forward') : examples.find((item) => item.id === 'tf-sync-green-period');
    if (nextExample) { setSelectedExampleId(nextExample.id); replaceConfig(normalizeExampleConfig(nextExample.config, fieldsByKey)); setResultPayload(null); }
  }
  function handleStateFieldChange(fieldKey) {
    const defaults = resolveStateDefaults(fieldsByKey.get(fieldKey));
    replaceConfig({ ...config, stateField: fieldKey, entryState: defaults.entryState, oppositeState: defaults.oppositeState, neutralState: defaults.neutralState });
  }
  function handleRun() {
    setError('');
    startTransition(async () => {
      try {
        const response = await fetch('/api/signal-study/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const nextPayload = await response.json();
        if (!response.ok) throw new Error(nextPayload.error ?? `HTTP ${response.status}`);
        setResultPayload(nextPayload);
      } catch (runError) {
        setResultPayload(null);
        setError(runError.message ?? 'Studien kunde inte köras.');
      }
    });
  }
  async function copyConfig() {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopyStatus('Kopierad');
    window.setTimeout(() => setCopyStatus(''), 1500);
  }

  return (
    <section className="study-lab-layout">
      <div className="study-lab-builder">
        <article className="card study-lab-panel">
          <div className="study-lab-panel-head"><div><p className="section-kicker">Setup</p><p className="footnote">Return-instrument är det du mäter avkastning i. Signalinstrument används bara för tickerbaserade indikatorer som OBV, z-score och TF Sync.</p></div></div>
          <div className="study-lab-form-grid">
            <label className="study-lab-field"><span>Exempelstart</span><select value={selectedExampleId} onChange={(event) => loadExample(event.target.value)}>{examples.map((example) => <option key={example.id} value={example.id}>{example.label}</option>)}</select><small>{examples.find((item) => item.id === selectedExampleId)?.description}</small></label>
            <label className="study-lab-field"><span>Study-typ</span><select value={config.studyType} onChange={(event) => changeStudyType(event.target.value)}><option value="forward_horizon">forward_horizon</option><option value="state_period">state_period</option></select></label>
            <label className="study-lab-field study-lab-field-wide"><span>Namn</span><input value={config.name} onChange={(event) => updateConfigField('name', event.target.value)} /></label>
            <label className="study-lab-field"><span>Return-instrument</span><select value={config.returnInstrument} onChange={(event) => updateConfigField('returnInstrument', event.target.value)}>{returnInstrumentOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small>Instrumentet vars framtida avkastning mäts.</small></label>
            <label className="study-lab-field"><span>Signalinstrument</span><select value={config.signalInstrument} onChange={(event) => updateConfigField('signalInstrument', event.target.value)} disabled={!needsSignalInstrument}><option value="">{needsSignalInstrument ? 'Samma som return om möjligt' : 'Behövs ej för globala fält'}</option>{signalInstrumentOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><small>{needsSignalInstrument ? 'Tickerbaserade fält läses från detta instrument.' : 'Globala marknadsfält kräver inget signalinstrument.'}</small></label>
            <label className="study-lab-field"><span>Startdatum</span><input type="date" value={config.startDate} onChange={(event) => updateConfigField('startDate', event.target.value)} /></label>
            <label className="study-lab-field"><span>Slutdatum</span><input type="date" value={config.endDate} onChange={(event) => updateConfigField('endDate', event.target.value)} /></label>
          </div>
        </article>

        {config.studyType === 'forward_horizon' ? <>
          <article className="card study-lab-panel"><div className="study-lab-panel-head"><div><p className="section-kicker">Forward-parametrar</p><p className="footnote">Entry sker som standard en bar efter signalen för att undvika lookahead.</p></div></div><div className="study-lab-form-grid">
            <label className="study-lab-field"><span>Condition mode</span><select value={config.conditionMode} onChange={(event) => updateConfigField('conditionMode', event.target.value)}><option value="ALL">ALL</option><option value="ANY">ANY</option></select></label>
            <label className="study-lab-field"><span>Event mode</span><select value={config.eventMode} onChange={(event) => updateConfigField('eventMode', event.target.value)}><option value="signal_start">signal_start</option><option value="every_match">every_match</option></select></label>
            <label className="study-lab-field"><span>Max horizon days</span><input type="number" min="1" max="252" value={config.maxHorizonDays} onChange={(event) => updateConfigField('maxHorizonDays', Number(event.target.value))} /></label>
            <label className="study-lab-field"><span>Entry delay bars</span><input type="number" min="0" value={config.entryDelayBars} onChange={(event) => updateConfigField('entryDelayBars', Number(event.target.value))} /></label>
            <label className="study-lab-field"><span>Min bars between events</span><input type="number" min="0" value={config.minBarsBetweenEvents} onChange={(event) => updateConfigField('minBarsBetweenEvents', Number(event.target.value))} /></label>
            <label className="study-lab-field"><span>Allow overlapping events</span><select value={config.allowOverlappingEvents ? 'true' : 'false'} onChange={(event) => updateConfigField('allowOverlappingEvents', event.target.value === 'true')}><option value="true">true</option><option value="false">false</option></select></label>
          </div></article>
          <ConditionBuilder title="Conditions" description="Dessa rader definierar vad som ska räknas som en signalstart." rows={config.conditions} fields={activeFields} fieldsByKey={fieldsByKey} mode={config.conditionMode} onModeChange={(value) => updateConfigField('conditionMode', value)} onAdd={() => addConditionRow('conditions')} onRemove={(index) => removeConditionRow('conditions', index)} onUpdate={(index, fieldName, value) => updateConditionRow('conditions', index, fieldName, value)} emptyCopy="Lägg till minst ett villkor för att kunna köra forward horizon study." />
        </> : <>
          <article className="card study-lab-panel"><div className="study-lab-panel-head"><div><p className="section-kicker">State-logik</p><p className="footnote">Entry/exit sker med delay bars. Max hold avslutar perioden om den nås före state-end.</p></div></div><div className="study-lab-form-grid">
            <label className="study-lab-field study-lab-field-wide"><span>State field</span><select value={config.stateField} onChange={(event) => handleStateFieldChange(event.target.value)}>{activeFields.filter((field) => field.type === 'enum').map((field) => <option key={field.key} value={field.key}>{fieldLabel(field)}</option>)}</select><small>{stateField?.sourceTable} · {stateField?.scope}</small></label>
            <label className="study-lab-field"><span>Entry state</span><select value={config.entryState} onChange={(event) => updateConfigField('entryState', event.target.value)}>{stateField?.possibleOptions?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="study-lab-field"><span>Opposite state</span><select value={config.oppositeState} onChange={(event) => updateConfigField('oppositeState', event.target.value)}>{stateField?.possibleOptions?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="study-lab-field"><span>Neutral state</span><select value={config.neutralState} onChange={(event) => updateConfigField('neutralState', event.target.value)}>{stateField?.possibleOptions?.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
            <label className="study-lab-field"><span>Neutral end days</span><input type="number" min="0" value={config.neutralEndDays} onChange={(event) => updateConfigField('neutralEndDays', Number(event.target.value))} /></label>
            <label className="study-lab-field"><span>Entry delay bars</span><input type="number" min="0" value={config.entryDelayBars} onChange={(event) => updateConfigField('entryDelayBars', Number(event.target.value))} /></label>
            <label className="study-lab-field"><span>Exit delay bars</span><input type="number" min="0" value={config.exitDelayBars} onChange={(event) => updateConfigField('exitDelayBars', Number(event.target.value))} /></label>
            <label className="study-lab-field"><span>Max hold bars</span><input type="number" min="1" value={config.maxHoldBars} placeholder="valfritt" onChange={(event) => updateConfigField('maxHoldBars', event.target.value === '' ? '' : Number(event.target.value))} /></label>
            <label className="study-lab-field"><span>Filters apply at</span><select value={config.filtersApplyAt} onChange={(event) => updateConfigField('filtersApplyAt', event.target.value)}><option value="entry">entry</option><option value="signal_start">signal_start</option></select></label>
            <label className="study-lab-field"><span>Filter mode</span><select value={config.filterMode} onChange={(event) => updateConfigField('filterMode', event.target.value)}><option value="ALL">ALL</option><option value="ANY">ANY</option></select></label>
          </div></article>
          <ConditionBuilder title="Filters" description="Valfria filter som appliceras vid entry eller signalstart." rows={config.filters} fields={activeFields} fieldsByKey={fieldsByKey} mode={config.filterMode} onModeChange={(value) => updateConfigField('filterMode', value)} onAdd={() => addConditionRow('filters')} onRemove={(index) => removeConditionRow('filters', index)} onUpdate={(index, fieldName, value) => updateConditionRow('filters', index, fieldName, value)} emptyCopy="Inga extra filter ännu. State study kan köras utan filters." />
        </>}

        <article className="card study-lab-panel"><div className="study-lab-panel-head"><div><p className="section-kicker">Config preview</p><p className="footnote">JSON-payloaden som UI:t skickar till den säkra study-endpointen.</p></div></div><pre className="study-lab-json-preview">{JSON.stringify(payload, null, 2)}</pre><div className="study-lab-action-bar"><button type="button" className="study-lab-primary-button" onClick={handleRun} disabled={isPending}>{isPending ? 'Kör study...' : 'Kör study'}</button><button type="button" className="study-lab-secondary-button" onClick={copyConfig}>Kopiera config</button><span className="footnote">{copyStatus || <>Resultat sparas automatiskt till <code>studies/results/</code></>}</span></div>{error ? <div className="study-lab-warning">{error}</div> : null}</article>
      </div>
      <div className="study-lab-results"><article className="card study-lab-panel"><div className="study-lab-panel-head"><div><p className="section-kicker">Resultat</p><p className="footnote">Kör studien för att se sample counts, horizon-tabeller eller state-perioder.</p></div></div>{isPending ? <div className="study-lab-empty-state"><strong>Studien körs nu...</strong><p className="footnote">Servern bygger datasetet, evaluerar villkoren och sparar JSON-resultatet.</p></div> : resultPayload ? <><ResultMeta meta={resultPayload.meta} />{resultPayload.result.studyType === 'forward_horizon' ? <ForwardResultView payload={resultPayload} /> : <StatePeriodResultView payload={resultPayload} />}<details className="study-lab-details"><summary>Visa sparvägar och råresultat</summary><div className="study-lab-path-block"><p><strong>Senaste körning:</strong> {resultPayload.meta.savedResultPath}</p><p><strong>Latest-fil:</strong> {resultPayload.meta.savedLatestPath}</p></div><pre className="study-lab-json-preview">{JSON.stringify(resultPayload, null, 2)}</pre></details></> : <div className="study-lab-empty-state"><strong>Ingen study körd ännu.</strong><p className="footnote">Börja gärna med exemplet <code>breadth_cross_above_50_forward</code> för att se ett resultat med riktiga träffar direkt.</p></div>}</article></div>
    </section>
  );
}
