import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatDay,
  formatDayAndMonth,
  formatMonth,
  formatTime,
} from '../src/shared/dates/format.js';

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

  it('names a month, and starts it with a capital in both locales', () => {
    expect(formatMonth('2026-09-10', 'ru')).toBe('Сентябрь 2026');
    expect(formatMonth('2026-09-10', 'en')).toBe('September 2026');
  });

  it('drops the year from a day that already sits under its month', () => {
    expect(formatDayAndMonth('2026-09-10', 'ru')).toBe('10 сентября');
    expect(formatDayAndMonth('2026-09-10', 'en')).toBe('Sep 10');
  });

  it('prints the time an entry was recorded at, in the zone it is read in', () => {
    const noon = new Date(2026, 8, 10, 14, 32).toISOString();
    expect(formatTime(noon, 'ru')).toBe('14:32');
    expect(formatTime(noon, 'en')).toMatch(/2:32/);
  });
});
