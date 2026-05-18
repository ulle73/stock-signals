import { collectSignalStudyFieldKeys, buildSignalStudyDataset } from '../repositories/signal-studies.js';
import { runForwardReturnStudy } from './forward-return-study.js';
import { normalizeAndValidateStudyConfig } from './signal-study-config.js';
import { buildSignalStudyResultPaths, writeSignalStudyResultFiles } from './signal-study-output.js';
import { runStatePeriodStudy } from './state-period-study.js';

function buildCoverageWarnings(fieldCoverage = []) {
  return fieldCoverage
    .filter((item) => item.nonNullCount === 0)
    .map((item) => `${item.fieldKey} saknar datapunkter för valt signalInstrument/date range.`);
}

function buildStudyMeta(config, dataset, extras = {}) {
  return {
    studyName: config.name,
    studyType: config.studyType,
    returnInstrument: dataset.returnInstrument,
    signalInstrument: dataset.signalInstrument,
    priceBarCount: dataset.priceRows.length,
    fieldKeys: dataset.fieldKeys,
    priceSourceTable: dataset.priceRows[0]?.sourceTable ?? null,
    firstDate: dataset.priceRows[0]?.date ?? null,
    lastDate: dataset.priceRows.at(-1)?.date ?? null,
    fieldCoverage: dataset.fieldCoverage,
    warnings: buildCoverageWarnings(dataset.fieldCoverage),
    ...extras,
  };
}

export async function executeSignalStudy({
  config: inputConfig,
  configPath = null,
  saveResult = true,
  now = new Date(),
} = {}) {
  const config = normalizeAndValidateStudyConfig(inputConfig);
  const fieldKeys = collectSignalStudyFieldKeys(config);
  const dataset = await buildSignalStudyDataset({
    returnInstrument: config.returnInstrument,
    signalInstrument: config.signalInstrument,
    fieldKeys,
    startDate: config.startDate ?? null,
    endDate: config.endDate ?? null,
  });

  const result = config.studyType === 'forward_horizon'
    ? runForwardReturnStudy(config, { bars: dataset.bars })
    : runStatePeriodStudy(config, { bars: dataset.bars });

  const outputPaths = buildSignalStudyResultPaths({
    studyName: config.name,
    now,
  });
  const payload = {
    meta: buildStudyMeta(config, dataset, {
      generatedAt: now.toISOString(),
      configPath,
      savedResultPath: saveResult ? outputPaths.timestampedPath : null,
      savedLatestPath: saveResult ? outputPaths.latestPath : null,
    }),
    result,
  };

  if (saveResult) {
    await writeSignalStudyResultFiles({
      paths: outputPaths,
      payload,
    });
  }

  return payload;
}
