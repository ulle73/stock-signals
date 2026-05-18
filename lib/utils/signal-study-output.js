import fs from 'node:fs/promises';
import path from 'node:path';

function pad(value) {
  return String(value).padStart(2, '0');
}

export function slugifyStudyName(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'signal-study';
}

export function formatUtcTimestampLabel(date = new Date()) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('')
    + '-'
    + [
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
    ].join('');
}

export function buildSignalStudyResultPaths({
  studyName,
  rootDir = process.cwd(),
  now = new Date(),
} = {}) {
  const slug = slugifyStudyName(studyName);
  const timestampLabel = formatUtcTimestampLabel(now);
  const resultsDir = path.join(rootDir, 'studies', 'results');

  return {
    resultsDir,
    slug,
    timestampLabel,
    timestampedPath: path.join(resultsDir, `${slug}--${timestampLabel}.json`),
    latestPath: path.join(resultsDir, `${slug}.latest.json`),
  };
}

export async function writeSignalStudyResultFiles({ paths, payload }) {
  await fs.mkdir(paths.resultsDir, { recursive: true });
  const json = JSON.stringify(payload, null, 2);
  await fs.writeFile(paths.timestampedPath, `${json}\n`, 'utf8');
  await fs.writeFile(paths.latestPath, `${json}\n`, 'utf8');
}
