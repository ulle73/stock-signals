import crypto from 'node:crypto';
import { collectSignalStudyFieldKeys, buildSignalStudyDataset } from '../repositories/signal-studies.js';
import { saveSignalStudyResult } from '../repositories/signal-study-results.js';
import { runForwardReturnStudy } from './forward-return-study.js';
import { normalizeAndValidateStudyConfig } from './signal-study-config.js';
import {
  buildSignalStudyResultId,
  buildSignalStudyStorageRefs,
  writeSignalStudyResultFiles,
} from './signal-study-output.js';
import { runStatePeriodStudy } from './state-period-study.js';

export class SignalStudyConfigError extends Error {}
export class SignalStudyPersistenceError extends Error {}

function buildCoverageWarnings(fieldCoverage = []) {
  return fieldCoverage
    .filter((item) => item.nonNullCount === 0)
    .map((item) => `${item.fieldKey} saknar datapunkter för valt signalInstrument/date range.`);
}

export function resolveSignalStudyResultStorage({
  saveResult = true,
  resultStorage = 'filesystem',
} = {}) {
  if (!saveResult) {
    return 'none';
  }

  if (resultStorage === 'database') {
    return 'database';
  }

  return 'filesystem';
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
  resultStorage = 'filesystem',
  now = new Date(),
  createResultId = () => crypto.randomUUID(),
  saveDatabaseResult = saveSignalStudyResult,
  writeFilesystemResult = writeSignalStudyResultFiles,
  normalizeConfig = normalizeAndValidateStudyConfig,
  buildDataset = buildSignalStudyDataset,
  runForwardStudy = runForwardReturnStudy,
  runStateStudy = runStatePeriodStudy,
} = {}) {
  let config;
  try {
    config = normalizeConfig(inputConfig);
  } catch (error) {
    throw new SignalStudyConfigError(error.message);
  }

  const fieldKeys = collectSignalStudyFieldKeys(config);
  const dataset = await buildDataset({
    returnInstrument: config.returnInstrument,
    signalInstrument: config.signalInstrument,
    fieldKeys,
    startDate: config.startDate ?? null,
    endDate: config.endDate ?? null,
  });

  const result = config.studyType === 'forward_horizon'
    ? runForwardStudy(config, { bars: dataset.bars })
    : runStateStudy(config, { bars: dataset.bars });

  const storageKind = resolveSignalStudyResultStorage({ saveResult, resultStorage });
  const resultId = storageKind === 'database'
    ? buildSignalStudyResultId({
      studyName: config.name,
      now,
      createId: createResultId,
    })
    : null;
  const storageRefs = buildSignalStudyStorageRefs({
    studyName: config.name,
    now,
    storageKind,
    resultId,
  });
  const payload = {
    meta: buildStudyMeta(config, dataset, {
      generatedAt: now.toISOString(),
      configPath,
      storageKind,
      savedResultRef: storageRefs.savedResultRef,
      savedLatestRef: storageRefs.savedLatestRef,
    }),
    result,
  };

  if (storageKind === 'filesystem') {
    try {
      await writeFilesystemResult({
        paths: storageRefs.paths,
        payload,
      });
    } catch (error) {
      throw new SignalStudyPersistenceError(error.message);
    }
  }

  if (storageKind === 'database') {
    try {
      await saveDatabaseResult({
        id: resultId,
        slug: storageRefs.slug,
        studyName: config.name,
        studyType: config.studyType,
        returnInstrument: dataset.returnInstrument,
        signalInstrument: dataset.signalInstrument,
        configPath,
        payloadJson: payload,
        createdAt: now.toISOString(),
      });
    } catch (error) {
      throw new SignalStudyPersistenceError(error.message);
    }
  }

  return payload;
}
