import { getSignalStudyField } from '../signal-registry/fields.js';
import { validateCondition } from './dynamic-condition-engine.js';

const SUPPORTED_STUDY_TYPES = new Set(['forward_horizon', 'state_period']);
const SUPPORTED_EVENT_MODES = new Set(['signal_start', 'every_match']);
const SUPPORTED_CONDITION_MODES = new Set(['ALL', 'ANY']);
const SUPPORTED_FILTERS_APPLY_AT = new Set(['entry', 'signal_start']);

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function ensureObject(value, message) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(message);
  }
}

function ensureString(value, message) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(message);
  }
}

function normalizeMode(value, fallback) {
  return String(value ?? fallback).toUpperCase();
}

function validateConditionValue(condition, label) {
  const field = getSignalStudyField(condition.field);
  if (!field) {
    throw new Error(`${label}.field finns inte i signal registry.`);
  }

  if (condition.operator === 'is_true' || condition.operator === 'is_false') {
    return;
  }

  if (field.type === 'number') {
    if (condition.operator === 'between') {
      if (!Array.isArray(condition.value) || condition.value.length !== 2) {
        throw new Error(`${label}.value måste vara [min, max] för operatorn between.`);
      }

      const [min, max] = condition.value;
      if (!Number.isFinite(Number(min)) || !Number.isFinite(Number(max))) {
        throw new Error(`${label}.value måste innehålla två numeriska värden för between.`);
      }

      return;
    }

    if (!Number.isFinite(Number(condition.value))) {
      throw new Error(`${label}.value måste vara numeriskt för fältet ${field.key}.`);
    }

    return;
  }

  if (field.type === 'boolean') {
    if (typeof condition.value !== 'boolean') {
      throw new Error(`${label}.value måste vara true/false för boolean-fältet ${field.key}.`);
    }

    return;
  }

  if (field.type === 'enum' && field.possibleOptions?.length) {
    if (typeof condition.value !== 'string' || !field.possibleOptions.includes(condition.value)) {
      throw new Error(`${label}.value måste vara en av: ${field.possibleOptions.join(', ')}`);
    }
  }
}

function validateConditionList(conditions, label) {
  if (!Array.isArray(conditions) || conditions.length === 0) {
    throw new Error(`${label} måste innehålla minst ett villkor.`);
  }

  conditions.forEach((condition, index) => {
    ensureObject(condition, `${label}[${index}] måste vara ett objekt.`);
    validateCondition(condition);
    validateConditionValue(condition, `${label}[${index}]`);
  });
}

function validateFilters(filters) {
  if (!filters) {
    return;
  }

  if (!Array.isArray(filters)) {
    throw new Error('filters måste vara en array.');
  }

  filters.forEach((filter, index) => {
    ensureObject(filter, `filters[${index}] måste vara ett objekt.`);
    validateCondition(filter);
    validateConditionValue(filter, `filters[${index}]`);
  });
}

function validateForwardStudyConfig(config) {
  validateConditionList(config.conditions, 'conditions');

  if (!isPositiveInteger(config.maxHorizonDays)) {
    throw new Error('maxHorizonDays måste vara ett positivt heltal.');
  }

  const eventMode = config.eventMode ?? 'signal_start';
  if (!SUPPORTED_EVENT_MODES.has(eventMode)) {
    throw new Error(`eventMode måste vara en av: ${[...SUPPORTED_EVENT_MODES].join(', ')}`);
  }

  const entryDelayBars = config.entryDelayBars ?? 1;
  if (!isNonNegativeInteger(entryDelayBars)) {
    throw new Error('entryDelayBars måste vara ett heltal >= 0.');
  }
  config.entryDelayBars = entryDelayBars;

  const minBarsBetweenEvents = config.minBarsBetweenEvents ?? 0;
  if (!isNonNegativeInteger(minBarsBetweenEvents)) {
    throw new Error('minBarsBetweenEvents måste vara ett heltal >= 0.');
  }
  config.minBarsBetweenEvents = minBarsBetweenEvents;

  if (config.allowOverlappingEvents !== undefined && typeof config.allowOverlappingEvents !== 'boolean') {
    throw new Error('allowOverlappingEvents måste vara true eller false om den anges.');
  }
}

function validateStatePeriodStudyConfig(config) {
  ensureString(config.stateField, 'stateField krävs för state_period-studier.');
  ensureString(config.entryState, 'entryState krävs för state_period-studier.');
  ensureString(config.oppositeState, 'oppositeState krävs för state_period-studier.');

  const stateField = getSignalStudyField(config.stateField);
  if (!stateField) {
    throw new Error(`stateField ${config.stateField} finns inte i signal registry.`);
  }

  if (stateField.type !== 'enum') {
    throw new Error(`stateField ${config.stateField} måste vara ett enum-fält i v1.`);
  }

  if (stateField.possibleOptions?.length) {
    if (!stateField.possibleOptions.includes(config.entryState)) {
      throw new Error(`entryState måste vara en av: ${stateField.possibleOptions.join(', ')}`);
    }

    if (!stateField.possibleOptions.includes(config.oppositeState)) {
      throw new Error(`oppositeState måste vara en av: ${stateField.possibleOptions.join(', ')}`);
    }

    if (
      config.neutralState !== undefined &&
      config.neutralState !== null &&
      !stateField.possibleOptions.includes(config.neutralState)
    ) {
      throw new Error(`neutralState måste vara en av: ${stateField.possibleOptions.join(', ')}`);
    }
  }

  if (config.neutralState !== undefined && config.neutralState !== null) {
    ensureString(config.neutralState, 'neutralState måste vara en icke-tom sträng.');
  }

  const neutralEndDays = config.neutralEndDays ?? 0;
  if (!isNonNegativeInteger(neutralEndDays)) {
    throw new Error('neutralEndDays måste vara ett heltal >= 0.');
  }

  const entryDelayBars = config.entryDelayBars ?? 1;
  if (!isNonNegativeInteger(entryDelayBars)) {
    throw new Error('entryDelayBars måste vara ett heltal >= 0.');
  }

  const exitDelayBars = config.exitDelayBars ?? 1;
  if (!isNonNegativeInteger(exitDelayBars)) {
    throw new Error('exitDelayBars måste vara ett heltal >= 0.');
  }

  const maxHoldBars = config.maxHoldBars ?? null;
  if (maxHoldBars !== null && !isPositiveInteger(maxHoldBars)) {
    throw new Error('maxHoldBars måste vara ett positivt heltal om den anges.');
  }
  config.maxHoldBars = maxHoldBars;

  const filtersApplyAt = config.filtersApplyAt ?? 'entry';
  if (!SUPPORTED_FILTERS_APPLY_AT.has(filtersApplyAt)) {
    throw new Error(`filtersApplyAt måste vara en av: ${[...SUPPORTED_FILTERS_APPLY_AT].join(', ')}`);
  }

  validateFilters(config.filters);
}

export function normalizeAndValidateStudyConfig(input) {
  const config = structuredClone(input);

  ensureObject(config, 'Study config måste vara ett JSON-objekt.');
  ensureString(config.name, 'name krävs.');
  ensureString(config.returnInstrument, 'returnInstrument krävs.');

  if (config.signalInstrument !== undefined && config.signalInstrument !== null) {
    ensureString(config.signalInstrument, 'signalInstrument måste vara en icke-tom sträng.');
  }

  if (config.startDate !== undefined && config.startDate !== null) {
    ensureString(config.startDate, 'startDate måste vara en icke-tom sträng om den anges.');
  }

  if (config.endDate !== undefined && config.endDate !== null) {
    ensureString(config.endDate, 'endDate måste vara en icke-tom sträng om den anges.');
  }

  if (!SUPPORTED_STUDY_TYPES.has(config.studyType)) {
    throw new Error(`studyType måste vara en av: ${[...SUPPORTED_STUDY_TYPES].join(', ')}`);
  }

  const conditionMode = normalizeMode(config.conditionMode, 'ALL');
  if (!SUPPORTED_CONDITION_MODES.has(conditionMode)) {
    throw new Error(`conditionMode måste vara en av: ${[...SUPPORTED_CONDITION_MODES].join(', ')}`);
  }
  config.conditionMode = conditionMode;

  if (config.filterMode !== undefined) {
    const filterMode = normalizeMode(config.filterMode, 'ALL');
    if (!SUPPORTED_CONDITION_MODES.has(filterMode)) {
      throw new Error(`filterMode måste vara en av: ${[...SUPPORTED_CONDITION_MODES].join(', ')}`);
    }
    config.filterMode = filterMode;
  }

  if (config.studyType === 'forward_horizon') {
    validateForwardStudyConfig(config);
    return config;
  }

  validateStatePeriodStudyConfig(config);
  return config;
}
