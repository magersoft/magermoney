import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import MarkDisc from '../src/components/mark/MarkDisc.vue';
import MarkPicker from '../src/components/mark/MarkPicker.vue';
import { ACCOUNT_COLORWAYS } from '../src/components/account-card/palette';

const LABELS = {
  emoji: 'Emoji',
  color: 'Colour',
  initial: 'First letter',
  none: 'No colour',
  colors: Object.fromEntries(ACCOUNT_COLORWAYS.map((c) => [c, c.toUpperCase()])),
};

describe('MarkDisc', () => {
  it('draws the emoji on the colour it was given, with that colour’s ink', () => {
    const disc = mount(MarkDisc, { props: { emoji: '🚗', name: 'Car', color: 'amber' } });
    expect(disc.text()).toBe('🚗');
    expect(disc.attributes('data-color')).toBe('amber');
    expect(disc.classes()).toContain('bg-card-fill');
    expect(disc.attributes('style')).toContain('--mm-card-ink');
  });

  it('falls back to the first letter of the name on the plain surface', () => {
    const disc = mount(MarkDisc, { props: { emoji: null, name: 'ярослав', color: null } });
    expect(disc.text()).toBe('Я');
    expect(disc.attributes('data-color')).toBeUndefined();
    expect(disc.classes()).toContain('bg-surface-sunken');
  });

  it('takes the whole first grapheme, and leaves the disc empty for no name', () => {
    expect(mount(MarkDisc, { props: { name: '🇯🇵 trip' } }).text()).toBe('🇯🇵');
    expect(mount(MarkDisc, { props: { name: '  ' } }).text()).toBe('');
  });

  it('is decoration: the name beside it is what a screen reader reads', () => {
    expect(mount(MarkDisc, { props: { name: 'Car' } }).attributes('aria-hidden')).toBe('true');
  });
});

const picker = (emoji: string | null = null, color: string | null = null) =>
  mount(MarkPicker, {
    props: {
      emoji,
      color,
      name: 'Car',
      emojis: ['🚗', '🏠', '✈️'],
      labels: LABELS,
      'onUpdate:emoji': () => {},
      'onUpdate:color': () => {},
    },
    attachTo: document.body,
  });

describe('MarkPicker', () => {
  it('offers the first letter, then the emoji; and no colour, then the palette', () => {
    const w = picker();
    const emojis = w.findAll('[data-testid^="mark-emoji-"]');
    expect(emojis.map((e) => e.attributes('data-testid'))).toEqual([
      'mark-emoji-initial',
      'mark-emoji-🚗',
      'mark-emoji-🏠',
      'mark-emoji-✈️',
    ]);
    expect(w.get('[data-testid="mark-emoji-initial"]').text()).toBe('C');
    const colors = w.findAll('[data-testid^="mark-color-"]');
    expect(colors).toHaveLength(ACCOUNT_COLORWAYS.length + 1);
    expect(colors[0]?.attributes('aria-label')).toBe('No colour');
    w.unmount();
  });

  it('is two radio groups, each with the current choice checked and one tab stop', () => {
    const w = picker('🏠', 'teal');
    const groups = w.findAll('[role="radiogroup"]');
    expect(groups).toHaveLength(2);
    const checkedEmoji = w.get('[data-testid="mark-emoji-🏠"]');
    expect(checkedEmoji.attributes('aria-checked')).toBe('true');
    expect(checkedEmoji.attributes('tabindex')).toBe('0');
    expect(w.get('[data-testid="mark-emoji-🚗"]').attributes('tabindex')).toBe('-1');
    expect(w.get('[data-testid="mark-color-teal"]').attributes('aria-checked')).toBe('true');
    w.unmount();
  });

  it('emits the choice on a tap, and null for the first-letter and no-colour choices', async () => {
    const w = picker('🏠', 'teal');
    await w.get('[data-testid="mark-emoji-🚗"]').trigger('click');
    await w.get('[data-testid="mark-color-pink"]').trigger('click');
    await w.get('[data-testid="mark-emoji-initial"]').trigger('click');
    await w.get('[data-testid="mark-color-none"]').trigger('click');
    expect(w.emitted('update:emoji')).toEqual([['🚗'], [null]]);
    expect(w.emitted('update:color')).toEqual([['pink'], [null]]);
    w.unmount();
  });

  it('walks each group with the arrow keys, wrapping, and moves focus with the choice', async () => {
    const w = picker('✈️', null);
    const group = w.get('[data-testid="mark-emoji"]');
    await group.trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:emoji')?.at(-1)).toEqual([null]);
    await nextTick();
    expect(document.activeElement?.getAttribute('data-testid')).toBe('mark-emoji-initial');
    await group.trigger('keydown', { key: 'ArrowLeft' });
    expect(w.emitted('update:emoji')?.at(-1)).toEqual(['🏠']);
    await group.trigger('keydown', { key: 'Home' });
    expect(w.emitted('update:emoji')?.at(-1)).toEqual([null]);
    await w.get('[data-testid="mark-color"]').trigger('keydown', { key: 'ArrowLeft' });
    expect(w.emitted('update:color')?.at(-1)).toEqual([ACCOUNT_COLORWAYS.at(-1)]);
    w.unmount();
  });

  it('keeps a stored emoji the grid no longer deals, checked, so the choice stays visible', () => {
    const w = picker('🦄');
    const stored = w.get('[data-testid="mark-emoji-🦄"]');
    expect(stored.attributes('aria-checked')).toBe('true');
    w.unmount();
  });
});
