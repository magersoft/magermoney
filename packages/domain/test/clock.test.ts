import { describe, expect, it } from 'vitest';
import { FixedClock, SystemClock } from '../src/index.js';

describe('Clock', () => {
  it('FixedClock returns the fixed instant and its ISO date', () => {
    const clock = new FixedClock(new Date('2026-09-11T23:30:00Z'));
    expect(clock.now().toISOString()).toBe('2026-09-11T23:30:00.000Z');
    expect(clock.today()).toBe('2026-09-11');
  });
  it('SystemClock returns a date close to now', () => {
    expect(Math.abs(new SystemClock().now().getTime() - Date.now())).toBeLessThan(1000);
    expect(new SystemClock().today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
