import { describe, expect, it } from 'vitest';
import * as ui from '../src/index';

describe('phase 3 exports', () => {
  it('exposes the hand-written components', () => {
    for (const name of [
      'SegmentedControl',
      'DayOfMonthPicker',
      'PercentInput',
      'ProgressRule',
      'RouteLoading',
      'RouteError',
      'percentToFraction',
      'fractionToPercent',
    ])
      expect(ui).toHaveProperty(name);
  });
  it('exposes the shadcn-vue primitives the phase 3 forms use', () => {
    expect(ui).toHaveProperty('Switch');
  });
});
