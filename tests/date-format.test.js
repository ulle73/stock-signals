import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUtcDate, formatUtcDateTime } from '../lib/utils/date-format.js';

test('formatUtcDate formats both date-only and ISO timestamps without throwing', () => {
  assert.equal(formatUtcDate('2026-05-15'), '15 maj 2026');
  assert.equal(formatUtcDate('2026-05-17T22:00:00.000Z'), '17 maj 2026');
});

test('formatUtcDate returns dash for invalid input', () => {
  assert.equal(formatUtcDate('not-a-date'), '—');
  assert.equal(formatUtcDate(null), '—');
});

test('formatUtcDateTime formats ISO timestamps and rejects invalid values', () => {
  assert.match(formatUtcDateTime('2026-05-15T19:30:00.000Z'), /^15 maj 2026/);
  assert.equal(formatUtcDateTime('not-a-date'), '—');
});
