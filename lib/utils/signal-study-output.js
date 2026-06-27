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

export function buildSignalStudyResultId({
  studyName,
  now = new Date(),
  createId = null,
} = {}) {
  const slug = slugifyStudyName(studyName);
  const timestampLabel = formatUtcTimestampLabel(now);
  const uniqueId = createId ? createId() : null;

  if (!uniqueId) {
    return `${slug}--${timestampLabel}`;
  }

  return `${slug}--${timestampLabel}--${String(uniqueId).replace(/[^a-zA-Z0-9_-]+/g, '')}`;
}

export function buildSignalStudyStorageRefs({
  studyName,
  storageKind,
  now = new Date(),
  rootDir = process.cwd(),
  resultId = null,
} = {}) {
  if (storageKind === 'none') {
    return {
      storageKind,
      slug: slugifyStudyName(studyName),
      savedResultRef: null,
      savedLatestRef: null,
    };
  }

  if (storageKind === 'filesystem') {
    const paths = buildSignalStudyResultPaths({ studyName, rootDir, now });
    return {
      storageKind,
      slug: paths.slug,
      savedResultRef: paths.timestampedPath,
      savedLatestRef: paths.latestPath,
      paths,
    };
  }

  const slug = slugifyStudyName(studyName);
  return {
    storageKind,
    slug,
    savedResultRef: resultId ? `signal-study-result:${resultId}` : null,
    savedLatestRef: `signal-study-latest:${slug}`,
  };
}

export async function writeSignalStudyResultFiles({ paths, payload }) {
  await fs.mkdir(paths.resultsDir, { recursive: true });
  const json = JSON.stringify(payload, null, 2);
  await fs.writeFile(paths.timestampedPath, `${json}\n`, 'utf8');
  await fs.writeFile(paths.latestPath, `${json}\n`, 'utf8');
}
