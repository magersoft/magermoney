import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FilterChip from '../src/components/chip/FilterChip.vue';
import FilterChipRow from '../src/components/chip/FilterChipRow.vue';
import CategoryChip from '../src/components/chip/CategoryChip.vue';
import type { FilterChipItem } from '../src/components/chip/types';
import * as ui from '../src/index';

const chips: FilterChipItem[] = [
  { id: 'month', label: 'Апрель', removeLabel: 'Снять фильтр: Апрель' },
  { id: 'account', label: 'Visa 2340', removeLabel: 'Снять фильтр: Visa 2340' },
  { id: 'category', label: 'Семья', removeLabel: 'Снять фильтр: Семья' },
];

describe('FilterChip', () => {
  it('shows the value and a remove control the caller has named', () => {
    const w = mount(FilterChip, { props: { label: 'Апрель', removeLabel: 'Снять: Апрель' } });
    expect(w.text()).toContain('Апрель');
    const remove = w.get('[data-slot="filter-chip-remove"]');
    expect(remove.element.tagName).toBe('BUTTON');
    expect(remove.attributes('type')).toBe('button');
    expect(remove.attributes('aria-label')).toBe('Снять: Апрель');
    w.unmount();
  });

  /*
   * The chip stays compact — a row of 44px pills would push the content it
   * filters off the screen — so the target is the icon's hit area, not its box:
   * 24px of glyph plus 10px of reach on each side is exactly 44.
   */
  it('gives the remove control a 44px target without growing the pill', () => {
    const w = mount(FilterChip, { props: { label: 'Апрель', removeLabel: 'Снять' } });
    const remove = w.get('[data-slot="filter-chip-remove"]');
    const classes = remove.classes().join(' ');
    expect(classes).toContain('size-6');
    expect(classes).toContain('after:-inset-2.5');
    expect(classes).toContain('relative');
    w.unmount();
  });

  it('asks to be removed only when the remove control is pressed', async () => {
    const w = mount(FilterChip, { props: { label: 'Апрель', removeLabel: 'Снять' } });
    await w.get('[data-slot="filter-chip"]').trigger('click');
    expect(w.emitted('remove')).toBeUndefined();
    await w.get('[data-slot="filter-chip-remove"]').trigger('click');
    expect(w.emitted('remove')).toHaveLength(1);
    w.unmount();
  });
});

describe('FilterChipRow', () => {
  const mountRow = (props: Record<string, unknown> = {}) =>
    mount(FilterChipRow, { props: { chips, clearLabel: 'Снять все', ...props } });

  it('names the filter that was dropped, so the screen knows what to drop', async () => {
    const w = mountRow();
    expect(w.findAll('[data-slot="filter-chip"]')).toHaveLength(3);
    await w.findAll('[data-slot="filter-chip-remove"]')[1]!.trigger('click');
    expect(w.emitted('remove')).toEqual([['account']]);
    w.unmount();
  });

  it('clears everything at once, as its own control', async () => {
    const w = mountRow();
    const clear = w.get('[data-slot="filter-chip-clear"]');
    expect(clear.text()).toBe('Снять все');
    await clear.trigger('click');
    expect(w.emitted('clear')).toHaveLength(1);
    expect(w.emitted('remove')).toBeUndefined();
    w.unmount();
  });

  it('offers nothing to clear when there is nothing on', () => {
    const w = mountRow({ chips: [] });
    expect(w.find('[data-slot="filter-chip-row"]').exists()).toBe(false);
    expect(w.find('[data-slot="filter-chip-clear"]').exists()).toBe(false);
    w.unmount();
  });

  it('leaves the clear control out when the screen never named one', () => {
    const w = mountRow({ clearLabel: undefined });
    expect(w.findAll('[data-slot="filter-chip"]')).toHaveLength(3);
    expect(w.find('[data-slot="filter-chip-clear"]').exists()).toBe(false);
    w.unmount();
  });

  /*
   * More filters than fit is the normal case, not the edge one: by default the
   * row wraps, and a screen with no vertical room asks for the scroller. Either
   * way the row never widens its parent.
   */
  it('wraps by default and scrolls when the screen asks it to', () => {
    const wrapped = mountRow().get('[data-slot="filter-chip-row"]').classes();
    expect(wrapped).toContain('flex-wrap');
    expect(wrapped).not.toContain('overflow-x-auto');
    // Lines sit 12px apart so the remove targets of two lines never overlap.
    expect(wrapped).toContain('gap-y-3');

    const scrolled = mountRow({ layout: 'scroll' }).get('[data-slot="filter-chip-row"]').classes();
    expect(scrolled).toContain('overflow-x-auto');
    expect(scrolled).not.toContain('flex-wrap');
  });

  it('carries the label the screen wrote for each remove control', () => {
    const w = mountRow();
    expect(
      w.findAll('[data-slot="filter-chip-remove"]').map((b) => b.attributes('aria-label')),
    ).toEqual(chips.map((c) => c.removeLabel));
    w.unmount();
  });
});

describe('CategoryChip', () => {
  const props = { label: 'Продукты', emoji: '🛒' };

  it('shows the emoji and the name, and only the name is announced', () => {
    const w = mount(CategoryChip, { props });
    expect(w.text()).toContain('Продукты');
    const emoji = w.get('[data-slot="category-chip-emoji"]');
    expect(emoji.text()).toBe('🛒');
    expect(emoji.attributes('aria-hidden')).toBe('true');
    w.unmount();
  });

  it('is a toggle button: state is in aria-pressed, not in the fill alone', async () => {
    const w = mount(CategoryChip, { props });
    const chip = w.get('[data-slot="category-chip"]');
    expect(chip.element.tagName).toBe('BUTTON');
    expect(chip.attributes('type')).toBe('button');
    expect(chip.attributes('aria-pressed')).toBe('false');

    await w.setProps({ selected: true });
    expect(chip.attributes('aria-pressed')).toBe('true');
    w.unmount();
  });

  it('asks for the opposite of what it is, and lets the screen own the state', async () => {
    const w = mount(CategoryChip, { props: { ...props, selected: false } });
    await w.get('[data-slot="category-chip"]').trigger('click');
    expect(w.emitted('update:selected')).toEqual([[true]]);

    await w.setProps({ selected: true });
    await w.get('[data-slot="category-chip"]').trigger('click');
    expect(w.emitted('update:selected')?.at(-1)).toEqual([false]);
    w.unmount();
  });

  /*
   * Selected is the brand fill with its own foreground; unselected is the
   * sunken surface. The pair is what `tokens-contrast.test.ts` measures, so the
   * chip has to be reading those tokens and not a colour of its own.
   */
  it('fills with the accent when selected and sits on the sunken surface when not', async () => {
    const w = mount(CategoryChip, { props });
    const chip = () => w.get('[data-slot="category-chip"]').classes().join(' ');
    expect(chip()).toContain('bg-surface-sunken');
    expect(chip()).toContain('text-ink');

    await w.setProps({ selected: true });
    expect(chip()).toContain('bg-accent-fill');
    expect(chip()).toContain('text-primary-foreground');
    w.unmount();
  });

  it('renders without an emoji, for a category that has none', () => {
    const w = mount(CategoryChip, { props: { label: 'Прочее' } });
    expect(w.text()).toContain('Прочее');
    expect(w.find('[data-slot="category-chip-emoji"]').exists()).toBe(false);
    w.unmount();
  });
});

describe('the public surface', () => {
  it('exports both chips and the row', () => {
    expect(ui.FilterChip).toBeTruthy();
    expect(ui.FilterChipRow).toBeTruthy();
    expect(ui.CategoryChip).toBeTruthy();
  });
});
