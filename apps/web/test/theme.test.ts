import { describe, expect, it } from 'vitest';
import { applyTheme } from '../src/app/theme.js';

describe('applyTheme', () => {
  it('stamps data-theme for explicit choices and clears it for system', () => {
    applyTheme('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    applyTheme('system');
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
