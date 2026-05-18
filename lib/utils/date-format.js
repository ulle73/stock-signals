function toValidDate(value, { dateOnly = false } = {}) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string') {
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00Z`)
      : new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    if (dateOnly) {
      return null;
    }
  }

  const fallback = new Date(value);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatUtcDate(value, locale = 'sv-SE') {
  const parsed = toValidDate(value, { dateOnly: true });
  if (!parsed) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(parsed);
}

export function formatUtcDateTime(value, locale = 'sv-SE') {
  const parsed = toValidDate(value);
  if (!parsed) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(parsed);
}
