import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import InputRow from '../src/components/field-row/InputRow.vue';
import SelectRow from '../src/components/field-row/SelectRow.vue';

describe('InputRow', () => {
  const mountRow = (props: Record<string, unknown> = {}) =>
    mount(InputRow, { props: { label: 'Название', modelValue: 'Аренда', ...props } });

  it('is a labelled control, not a row with a caption floating over it', () => {
    const w = mountRow();
    const input = w.get('input');
    const label = w.get('[data-slot="field-row-label"]');
    expect(label.attributes('for')).toBe(input.attributes('id'));
    expect((input.element as HTMLInputElement).value).toBe('Аренда');
    expect(w.get('[data-slot="input-row"]').classes().join(' ')).toContain('min-h-14');
  });

  it('hands back what was typed', async () => {
    const w = mountRow();
    await w.get('input').setValue('Интернет');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['Интернет']);
  });

  it('announces its error rather than only reddening', () => {
    const w = mountRow({ error: 'Впишите название' });
    const error = w.get('[data-slot="field-row-error"]');
    const input = w.get('input');
    expect(input.attributes('aria-invalid')).toBe('true');
    expect(input.attributes('aria-describedby')).toBe(error.attributes('id'));
    expect(error.text()).toBe('Впишите название');
  });

  it('takes the type it is given, so a date is a date', () => {
    expect(
      mountRow({ type: 'date', modelValue: '2026-09-19' }).get('input').attributes('type'),
    ).toBe('date');
  });
});

describe('SelectRow', () => {
  const options = [
    { value: 'monthly', label: 'Каждый месяц' },
    { value: 'yearly', label: 'Раз в год' },
  ];
  const mountRow = (props: Record<string, unknown> = {}) =>
    mount(SelectRow, { props: { label: 'Как часто', modelValue: 'monthly', options, ...props } });

  it('is a native select: the platform picker is the best one on a phone', () => {
    const w = mountRow();
    const select = w.get('select');
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Каждый месяц', 'Раз в год']);
    expect((select.element as HTMLSelectElement).value).toBe('monthly');
    expect(w.get('[data-slot="field-row-label"]').attributes('for')).toBe(select.attributes('id'));
  });

  it('hands back the value that was chosen', async () => {
    const w = mountRow();
    await w.get('select').setValue('yearly');
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual(['yearly']);
  });

  it('announces its error rather than only reddening', () => {
    const w = mountRow({ error: 'Выберите период' });
    const error = w.get('[data-slot="field-row-error"]');
    expect(w.get('select').attributes('aria-invalid')).toBe('true');
    expect(w.get('select').attributes('aria-describedby')).toBe(error.attributes('id'));
  });
});
