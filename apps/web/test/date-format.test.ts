import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from '../src/shared/dates/format.js';

describe('date formatting', () => {
  it('prints dates for the locale', () => {
    expect(formatDate('2026-09-11T12:00:00.000Z', 'ru')).toMatch(/11\.09\.2026/);
    expect(formatDate('2026-09-11T12:00:00.000Z', 'en')).toMatch(/Sep 11, 2026/);
    expect(formatDateTime('2026-09-11T12:00:00.000Z', 'en')).toMatch(/2026/);
  });
});
