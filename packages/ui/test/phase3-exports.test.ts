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

  it('exposes the motion presets the phase 3 sheets animate with', () => {
    expect(ui.fade).toMatchObject({ initial: { opacity: 0 }, animate: { opacity: 1 } });
    expect(ui.fade.transition.duration).toBe(0.15);
  });
});
