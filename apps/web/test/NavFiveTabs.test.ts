import { describe, expect, it } from 'vitest';
import { NAV, backTarget, isCurrent } from '../src/shared/layout/nav.js';

describe('the fifth tab', () => {
  it('sits between Plan and Settings', () => {
    expect(NAV.map((i) => i.key)).toEqual(['home', 'accounts', 'plan', 'goals', 'settings']);
  });

  it('stays lit on a goal and on an asset', () => {
    const goals = NAV.find((i) => i.key === 'goals')!;
    expect(isCurrent(goals, '/goals')).toBe(true);
    expect(isCurrent(goals, '/goals/abc')).toBe(true);
    expect(isCurrent(goals, '/assets/abc')).toBe(true);
    expect(isCurrent(goals, '/plan')).toBe(false);
  });

  it('sends the back button of an asset screen to the tab', () => {
    expect(backTarget('/assets/abc')).toBe('/goals');
  });
});
