import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DonutChart from '../src/components/donut/DonutChart.vue';
import DonutLegend from '../src/components/donut/DonutLegend.vue';
import {
  DONUT_CIRCUMFERENCE,
  DONUT_GAP,
  DONUT_MIN_ARC,
  layoutDonut,
  segmentHue,
} from '../src/components/donut/segments';
import type { DonutSegment } from '../src/components/donut/types';
import * as ui from '../src/index';

const segments: DonutSegment[] = [
  { id: 'food', label: 'Продукты', value: 800, amount: '800.00', emoji: '🥑' },
  { id: 'home', label: 'Дом', value: 600, amount: '600.00' },
  { id: 'health', label: 'Здоровье', value: 600, amount: '600.00' },
];

const mountDonut = (props: Record<string, unknown> = {}) =>
  mount(DonutChart, {
    props: {
      label: 'Расходы за апрель',
      amount: '2000.00',
      code: 'USD',
      segments,
      legendLabel: 'Категории',
      ...props,
    },
  });

describe('layoutDonut', () => {
  it('gives each segment its share of the ring and a whole percent', () => {
    const arcs = layoutDonut(segments);
    expect(arcs.map((arc) => arc.id)).toEqual(['food', 'home', 'health']);
    expect(arcs.map((arc) => arc.percent)).toEqual([40, 30, 30]);
    expect(arcs[0]!.share).toBeCloseTo(0.4, 5);
  });

  /*
   * The gap is what makes two neighbours readable as two without relying on
   * the colours being far apart, so it is taken out of the arcs rather than
   * added between them — the ring has to stay a ring.
   */
  it('parts neighbouring arcs with a gap taken out of the ring, not added to it', () => {
    const arcs = layoutDonut(segments);
    const drawn = arcs.reduce((total, arc) => total + arc.dash, 0);
    expect(drawn).toBeCloseTo(DONUT_CIRCUMFERENCE - DONUT_GAP * arcs.length, 5);
    expect(arcs[1]!.dash).toBeCloseTo(arcs[2]!.dash, 5);
  });

  it('draws one segment as a closed ring, because there is no neighbour to part from', () => {
    const [only] = layoutDonut([{ id: 'rent', label: 'Аренда', value: 1, amount: '1.00' }]);
    expect(only!.dash).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
    expect(only!.offset).toBe(0);
    expect(only!.percent).toBe(100);
  });

  /*
   * A breakdown is measured against itself; a budget is measured against its
   * limit. Without a denominator of its own the one segment of a budget would
   * always be the whole ring, and a month that spent a third of what it earns
   * would be drawn as a month that spent all of it.
   */
  it('measures the slices against a given whole when there is one', () => {
    const [spent] = layoutDonut([{ id: 'p', label: 'План', value: 25, amount: '25.00' }], 100);
    expect(spent!.share).toBeCloseTo(0.25, 5);
    expect(spent!.percent).toBe(25);
    expect(spent!.dash).toBeCloseTo(DONUT_CIRCUMFERENCE * 0.25, 5);
  });

  it('fills the ring but never overruns it when the whole has been passed', () => {
    const [over] = layoutDonut([{ id: 'p', label: 'План', value: 150, amount: '150.00' }], 100);
    expect(over!.dash).toBeCloseTo(DONUT_CIRCUMFERENCE, 5);
    expect(over!.percent).toBe(100);
  });

  /*
   * A category worth 0.3 % of the month still happened. Rounded to nothing it
   * would disappear from a chart that claims to show the breakdown, so it keeps
   * a tick — and the legend beside it keeps the number that says how small.
   */
  it('keeps a segment too small to draw visible as a tick', () => {
    const arcs = layoutDonut([
      { id: 'rent', label: 'Аренда', value: 999, amount: '999.00' },
      { id: 'gum', label: 'Жвачка', value: 1, amount: '1.00' },
    ]);
    expect(arcs[1]!.dash).toBeGreaterThanOrEqual(DONUT_MIN_ARC);
    expect(arcs[1]!.percent).toBe(0);
  });

  it('drops what cannot be drawn and answers an empty period with no arcs', () => {
    expect(layoutDonut([{ id: 'a', label: 'A', value: 0, amount: '0.00' }])).toEqual([]);
    expect(layoutDonut([{ id: 'a', label: 'A', value: -5, amount: '-5.00' }])).toEqual([]);
    expect(layoutDonut([])).toEqual([]);
  });

  it('hands out hues that stay apart and never move for a given position', () => {
    const hues = Array.from({ length: 8 }, (_, i) => segmentHue(i));
    expect(new Set(hues).size).toBe(8);
    expect(segmentHue(3)).toBe(segmentHue(3));
    expect(hues.every((hue) => hue >= 0 && hue < 360)).toBe(true);
  });
});

describe('DonutChart, as a breakdown', () => {
  it('draws an arc per segment and sets the period total in the middle', () => {
    const w = mountDonut();
    const arcs = w.findAll('[data-slot="donut-arc"]');
    expect(arcs).toHaveLength(3);
    expect(arcs.map((arc) => arc.attributes('data-segment-id'))).toEqual([
      'food',
      'home',
      'health',
    ]);
    const centre = w.get('[data-slot="donut-centre"]');
    expect(centre.find('[data-slot="amount-lockup"]').exists()).toBe(true);
    expect(centre.text()).toContain('2,000');
    w.unmount();
  });

  /*
   * The chart is not a picture of the data, it is the data — so it is named and
   * read out in full. Without this a screen reader gets "graphic" and the one
   * chart in the app says nothing at all.
   */
  it('reads out as a summary rather than as an unnamed graphic', () => {
    const w = mountDonut();
    const chart = w.get('[data-slot="donut-chart"]');
    expect(chart.attributes('role')).toBe('img');
    const summary = chart.attributes('aria-label')!;
    expect(summary).toContain('Расходы за апрель');
    for (const segment of segments) expect(summary).toContain(segment.label);
    expect(summary).toContain('40%');
    w.unmount();
  });

  it('tells the categories apart by name and amount, not only by colour', () => {
    const w = mountDonut();
    const chips = w.findAll('[data-slot="donut-legend-chip"]');
    expect(chips).toHaveLength(3);
    expect(chips[0]!.text()).toContain('Продукты');
    expect(chips[0]!.text()).toContain('800');
    w.unmount();
  });

  it('ties a legend chip to its own segment', async () => {
    const w = mountDonut();
    const chip = w.findAll('[data-slot="donut-legend-chip"]')[1]!;
    expect(chip.attributes('data-segment-id')).toBe('home');
    await chip.trigger('click');
    expect(w.emitted('update:activeId')).toEqual([['home']]);

    await w.setProps({ activeId: 'home' });
    expect(chip.attributes('aria-pressed')).toBe('true');
    const arcs = w.findAll('[data-slot="donut-arc"]');
    expect(arcs[1]!.attributes('data-active')).toBe('true');
    expect(arcs[0]!.attributes('data-active')).toBe('false');

    // Pressing the chip that is already on is how the highlight is let go.
    await chip.trigger('click');
    expect(w.emitted('update:activeId')![1]).toEqual([null]);
    w.unmount();
  });

  it('shows the track and the screen’s own words when the period is empty', () => {
    const w = mountDonut({ segments: [], amount: '0.00', emptyLabel: 'Операций за апрель нет' });
    expect(w.find('[data-slot="donut-arc"]').exists()).toBe(false);
    expect(w.find('[data-slot="donut-track"]').exists()).toBe(true);
    expect(w.attributes('data-empty')).toBe('true');
    expect(w.text()).toContain('Операций за апрель нет');
    expect(w.get('[data-slot="donut-chart"]').attributes('aria-label')).toContain(
      'Операций за апрель нет',
    );
    expect(w.find('[data-slot="donut-legend"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('DonutChart, as progress', () => {
  const mountProgress = (props: Record<string, unknown> = {}) =>
    mount(DonutChart, {
      props: {
        mode: 'progress',
        label: 'Бюджет на апрель',
        amount: '1550.00',
        code: 'USD',
        value: 1550,
        max: 3900,
        caption: 'Потрачено 1 550 из 3 900',
        ...props,
      },
    });

  it('draws a single arc against a track and states how far it got', () => {
    const w = mountProgress();
    const arcs = w.findAll('[data-slot="donut-arc"]');
    expect(arcs).toHaveLength(1);
    // 1550 of 3900 is a little under half the ring, and the drawing has to say
    // the same thing the number does.
    const [drawn] = arcs[0]!.attributes('stroke-dasharray')!.split(' ').map(Number);
    expect(drawn! / DONUT_CIRCUMFERENCE).toBeCloseTo(0.397, 2);
    const chart = w.get('[data-slot="donut-chart"]');
    expect(chart.attributes('role')).toBe('progressbar');
    expect(chart.attributes('aria-valuenow')).toBe('40');
    expect(chart.attributes('aria-valuemin')).toBe('0');
    expect(chart.attributes('aria-valuemax')).toBe('100');
    expect(chart.attributes('aria-valuetext')).toContain('40%');
    expect(w.text()).toContain('Потрачено 1 550 из 3 900');
    w.unmount();
  });

  /*
   * Over the limit the arc can only fill — a ring has nowhere further to go —
   * so the fact has to be carried in words as well as in the red.
   */
  it('says the limit was passed in words, not only in red', () => {
    const w = mountProgress({ value: 4200, amount: '4200.00', overLabel: 'Лимит превышен' });
    expect(w.attributes('data-over')).toBe('true');
    expect(w.text()).toContain('Лимит превышен');
    const chart = w.get('[data-slot="donut-chart"]');
    expect(chart.attributes('aria-valuenow')).toBe('100');
    expect(chart.attributes('aria-valuetext')).toContain('Лимит превышен');
    expect(w.get('[data-slot="donut-arc"]').attributes('data-over')).toBe('true');
    w.unmount();
  });

  it('treats a budget of nothing as empty rather than as a division by zero', () => {
    const w = mountProgress({ value: 0, max: 0, amount: '0.00', emptyLabel: 'Бюджет не задан' });
    expect(w.attributes('data-empty')).toBe('true');
    expect(w.get('[data-slot="donut-chart"]').attributes('aria-valuenow')).toBe('0');
    expect(w.find('[data-slot="donut-arc"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('the period arrows', () => {
  const arrows = {
    period: 'Апрель 2026',
    prevLabel: 'Предыдущий месяц',
    nextLabel: 'Следующий месяц',
  };

  it('turns the period with named controls the keyboard reaches', async () => {
    const w = mountDonut(arrows);
    const prev = w.get('[data-slot="donut-prev"]');
    const next = w.get('[data-slot="donut-next"]');
    for (const control of [prev, next]) {
      expect(control.element.tagName).toBe('BUTTON');
      expect(control.attributes('type')).toBe('button');
    }
    expect(prev.attributes('aria-label')).toBe('Предыдущий месяц');
    expect(next.attributes('aria-label')).toBe('Следующий месяц');
    expect(w.get('[data-slot="donut-period"]').text()).toBe('Апрель 2026');

    await prev.trigger('click');
    await next.trigger('click');
    expect(w.emitted('prev')).toHaveLength(1);
    expect(w.emitted('next')).toHaveLength(1);
    w.unmount();
  });

  it('gives each arrow a 44px target', () => {
    const w = mountDonut(arrows);
    for (const slot of ['donut-prev', 'donut-next']) {
      expect(w.get(`[data-slot="${slot}"]`).classes().join(' ')).toContain('size-11');
    }
    w.unmount();
  });

  it('cannot be asked for a period that is not there', async () => {
    const w = mountDonut({ ...arrows, nextDisabled: true });
    const next = w.get('[data-slot="donut-next"]');
    expect(next.attributes('disabled')).toBeDefined();
    await next.trigger('click');
    expect(w.emitted('next')).toBeUndefined();
    w.unmount();
  });

  it('leaves the arrows out when the screen does not turn the period', () => {
    const w = mountDonut();
    expect(w.find('[data-slot="donut-prev"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('DonutLegend', () => {
  it('draws nothing at all when there is nothing to list', () => {
    const w = mount(DonutLegend, { props: { arcs: [], code: 'USD' } });
    expect(w.find('[data-slot="donut-legend"]').exists()).toBe(false);
    w.unmount();
  });

  it('gives every chip a 44px target on a coarse pointer', () => {
    const w = mount(DonutLegend, { props: { arcs: layoutDonut(segments), code: 'USD' } });
    expect(w.get('[data-slot="donut-legend-chip"]').classes().join(' ')).toContain(
      'pointer-coarse:min-h-11',
    );
    w.unmount();
  });
});

describe('the package', () => {
  it('exports the donut, its legend and its layout', () => {
    expect(ui.DonutChart).toBeTruthy();
    expect(ui.DonutLegend).toBeTruthy();
    expect(ui.layoutDonut).toBeTypeOf('function');
    expect(ui.segmentHue).toBeTypeOf('function');
  });
});
