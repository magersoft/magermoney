import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatTile from '../src/components/stat-tile/StatTile.vue';
import { formatDelta, deltaTone } from '../src/components/stat-tile/delta';
import * as ui from '../src/index';

const base = { label: 'Доходы', amount: '8254.32', code: 'USD' };

const mountTile = (props: Record<string, unknown> = {}, slots?: Record<string, string>) =>
  mount(StatTile, { props: { ...base, ...props }, slots });

const delta = (w: ReturnType<typeof mountTile>) => w.find('[data-slot="stat-tile-delta"]');

describe('the delta itself', () => {
  /*
   * The badge is the only coloured thing on the tile, so what it means has to
   * be decided from the number and from what growth means for this tile —
   * income that grows is good news, spending that grows is not.
   */
  it('reads a growing income as good and a growing expense as bad', () => {
    expect(deltaTone(0.05, true)).toBe('good');
    expect(deltaTone(0.05, false)).toBe('bad');
    expect(deltaTone(-0.05, true)).toBe('bad');
    expect(deltaTone(-0.05, false)).toBe('good');
  });

  it('calls a flat month neutral, whichever way the tile points', () => {
    expect(deltaTone(0, true)).toBe('flat');
    expect(deltaTone(0, false)).toBe('flat');
    /* Rounds to 0 % on screen, so it must not claim a direction either. */
    expect(deltaTone(0.0001, true)).toBe('flat');
  });

  it('formats a fraction as a signed percent, in both locales', () => {
    expect(formatDelta(0.05, 'en')).toMatch(/^\+5\s*%$/);
    expect(formatDelta(-0.128, 'en')).toMatch(/^[-−]13\s*%$/);
    expect(formatDelta(0.05, 'ru')).toMatch(/^\+5\s*%$/);
  });

  it('keeps a decimal for a change under one percent, and drops the sign at zero', () => {
    expect(formatDelta(0.004, 'en')).toMatch(/^\+0[.,]4\s*%$/);
    expect(formatDelta(0, 'en')).toMatch(/^0\s*%$/);
  });
});

describe('StatTile', () => {
  it('shows the icon, the label, the amount and the badge', () => {
    const w = mountTile({ delta: 0.05 }, { icon: '<i>ICON</i>' });
    expect(w.text()).toContain('Доходы');
    expect(w.get('[data-slot="stat-tile-icon"]').text()).toBe('ICON');
    expect(w.get('[data-slot="stat-tile-icon"]').attributes('aria-hidden')).toBe('true');
    expect(w.get('[data-amount]').text()).toContain('8,254');
    expect(delta(w).text()).toMatch(/\+5\s*%/);
    w.unmount();
  });

  /*
   * The rule the whole palette rests on (docs/design/direction.md): an amount is
   * ink, and the only colour on the tile belongs to the change.
   */
  it('sets the amount in ink and gives colour to the badge alone', () => {
    const w = mountTile({ delta: 0.05 });
    const amount = w.get('[data-amount]').classes().join(' ');
    expect(amount).not.toMatch(/text-(positive|negative|accent)/);
    expect(w.get('[data-slot="stat-tile-label"]').classes().join(' ')).not.toMatch(
      /text-(positive|negative)/,
    );
    expect(delta(w).classes().join(' ')).toContain('bg-positive-fill');
    w.unmount();
  });

  /*
   * Green is a fill carrying its own dark foreground, never `text-ink`: the
   * pastel is the same colour in both themes, so ink would vanish on it in
   * dark (`tokens-contrast.test.ts` measures the pair).
   */
  it.each([
    [0.05, true, 'good', 'bg-positive-fill', 'text-positive-fg'],
    [0.05, false, 'bad', 'bg-negative-fill', 'text-negative-fg'],
    [-0.05, true, 'bad', 'bg-negative-fill', 'text-negative-fg'],
  ] as const)('fills the badge by meaning: %s, up-is-good %s', (d, up, tone, fill, fg) => {
    const w = mountTile({ delta: d, upIsGood: up });
    const badge = delta(w);
    expect(badge.attributes('data-tone')).toBe(tone);
    expect(badge.classes()).toContain(fill);
    expect(badge.classes()).toContain(fg);
    w.unmount();
  });

  it('carries the direction in the sign and an arrow, not in the colour alone', () => {
    const up = mountTile({ delta: 0.05 });
    expect(up.get('[data-slot="stat-tile-delta"]').attributes('data-direction')).toBe('up');
    expect(up.text()).toContain('+');
    expect(up.find('[data-slot="stat-tile-delta-arrow"]').exists()).toBe(true);
    expect(up.get('[data-slot="stat-tile-delta-arrow"]').attributes('aria-hidden')).toBe('true');
    up.unmount();

    const down = mountTile({ delta: -0.05 });
    expect(down.get('[data-slot="stat-tile-delta"]').attributes('data-direction')).toBe('down');
    expect(down.text()).toMatch(/[-−]/);
    down.unmount();
  });

  /*
   * A month that did not move is a fact worth showing; a month with nothing to
   * compare against is not, and an empty pill would only look broken.
   */
  it('shows a flat month as a neutral badge with no arrow', () => {
    const w = mountTile({ delta: 0 });
    const badge = delta(w);
    expect(badge.exists()).toBe(true);
    expect(badge.attributes('data-tone')).toBe('flat');
    expect(badge.text()).toMatch(/0\s*%/);
    expect(badge.classes().join(' ')).not.toMatch(/bg-(positive|negative)-fill/);
    expect(w.find('[data-slot="stat-tile-delta-arrow"]').exists()).toBe(false);
    w.unmount();
  });

  it.each([undefined, null])('shows no badge at all when the delta is %s', (d) => {
    const w = mountTile({ delta: d });
    expect(delta(w).exists()).toBe(false);
    expect(w.text()).toContain('Доходы');
    w.unmount();
  });

  it('reads the badge out with the period the screen named', () => {
    const w = mountTile({ delta: 0.05, deltaCaption: 'к прошлому месяцу' });
    expect(delta(w).text()).toContain('к прошлому месяцу');
    w.unmount();
  });

  /*
   * As a link the tile is one target, and the whole tile is it: 112px tall,
   * well past the 44px minimum, with a visible ring and the chevron that says
   * it leads somewhere.
   */
  it('becomes a link with a visible focus ring and a chevron', () => {
    const w = mountTile({ as: 'a', href: '/inflows', delta: 0.05 });
    const root = w.get('[data-slot="stat-tile"]');
    expect(root.element.tagName).toBe('A');
    expect(root.attributes('href')).toBe('/inflows');
    const classes = root.classes().join(' ');
    expect(classes).toContain('focus-visible:outline-2');
    expect(classes).toContain('min-h-28');
    expect(w.find('[data-slot="stat-tile-chevron"]').exists()).toBe(true);
    w.unmount();
  });

  /*
   * Two of these sit side by side, and at 320px that is about 140px each — a
   * seven-figure rouble amount set at 22px would run out of the card. The sum
   * therefore steps up only where there is room for it.
   */
  it('sets the amount a step down until there is room for the full size', () => {
    const w = mountTile({ amount: '1240500.00', code: 'RUB', locale: 'ru' });
    const amount = w.get('[data-amount]').classes();
    expect(amount).toContain('text-base');
    expect(amount).toContain('sm:text-lg');
    w.unmount();
  });

  it('is a plain tile, with no chevron, when it leads nowhere', () => {
    const w = mountTile({ delta: 0.05 });
    expect(w.get('[data-slot="stat-tile"]').element.tagName).toBe('DIV');
    expect(w.find('[data-slot="stat-tile-chevron"]').exists()).toBe(false);
    w.unmount();
  });

  it('spells the destination the way the element it renders expects it', () => {
    const w = mountTile({ as: 'div', href: '/inflows' });
    expect(w.get('[data-slot="stat-tile"]').attributes('to')).toBe('/inflows');
    w.unmount();
  });
});

describe('the public surface', () => {
  it('exports the tile and the delta helpers', () => {
    expect(ui.StatTile).toBeTruthy();
    expect(ui.formatDelta).toBeTruthy();
    expect(ui.deltaTone).toBeTruthy();
  });
});
