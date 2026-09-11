import { describe, expect, it } from 'vitest';
import { safeRedirect } from '../src/modules/auth/domain/redirect.js';

describe('safeRedirect', () => {
  it('keeps a path inside the app', () => {
    expect(safeRedirect('/settings')).toBe('/settings');
    expect(safeRedirect('/settings?tab=currencies')).toBe('/settings?tab=currencies');
  });

  it('refuses anything that could leave the origin', () => {
    expect(safeRedirect('//evil.test/steal')).toBeUndefined();
    expect(safeRedirect('https://evil.test')).toBeUndefined();
    expect(safeRedirect('/\\evil.test')).toBeUndefined();
    expect(safeRedirect('settings')).toBeUndefined();
    expect(safeRedirect(undefined)).toBeUndefined();
    expect(safeRedirect(['/settings'])).toBeUndefined();
  });
});
