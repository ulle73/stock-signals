function normalizeBoolean(value) {
  return String(value ?? '').trim().toLowerCase() === 'true';
}

export function isSignalStudyLabEnabled(env = process.env) {
  return normalizeBoolean(env.ENABLE_SIGNAL_STUDY_LAB);
}

export function getSignalStudyAccessToken(env = process.env) {
  return env.SIGNAL_STUDY_ACCESS_TOKEN?.trim() || '';
}
