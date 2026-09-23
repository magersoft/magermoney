import { describe, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import CountrySelect from '../src/components/country-select/CountrySelect.vue';
import type { CountryOption } from '../src/components/country-select/filter';
import '../src/index.js';

const OPTIONS: CountryOption[] = [
  { code: 'DE', name: 'Германия' },
  { code: 'PT', name: 'Португалия' },
  { code: 'RU', name: 'Россия' },
];

const WORDS = {
  label: 'Страна',
  placeholder: 'Выберите страну',
  searchPlaceholder: 'Страна или код',
  emptyLabel: 'Такой страны в списке нет',
  clearLabel: 'Очистить страну',
};

/** Mounted into the document, because the list is rendered through a portal. */
function open(modelValue: string | null = null) {
  const w = mount(CountrySelect, {
    props: { options: OPTIONS, modelValue, ...WORDS },
    attachTo: document.body,
  });
  return w;
}
const listed = () =>
  [...document.querySelectorAll('[data-slot="combobox-item"]')].map((el) =>
    el.getAttribute('data-testid')?.replace('country-option-', ''),
  );

describe('CountrySelect', () => {
  it('reads as a row with nothing chosen yet', () => {
    const w = open();
    expect(w.text()).toContain('Страна');
    expect(w.get('[data-testid="country-value"]').text()).toBe('Выберите страну');
    expect(w.find('[data-testid="country-clear"]').exists()).toBe(false);
    w.unmount();
  });

  it('opens on the row and offers every country', async () => {
    const w = open();
    await w.get('[data-testid="country-trigger"]').trigger('click');
    await flushPromises();

    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    expect(listed()).toEqual(['DE', 'PT', 'RU']);
    w.unmount();
  });

  it('narrows the list by name and by code', async () => {
    const w = open();
    await w.get('[data-testid="country-trigger"]').trigger('click');
    await flushPromises();

    const search = document.querySelector<HTMLInputElement>('[data-slot="combobox-input"]')!;
    search.value = 'порт';
    search.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(listed()).toEqual(['PT']);

    search.value = 'de';
    search.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(listed()).toEqual(['DE']);
    w.unmount();
  });

  it('chooses a country and says so in the row', async () => {
    const w = open();
    await w.get('[data-testid="country-trigger"]').trigger('click');
    await flushPromises();

    document.querySelector<HTMLElement>('[data-testid="country-option-PT"]')!.click();
    await flushPromises();

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['PT']);
    w.unmount();
  });

  it('starts on the country the account already has, and lets it go', async () => {
    const w = open('PT');
    expect(w.get('[data-testid="country-value"]').text()).toBe('Португалия');

    await w.get('[data-testid="country-clear"]').trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([null]);
    w.unmount();
  });

  it('still offers every country when it opens on one already chosen', async () => {
    const w = open('PT');
    await w.get('[data-testid="country-trigger"]').trigger('click');
    await flushPromises();
    expect(listed()).toEqual(['DE', 'PT', 'RU']);
    w.unmount();
  });

  it('says what is wrong where the value would be, and announces it', () => {
    const w = mount(CountrySelect, {
      props: { options: OPTIONS, modelValue: null, ...WORDS, error: 'Выберите страну' },
      attachTo: document.body,
    });
    const trigger = w.get('[data-testid="country-trigger"]');
    expect(trigger.attributes('aria-invalid')).toBe('true');
    const describedBy = trigger.attributes('aria-describedby');
    expect(describedBy).toBeDefined();
    expect(w.get(`#${CSS.escape(describedBy!)}`).text()).toBe('Выберите страну');
    w.unmount();
  });
});

describe('CountrySelect, several at once', () => {
  const several = (modelValue: string[] = []) =>
    mount(CountrySelect, {
      props: {
        options: OPTIONS,
        modelValue,
        multiple: true,
        removeLabel: (name: string) => `Убрать: ${name}`,
        ...WORDS,
      },
      attachTo: document.body,
    });

  it('adds a country, keeps the list open and ticks what is in', async () => {
    document.body.innerHTML = '';
    const w = several(['DE']);
    await w.get('[data-testid="country-trigger"]').trigger('click');
    await flushPromises();

    const de = document.querySelector<HTMLElement>('[data-testid="country-option-DE"]')!;
    expect(de.querySelector('[data-slot="country-check"]')).not.toBeNull();
    document.querySelector<HTMLElement>('[data-testid="country-option-PT"]')!.click();
    await flushPromises();

    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['DE', 'PT']]);
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    w.unmount();
  });

  it('states the choice as chips that each drop one, with no clear-all in the row', async () => {
    const w = several(['DE', 'RU']);

    expect(w.findAll('[data-slot="filter-chip"]').map((c) => c.text())).toEqual([
      'Германия',
      'Россия',
    ]);
    expect(w.find('[data-testid="country-clear"]').exists()).toBe(false);
    expect(w.get('[data-testid="country-value"]').text()).toBe('Выберите страну');

    const remove = w.findAll('[data-slot="filter-chip-remove"]');
    expect(remove[0]!.attributes('aria-label')).toBe('Убрать: Германия');
    await remove[0]!.trigger('click');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([['RU']]);
    w.unmount();
  });
});
