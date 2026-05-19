export function scopeNeedsSignalInstrument(config, fieldsByKey) {
  const selectedKeys = [];

  if (config.studyType === 'forward_horizon') {
    for (const condition of config.conditions ?? []) {
      selectedKeys.push(condition.field);
    }
  } else {
    selectedKeys.push(config.stateField);

    for (const filter of config.filters ?? []) {
      selectedKeys.push(filter.field);
    }
  }

  return selectedKeys.some((key) => fieldsByKey.get(key)?.scope === 'ticker');
}

export function coerceSignalInstrumentSelection({
  config,
  fieldsByKey,
  signalInstrumentOptions,
}) {
  const validValues = new Set(signalInstrumentOptions.map((item) => item.value));
  const needsSignalInstrument = scopeNeedsSignalInstrument(config, fieldsByKey);

  if (!needsSignalInstrument) {
    if (!config.signalInstrument || validValues.has(config.signalInstrument)) {
      return config;
    }

    return {
      ...config,
      signalInstrument: '',
    };
  }

  if (config.signalInstrument && validValues.has(config.signalInstrument)) {
    return config;
  }

  if (validValues.has(config.returnInstrument)) {
    return {
      ...config,
      signalInstrument: config.returnInstrument,
    };
  }

  return {
    ...config,
    signalInstrument: signalInstrumentOptions[0]?.value ?? '',
  };
}
