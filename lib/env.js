import nextEnv from '@next/env';

const { loadEnvConfig } = nextEnv;

let envLoaded = false;

export function ensureEnvLoaded() {
  if (envLoaded) {
    return;
  }

  loadEnvConfig(process.cwd());
  envLoaded = true;
}
