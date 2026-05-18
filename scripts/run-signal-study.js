import fs from 'node:fs/promises';
import path from 'node:path';
import { closePool } from '../lib/db.js';
import { ensureEnvLoaded } from '../lib/env.js';
import { listSignalStudyFields } from '../lib/signal-registry/fields.js';
import { executeSignalStudy } from '../lib/utils/signal-study-runner.js';

ensureEnvLoaded();

function printUsage() {
  console.log(
    [
      'Användning:',
      '  npm run study:signal -- studies/examples/tf-sync-forward.json',
      '  npm run study:signal -- --list-fields',
    ].join('\n')
  );
}

async function readStudyConfig(configPath) {
  const absolutePath = path.resolve(process.cwd(), configPath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  return {
    config: JSON.parse(raw),
    absolutePath,
  };
}

async function run() {
  const [commandArg] = process.argv.slice(2);

  if (!commandArg || commandArg === '--help' || commandArg === '-h') {
    printUsage();
    return;
  }

  if (commandArg === '--list-fields') {
    console.log(JSON.stringify(listSignalStudyFields(), null, 2));
    return;
  }

  const { config, absolutePath: configPath } = await readStudyConfig(commandArg);
  const payload = await executeSignalStudy({
    config,
    configPath,
    saveResult: true,
  });

  console.log(JSON.stringify(payload, null, 2));
}

run()
  .catch((error) => {
    console.error('study:signal failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
