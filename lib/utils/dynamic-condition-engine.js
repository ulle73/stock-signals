import { getSignalStudyField } from '../signal-registry/fields.js';

function resolveRegistryField(fieldKey, registry) {
  if (registry?.getField) {
    return registry.getField(fieldKey);
  }

  return getSignalStudyField(fieldKey);
}

function requireRegistryField(fieldKey, registry) {
  const field = resolveRegistryField(fieldKey, registry);
  if (!field) {
    throw new Error(`Unknown signal study field: ${fieldKey}`);
  }

  return field;
}

function isMissing(value) {
  return value === null || value === undefined || value === '';
}

function coerceValue(field, value) {
  if (field.type === 'number') {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      throw new Error(`Expected numeric value for ${field.key}`);
    }
    return number;
  }

  if (field.type === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }

    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`Expected boolean value for ${field.key}`);
  }

  if (field.type === 'enum') {
    if (typeof value !== 'string') {
      throw new Error(`Expected enum/text value for ${field.key}`);
    }

    if (field.possibleOptions?.length && !field.possibleOptions.includes(value)) {
      throw new Error(`Value ${value} is not allowed for ${field.key}`);
    }
  }

  return value;
}

function compareNumbers(operator, currentValue, comparisonValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(comparisonValue)) {
    return false;
  }

  if (operator === '=') return currentValue === comparisonValue;
  if (operator === '!=') return currentValue !== comparisonValue;
  if (operator === '>') return currentValue > comparisonValue;
  if (operator === '>=') return currentValue >= comparisonValue;
  if (operator === '<') return currentValue < comparisonValue;
  if (operator === '<=') return currentValue <= comparisonValue;
  return false;
}

function compareEnums(operator, currentValue, comparisonValue) {
  if (isMissing(currentValue)) {
    return false;
  }

  if (operator === '=') return currentValue === comparisonValue;
  if (operator === '!=') return currentValue !== comparisonValue;
  return false;
}

export function validateCondition(condition, registry = null) {
  if (!condition?.field) {
    throw new Error('Condition field is required');
  }

  if (!condition?.operator) {
    throw new Error(`Condition operator is required for ${condition.field}`);
  }

  const field = requireRegistryField(condition.field, registry);
  if (!field.allowedOperators.includes(condition.operator)) {
    throw new Error(`Operator ${condition.operator} is not allowed for ${condition.field}`);
  }

  if (condition.operator === 'between') {
    if (!Array.isArray(condition.value) || condition.value.length !== 2) {
      throw new Error(`between requires a two-value array for ${condition.field}`);
    }
    coerceValue(field, condition.value[0]);
    coerceValue(field, condition.value[1]);
    return field;
  }

  if (condition.operator === 'is_true' || condition.operator === 'is_false') {
    return field;
  }

  if (condition.value === undefined) {
    throw new Error(`Condition value is required for ${condition.field}`);
  }

  coerceValue(field, condition.value);
  return field;
}

export function evaluateCondition(condition, { currentBar, previousBar = null, registry = null }) {
  const field = validateCondition(condition, registry);
  const currentValue = currentBar?.values?.[condition.field] ?? null;
  const previousValue = previousBar?.values?.[condition.field] ?? null;

  if (condition.operator === 'is_true') {
    return currentValue === true;
  }

  if (condition.operator === 'is_false') {
    return currentValue === false;
  }

  if (condition.operator === 'between') {
    if (isMissing(currentValue)) {
      return false;
    }

    const [minValue, maxValue] = condition.value.map((value) => coerceValue(field, value));
    const currentNumber = Number(currentValue);
    return Number.isFinite(currentNumber) && currentNumber >= minValue && currentNumber <= maxValue;
  }

  if (condition.operator === 'changed_to') {
    if (isMissing(previousValue) || isMissing(currentValue)) {
      return false;
    }

    const comparisonValue = coerceValue(field, condition.value);
    return currentValue === comparisonValue && previousValue !== comparisonValue;
  }

  if (condition.operator === 'changed_from') {
    if (isMissing(previousValue) || isMissing(currentValue)) {
      return false;
    }

    const comparisonValue = coerceValue(field, condition.value);
    return previousValue === comparisonValue && currentValue !== comparisonValue;
  }

  if (condition.operator === 'crossed_above') {
    if (isMissing(previousValue) || isMissing(currentValue)) {
      return false;
    }

    const threshold = coerceValue(field, condition.value);
    return Number(previousValue) <= threshold && Number(currentValue) > threshold;
  }

  if (condition.operator === 'crossed_below') {
    if (isMissing(previousValue) || isMissing(currentValue)) {
      return false;
    }

    const threshold = coerceValue(field, condition.value);
    return Number(previousValue) >= threshold && Number(currentValue) < threshold;
  }

  if (field.type === 'number') {
    return compareNumbers(condition.operator, Number(currentValue), coerceValue(field, condition.value));
  }

  if (field.type === 'boolean' || field.type === 'enum') {
    return compareEnums(condition.operator, currentValue, coerceValue(field, condition.value));
  }

  return false;
}

export function evaluateConditionSet({
  conditions = [],
  conditionMode = 'ALL',
  currentBar,
  previousBar = null,
  registry = null,
}) {
  if (!conditions.length) {
    return true;
  }

  const evaluations = conditions.map((condition) =>
    evaluateCondition(condition, { currentBar, previousBar, registry })
  );

  return conditionMode === 'ANY'
    ? evaluations.some(Boolean)
    : evaluations.every(Boolean);
}
