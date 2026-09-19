import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatDay } from '../src/shared/dates/format.js';

describe('date formatting', () => {
  it('prints dates for the locale', () => {
    expect(formatDate('2026-09-11T12:00:00.000Z', 'ru')).toMatch(/11\.09\.2026/);
    expect(formatDate('2026-09-11T12:00:00.000Z', 'en')).toMatch(/Sep 11, 2026/);
    expect(formatDateTime('2026-09-11T12:00:00.000Z', 'en')).toMatch(/2026/);
  });

  it('formats a calendar date as that day, whatever the zone', () => {
    expect(formatDay('2026-09-10', 'ru')).toBe('10.09.2026');
    expect(formatDay('2026-09-10', 'en')).toBe('Sep 10, 2026');
  });
});
