import { afterEach, describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import CurrencySelect from '../src/components/currency-select/CurrencySelect.vue';
import type { CurrencyOption } from '../src/components/currency-select/filter';
import '../src/index.js';

const OPTIONS: CurrencyOption[] = [
  { code: 'EUR', kind: 'fiat', name: 'Евро', altName: 'Euro', symbol: '€' },
  { code: 'RUB', kind: 'fiat', name: 'Российский рубль', altName: 'Russian Ruble', symbol: '₽' },
  { code: 'USD', kind: 'fiat', name: 'Доллар США', altName: 'US Dollar', symbol: '$' },
  { code: 'BTC', kind: 'crypto', name: 'Биткоин', altName: 'Bitcoin', symbol: '₿' },
  { code: 'USDT', kind: 'crypto', name: 'Tether', symbol: '₮' },
];

const WORDS = {
  label: 'Валюта',
  placeholder: 'Выберите валюту',
  searchPlaceholder: 'Название или код',
  emptyLabel: 'Такой валюты в списке нет',
  fiatLabel: 'Валюты',
  cryptoLabel: 'Криптовалюты',
  frequentLabel: 'Часто используемые',
};

/** Mounted into the document, because the list is rendered through a portal. */
function mountIt(props: Record<string, unknown> = {}) {
  return mount(CurrencySelect, {
    props: { options: OPTIONS, modelValue: 'EUR', ...WORDS, ...props },
    attachTo: document.body,
  });
}

/*
 * The list lives in a portal on `document.body`, which survives `unmount` in
 * jsdom. Without this, a query in one test reads the previous test's list and
 * the failure looks like a grouping bug.
 */
afterEach(() => {
  document.body.innerHTML = '';
});

const listed = () =>
  [...document.querySelectorAll('[data-slot="combobox-item"]')].map((el) =>
    el.getAttribute('data-testid')?.replace('currency-option-', ''),
  );
const groups = () =>
  [...document.querySelectorAll('[data-slot="combobox-group"]')].map((el) =>
    el.getAttribute('data-testid')?.replace('currency-group-', ''),
  );

async function openAndType(w: ReturnType<typeof mountIt>, text?: string) {
  await w.get('[data-testid="currency-trigger"]').trigger('click');
  await flushPromises();
  if (text !== undefined) {
    const search = document.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
    search.value = text;
    search.dispatchEvent(new Event('input'));
    await flushPromises();
  }
}

describe('CurrencySelect, row variant', () => {
  it('reads as a form row: the label, and the currency’s name', () => {
    const w = mountIt();
    expect(w.text()).toContain('Валюта');
    expect(w.get('[data-testid="currency-value"]').text()).toBe('Евро');
    w.unmount();
  });

  it('opens and groups fiat and crypto under their own headings', async () => {
    const w = mountIt();
    await openAndType(w);

    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    expect(groups()).toEqual(['fiat', 'crypto']);
    expect(document.body.textContent).toContain('Криптовалюты');
    expect(listed()).toEqual(['EUR', 'RUB', 'USD', 'BTC', 'USDT']);
    w.unmount();
  });

  it('finds a currency by a name typed in the other language', async () => {
    const w = mountIt();
    await openAndType(w, 'rubl');
    expect(listed()).toEqual(['RUB']);
    w.unmount();
  });

  it('finds USDT without switching section, and draws no empty fiat heading', async () => {
    const w = mountIt();
    await openAndType(w, 'USDT');
    expect(listed()).toEqual(['USDT']);
    expect(groups()).toEqual(['crypto']);
    w.unmount();
  });

  it('chooses a currency and reports the code', async () => {
    const w = mountIt();
    await openAndType(w);
    document.querySelector<HTMLElement>('[data-testid="currency-option-BTC"]')!.click();
    await flushPromises();
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['BTC']);
    w.unmount();
  });

  it('offers the frequently used ones first, and again in their own group', async () => {
    const w = mountIt({ frequent: ['USD', 'BTC'] });
    await openAndType(w);
    expect(groups()).toEqual(['frequent', 'fiat', 'crypto']);
    expect(listed().slice(0, 2)).toEqual(['USD', 'BTC']);
    w.unmount();
  });

  it('says what is wrong where the value would be, and announces it', () => {
    const w = mountIt({ error: 'Выберите валюту' });
    const trigger = w.get('[data-testid="currency-trigger"]');
    expect(trigger.attributes('aria-invalid')).toBe('true');
    const describedBy = trigger.attributes('aria-describedby');
    expect(describedBy).toBeDefined();
    expect(w.get(`#${CSS.escape(describedBy!)}`).text()).toBe('Выберите валюту');
    w.unmount();
  });

  it('is selectable from the keyboard alone', async () => {
    const w = mountIt();
    await openAndType(w, 'бит');

    const input = document.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flushPromises();
    // The library owns the highlight, and it names it for the screen reader.
    expect(input.getAttribute('aria-activedescendant')).toBeTruthy();

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await flushPromises();
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['BTC']);
    w.unmount();
  });
  it('keeps an already-added currency in the list, marked and unpickable', async () => {
    const w = mountIt({ disabledCodes: ['BTC'], disabledLabel: 'added' });
    await openAndType(w);

    const btc = document.querySelector<HTMLElement>('[data-testid="currency-option-BTC"]')!;
    // Still listed: a currency that vanished would just be searched for again.
    expect(btc).not.toBeNull();
    expect(btc.getAttribute('data-disabled')).not.toBeNull();
    expect(btc.textContent).toContain('added');

    btc.click();
    await flushPromises();
    expect(w.emitted('update:modelValue')).toBeUndefined();
    w.unmount();
  });
});

describe('CurrencySelect, compact variant', () => {
  it('shows only the code, and names itself for the screen reader', () => {
    const w = mountIt({ variant: 'compact', modelValue: 'USD' });
    expect(w.get('[data-testid="currency-value"]').text()).toBe('USD');
    // No visible label beside the amount, so the trigger carries the name.
    expect(w.get('[data-testid="currency-trigger"]').attributes('aria-label')).toBe('Валюта');
    expect(w.text()).not.toContain('Доллар США');
    w.unmount();
  });

  it('opens the same list and chooses from it', async () => {
    const w = mountIt({ variant: 'compact', modelValue: 'USD' });
    await openAndType(w, 'евро');
    expect(listed()).toEqual(['EUR']);
    document.querySelector<HTMLElement>('[data-testid="currency-option-EUR"]')!.click();
    await flushPromises();
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['EUR']);
    w.unmount();
  });
});
