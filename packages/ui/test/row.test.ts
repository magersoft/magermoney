import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import TransactionRow from '../src/components/row/TransactionRow.vue';
import CategoryRow from '../src/components/row/CategoryRow.vue';
import RowGroup from '../src/components/row/RowGroup.vue';
import * as ui from '../src/index';

describe('TransactionRow', () => {
  const mountRow = (props: Record<string, unknown> = {}) =>
    mount(TransactionRow, {
      props: {
        title: 'Пятёрочка',
        category: 'Продукты',
        amount: '-1240.50',
        code: 'RUB',
        time: '14:32',
        ...props,
      },
      slots: { icon: '<span data-test="icon">🛒</span>' },
    });

  it('shows the icon, what it was, which category and when', () => {
    const w = mountRow();
    expect(w.find('[data-test="icon"]').exists()).toBe(true);
    expect(w.get('[data-slot="transaction-row-title"]').text()).toBe('Пятёрочка');
    expect(w.get('[data-slot="transaction-row-category"]').text()).toBe('Продукты');
    expect(w.get('[data-slot="transaction-row-time"]').text()).toBe('14:32');
    w.unmount();
  });

  it('sets the amount through the lockup, in ink', () => {
    const w = mountRow();
    const amount = w.get('[data-slot="amount-lockup"]');
    expect(amount.text()).toContain('1');
    // Ink, not colour: the row is a movement, but twenty of them in two
    // colours is a traffic light, which direction.md rules out.
    expect(amount.classes().join(' ')).not.toContain('text-negative');
    w.unmount();
  });

  it('repeats the currency code when the screen carries more than one glyph', () => {
    const w = mountRow({ showCode: true });
    expect(w.get('[data-slot="amount-code"]').text()).toBe('RUB');
    w.unmount();
  });

  /*
   * The row is the target, not the chevron: a chevron that swallows the tap is
   * the classic way a 44px row turns into a 20px one in the corner.
   */
  it('is one target with a chevron that cannot take the tap', () => {
    const w = mountRow({ as: 'a', href: '/expenses/1' });
    expect(w.element.tagName).toBe('A');
    expect(w.attributes('href')).toBe('/expenses/1');
    const classes = w.classes().join(' ');
    expect(classes).toContain('min-h-14');
    expect(classes).toContain('focus-visible:outline-2');
    const chevron = w.get('[data-slot="row-chevron"]');
    expect(chevron.attributes('aria-hidden')).toBe('true');
    expect(chevron.classes().join(' ')).toContain('pointer-events-none');
    w.unmount();
  });

  it('has no chevron when it leads nowhere', () => {
    const w = mountRow();
    expect(w.find('[data-slot="row-chevron"]').exists()).toBe(false);
    w.unmount();
  });

  /*
   * A row whose title is longer than the screen must not push the amount out
   * of it. The title gives; the amount never does.
   */
  it('gives up the title rather than the amount when the name is long', () => {
    const w = mountRow({ title: 'Оплата годовой подписки на хранилище фотографий' });
    expect(w.get('[data-slot="transaction-row-title"]').classes().join(' ')).toContain('truncate');
    expect(w.get('[data-slot="transaction-row-amount"]').classes().join(' ')).toContain('shrink-0');
    w.unmount();
  });
});

describe('CategoryRow', () => {
  const mountRow = (props: Record<string, unknown> = {}) =>
    mount(CategoryRow, {
      props: {
        emoji: '🥑',
        name: 'Продукты',
        spent: '1200.00',
        limit: '1500.00',
        spentValue: 1200,
        limitValue: 1500,
        code: 'USD',
        baseCode: 'USD',
        ...props,
      },
    });

  it('shows the emoji, the name and the pair it is measured against', () => {
    const w = mountRow();
    expect(w.get('[data-slot="category-row-emoji"]').text()).toBe('🥑');
    expect(w.get('[data-slot="category-row-name"]').text()).toBe('Продукты');
    const pair = w.get('[data-slot="category-row-pair"]');
    expect(pair.text()).toContain('1,200');
    expect(pair.text()).toContain('1,500');
    w.unmount();
  });

  it('fills its own bar as far as the budget got', () => {
    const w = mountRow();
    const fill = w.get('[data-slot="category-row-fill"]');
    expect(fill.attributes('style')).toContain('scaleX(0.8)');
    expect(w.attributes('data-over')).toBe('false');
    w.unmount();
  });

  /*
   * Red is the second way of saying it, never the only one: the row states it
   * in the screen's words and marks itself, so the fact survives greyscale, a
   * colour deficiency and a screen reader.
   */
  it('says the limit was passed in words as well as in red', () => {
    const w = mountRow({
      spent: '1800.00',
      spentValue: 1800,
      overLabel: 'Превышен на 300',
    });
    expect(w.attributes('data-over')).toBe('true');
    expect(w.get('[data-slot="category-row-over"]').text()).toContain('Превышен на 300');
    const fill = w.get('[data-slot="category-row-fill"]');
    expect(fill.classes().join(' ')).toContain('bg-negative');
    // The bar cannot go past full, however far past the limit the month went.
    expect(fill.attributes('style')).toContain('scaleX(1)');
    w.unmount();
  });

  it('names the currency when the budget is not kept in the base one', () => {
    const w = mountRow({ code: 'EUR', baseCode: 'USD' });
    expect(w.findAll('[data-slot="amount-code"]').length).toBeGreaterThan(0);
    expect(w.get('[data-slot="category-row-pair"]').text()).toContain('EUR');
    w.unmount();
  });

  it('keeps the code out of the way when the budget is in the base currency', () => {
    const w = mountRow();
    expect(w.find('[data-slot="amount-code"]').exists()).toBe(false);
    w.unmount();
  });

  it('treats a budget of nothing as empty rather than as a division by zero', () => {
    const w = mountRow({ limit: '0.00', limitValue: 0 });
    expect(w.get('[data-slot="category-row-fill"]').attributes('style')).toContain('scaleX(0)');
    expect(w.attributes('data-over')).toBe('false');
    w.unmount();
  });

  it('leads somewhere when the screen gives it a destination', () => {
    const w = mountRow({ as: 'a', href: '/plan/budgets/food' });
    expect(w.element.tagName).toBe('A');
    expect(w.get('[data-slot="row-chevron"]').attributes('aria-hidden')).toBe('true');
    w.unmount();
  });
});

describe('RowGroup', () => {
  const mountGroup = (props: Record<string, unknown> = {}) =>
    mount(RowGroup, {
      props: { title: 'Апрель', amount: '12400.00', code: 'RUB', ...props },
      slots: { default: '<li data-test="row">one</li>' },
    });

  it('heads the group with its subtotal', () => {
    const w = mountGroup();
    const header = w.get('[data-slot="row-group-header"]');
    expect(header.text()).toContain('Апрель');
    expect(w.get('[data-slot="row-group-subtotal"]').text()).toContain('12,400');
    w.unmount();
  });

  /*
   * What separates two rows is the edge of the card around them, not a rule
   * between them — the change direction.md makes when the ledger hairline goes.
   */
  it('groups its rows with a card rather than with dividers', () => {
    const w = mountGroup();
    const list = w.get('[data-slot="row-group-list"]');
    expect(list.element.tagName).toBe('UL');
    expect(list.classes().join(' ')).toContain('bg-surface');
    expect(list.classes().join(' ')).toContain('rounded-xl');
    expect(list.html()).not.toContain('divide-y');
    expect(w.find('[data-test="row"]').exists()).toBe(true);
    w.unmount();
  });

  it('is a plain card when the screen has no group to name', () => {
    const w = mount(RowGroup, { slots: { default: '<li data-test="row">one</li>' } });
    expect(w.find('[data-slot="row-group-header"]').exists()).toBe(false);
    expect(w.find('[data-slot="row-group-list"]').exists()).toBe(true);
    w.unmount();
  });
});

describe('the package', () => {
  it('exports both rows and the group', () => {
    expect(ui.TransactionRow).toBeTruthy();
    expect(ui.CategoryRow).toBeTruthy();
    expect(ui.RowGroup).toBeTruthy();
  });
});
