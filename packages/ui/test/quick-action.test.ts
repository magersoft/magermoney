import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import FieldRow from '../src/components/field-row/FieldRow.vue';
import QuickAmountGrid from '../src/components/quick-action/QuickAmountGrid.vue';
import QuickActionSheet from '../src/components/quick-action/QuickActionSheet.vue';
import { sheetUp } from '../src/motion/presets';
import * as ui from '../src/index';

describe('FieldRow', () => {
  const mountField = (props: Record<string, unknown> = {}) =>
    mount(FieldRow, { props: { label: 'Категория', value: 'Продукты', ...props } });

  it('is a control, not a line of text', () => {
    const w = mountField();
    expect(w.element.tagName).toBe('BUTTON');
    expect(w.attributes('type')).toBe('button');
    expect(w.classes().join(' ')).toContain('focus-visible:outline-2');
    expect(w.classes().join(' ')).toContain('min-h-14');
  });

  /*
   * A field without its label is a value nobody can place. The button's name is
   * the pair, so a screen reader hears «Категория, Продукты» rather than
   * «Продукты» on its own, three rows into a form.
   */
  it('is named by its label and its value together', () => {
    const w = mountField();
    const labelId = w.get('[data-slot="field-row-label"]').attributes('id')!;
    const valueId = w.get('[data-slot="field-row-value"]').attributes('id')!;
    expect(labelId).toBeTruthy();
    expect(w.attributes('aria-labelledby')).toBe(`${labelId} ${valueId}`);
    expect(w.get('[data-slot="field-row-label"]').text()).toBe('Категория');
    expect(w.get('[data-slot="field-row-value"]').text()).toBe('Продукты');
  });

  it('shows the placeholder while the field is empty', () => {
    const w = mountField({ value: undefined, placeholder: 'Выбрать' });
    expect(w.get('[data-slot="field-row-value"]').text()).toBe('Выбрать');
    expect(w.attributes('data-empty')).toBe('true');
  });

  it('announces its error rather than only reddening', () => {
    const w = mountField({ error: 'Выберите категорию' });
    const error = w.get('[data-slot="field-row-error"]');
    expect(w.attributes('aria-invalid')).toBe('true');
    expect(w.attributes('aria-describedby')).toBe(error.attributes('id'));
    expect(error.text()).toBe('Выберите категорию');
  });

  it('asks to open its own picker', async () => {
    const w = mountField();
    await w.trigger('click');
    expect(w.emitted('open')).toHaveLength(1);
  });

  it('does not open when it is disabled', async () => {
    const w = mountField({ disabled: true });
    expect(w.attributes('disabled')).toBeDefined();
    await w.trigger('click');
    expect(w.emitted('open')).toBeUndefined();
  });
});

describe('QuickAmountGrid', () => {
  const amounts = ['100.00', '500.00', '1000.00', '5000.00'];

  it('hands back the exact amount it was given, not the one it drew', async () => {
    const w = mount(QuickAmountGrid, {
      props: { amounts, code: 'RUB', ariaLabel: 'Быстрые суммы' },
    });
    const buttons = w.findAll('[data-slot="quick-amount"]');
    expect(buttons).toHaveLength(4);
    await buttons[2]!.trigger('click');
    expect(w.emitted('pick')).toEqual([['1000.00']]);
  });

  it('names the group and gives every button a 44px target', () => {
    const w = mount(QuickAmountGrid, {
      props: { amounts, code: 'RUB', ariaLabel: 'Быстрые суммы' },
    });
    expect(w.attributes('aria-label')).toBe('Быстрые суммы');
    expect(w.get('[data-slot="quick-amount"]').classes().join(' ')).toContain('min-h-11');
  });

  it('is nothing at all when the screen offers no quick amounts', () => {
    const w = mount(QuickAmountGrid, { props: { amounts: [], code: 'RUB' } });
    expect(w.find('[data-slot="quick-amount-grid"]').exists()).toBe(false);
  });
});

describe('QuickActionSheet', () => {
  const props = {
    open: true,
    title: 'Новая операция',
    amount: '0',
    code: 'RUB',
    currencies: ['RUB', 'USD', 'EUR'],
    currencyLabel: 'Валюта',
    amountLabel: 'Сумма',
    types: [
      { value: 'expense', label: 'Расход' },
      { value: 'income', label: 'Доход' },
      { value: 'transfer', label: 'Перевод' },
    ],
    type: 'expense',
    typeLabel: 'Тип операции',
    quickAmounts: ['100.00', '500.00', '1000.00'],
    quickLabel: 'Быстрые суммы',
    confirmLabel: 'Добавить',
    closeLabel: 'Закрыть',
  };

  const mountSheet = async (extra: Record<string, unknown> = {}) => {
    const w = mount(QuickActionSheet, {
      props: { ...props, ...extra },
      slots: { fields: '<div data-test="fields">поля</div>' },
      attachTo: document.body,
    });
    /* The panel is teleported, so it lands a tick after the mount. */
    await nextTick();
    return w;
  };

  const panel = () => document.body.querySelector('[data-slot="quick-action-sheet"]');

  it('opens from the bottom with the amount first and the button last', async () => {
    const w = await mountSheet();
    const sheet = panel()!;
    expect(sheet).toBeTruthy();
    expect(sheet.className).toContain('bottom-0');
    expect(sheet.querySelector('[data-slot="money-input"]')).toBeTruthy();
    expect(sheet.querySelector('[data-slot="segmented-control"]')).toBeTruthy();
    expect(sheet.querySelector('[data-test="fields"]')).toBeTruthy();
    expect(sheet.querySelector('[data-slot="quick-action-footer"] button')!.textContent).toContain(
      'Добавить',
    );
    w.unmount();
  });

  it('puts a currency beside the amount, because one currency is an assumption we cannot make', async () => {
    const w = await mountSheet();
    const currency = panel()!.querySelector<HTMLSelectElement>(
      '[data-slot="quick-action-currency"]',
    )!;
    expect(currency.getAttribute('aria-label')).toBe('Валюта');
    expect(currency.querySelectorAll('option')).toHaveLength(3);
    currency.value = 'USD';
    currency.dispatchEvent(new Event('change', { bubbles: true }));
    await w.vm.$nextTick();
    expect(w.emitted('update:code')).toEqual([['USD']]);
    w.unmount();
  });

  it('changes what kind of operation is being written', async () => {
    const w = await mountSheet();
    const income = panel()!.querySelector<HTMLElement>('[data-value="income"]')!;
    income.click();
    await w.vm.$nextTick();
    expect(w.emitted('update:type')).toEqual([['income']]);
    w.unmount();
  });

  it('fills the amount from the grid above the keyboard', async () => {
    const w = await mountSheet();
    const quick = panel()!.querySelectorAll<HTMLElement>('[data-slot="quick-amount"]');
    expect(quick).toHaveLength(3);
    quick[1]!.click();
    await w.vm.$nextTick();
    expect(w.emitted('update:amount')).toEqual([['500.00']]);
    w.unmount();
  });

  it('confirms once, and not at all while it cannot', async () => {
    const w = await mountSheet({ confirmDisabled: true });
    const confirm = panel()!.querySelector<HTMLButtonElement>(
      '[data-slot="quick-action-footer"] button',
    )!;
    expect(confirm.disabled).toBe(true);
    confirm.click();
    await w.vm.$nextTick();
    expect(w.emitted('confirm')).toBeUndefined();

    await w.setProps({ confirmDisabled: false });
    panel()!.querySelector<HTMLButtonElement>('[data-slot="quick-action-footer"] button')!.click();
    await w.vm.$nextTick();
    expect(w.emitted('confirm')).toHaveLength(1);
    w.unmount();
  });

  it('closes by the button, and asks the screen to close it rather than closing itself', async () => {
    const w = await mountSheet();
    const close = panel()!.querySelector<HTMLButtonElement>('[data-slot="quick-action-close"]')!;
    expect(close.getAttribute('aria-label')).toBe('Закрыть');
    close.click();
    await w.vm.$nextTick();
    expect(w.emitted('update:open')).toEqual([[false]]);
    w.unmount();
  });

  /*
   * A press on the page behind the sheet closes it. The pointer sequence that
   * decides this is the layer's, not ours, and it is the same layer Escape goes
   * through — which the test below actually exercises — so what is asserted
   * here is that the sheet is inside that layer and dims the page behind it.
   */
  it('lies over a dimmed page, inside the layer that a press outside dismisses', async () => {
    const w = await mountSheet();
    expect(panel()!.getAttribute('data-dismissable-layer')).toBe('');
    const overlay = document.body.querySelector('[data-slot="quick-action-overlay"]')!;
    expect(overlay.className).toContain('bg-ink/40');
    expect(overlay.className).toContain('fixed inset-0');
    w.unmount();
  });

  it('closes on Escape', async () => {
    const w = await mountSheet();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await w.vm.$nextTick();
    expect(w.emitted('update:open')).toEqual([[false]]);
    w.unmount();
  });

  /*
   * Opening a sheet moves the focus into it and closing it puts the focus back
   * where it came from. Without the second half, whoever opened the sheet from
   * the keyboard is dropped at the top of the page every time they close it.
   */
  it('takes the focus in and gives it back to whatever opened it', async () => {
    const host = {
      components: { QuickActionSheet },
      data: () => ({ open: false }),
      template: `
        <div>
          <button data-test="trigger" @click="open = true">плюс</button>
          <QuickActionSheet v-bind="$attrs" :open="open" @update:open="open = $event" />
        </div>`,
    };
    const w = mount(host, { attrs: { ...props, open: undefined }, attachTo: document.body });
    const trigger = w.get('[data-test="trigger"]').element as HTMLButtonElement;
    trigger.focus();
    await w.get('[data-test="trigger"]').trigger('click');
    await nextTick();
    await nextTick();
    expect(panel()!.contains(document.activeElement)).toBe(true);

    panel()!.querySelector<HTMLButtonElement>('[data-slot="quick-action-close"]')!.click();
    await nextTick();
    await nextTick();
    expect(document.activeElement).toBe(trigger);
    w.unmount();
  });

  /*
   * The confirm button is what the sheet exists for, so it cannot be the thing
   * the on-screen keyboard covers: the panel is capped in `dvh`, which shrinks
   * with the keyboard, and the footer stays on the bottom edge above the home
   * indicator rather than scrolling away with the fields.
   */
  it('keeps the button reachable past the keyboard and the home indicator', async () => {
    const w = await mountSheet();
    const sheet = panel()!;
    expect(sheet.className).toContain('dvh');
    const footer = sheet.querySelector('[data-slot="quick-action-footer"]')!;
    expect(footer.className).toContain('sticky');
    expect(footer.className).toContain('safe-area-inset-bottom');
    w.unmount();
  });

  it('is nothing in the document until it is opened', async () => {
    const w = await mountSheet({ open: false });
    expect(panel()).toBeNull();
    w.unmount();
  });
});

describe('the sheet’s motion', () => {
  /*
   * A sheet is a bigger object than a card, so it travels further than the 8px
   * of `fadeUp` — but it still settles rather than springs, and it leaves
   * faster than it arrives, because going away must never hold anyone up.
   */
  it('settles from below and leaves faster than it arrives', () => {
    expect(sheetUp.initial.transform).toContain('translateY');
    expect(sheetUp.animate.transform).toBe('translateY(0px)');
    expect(sheetUp.exit.transition.duration).toBeLessThan(sheetUp.transition.duration);
  });
});

describe('the package', () => {
  it('exports the field row, the grid, the sheet and its preset', () => {
    expect(ui.FieldRow).toBeTruthy();
    expect(ui.QuickAmountGrid).toBeTruthy();
    expect(ui.QuickActionSheet).toBeTruthy();
    expect(ui.sheetUp).toBeTruthy();
  });
});
