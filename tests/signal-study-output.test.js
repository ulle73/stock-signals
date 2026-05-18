import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  slugifyStudyName,
  formatUtcTimestampLabel,
  buildSignalStudyResultPaths,
} from '../lib/utils/signal-study-output.js';

test('signal study output slugifies study names safely', () => {
  assert.equal(slugifyStudyName('TF Sync Green + Position >= 75'), 'tf-sync-green-position-75');
  assert.equal(slugifyStudyName('   '), 'signal-study');
});

test('signal study output builds stable UTC timestamp labels', () => {
  const date = new Date('2026-05-18T21:14:03.000Z');
  assert.equal(formatUtcTimestampLabel(date), '20260518-211403');
});

test('signal study output builds timestamped and latest result paths', () => {
  const paths = buildSignalStudyResultPaths({
    studyName: 'Breadth Cross Above 50',
    rootDir: 'C:\\dev\\stock-signals',
    now: new Date('2026-05-18T21:14:03.000Z'),
  });

  assert.equal(paths.resultsDir, path.join('C:\\dev\\stock-signals', 'studies', 'results'));
  assert.equal(
    paths.timestampedPath,
    path.join('C:\\dev\\stock-signals', 'studies', 'results', 'breadth-cross-above-50--20260518-211403.json')
  );
  assert.equal(
    paths.latestPath,
    path.join('C:\\dev\\stock-signals', 'studies', 'results', 'breadth-cross-above-50.latest.json')
  );
});
