import { describe, expect, it } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import IncomeSegment from '../src/modules/income/ui/IncomeSegment.vue';
import { sourceDto } from './fixtures/income.js';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

const ended = {
  ...sourceDto,
  id: '55555555-5555-4555-8555-555555555555',
  name: 'Old job',
  isPrimary: false,
  activeTo: '2025-12-31',
};
const irregular = {
  ...sourceDto,
  id: '66666666-6666-4666-8666-666666666666',
  name: 'Other',
  isPrimary: false,
  payDays: [],
  grossAmount: '0',
  netMonthly: '0.00',
};

describe('IncomeSegment', () => {
  it('lists the current sources with their net and pay days, and keeps ended ones behind a disclosure', async () => {
    resetDisplayCurrency();
    const { wrapper } = await mountAt(
      IncomeSegment,
      '/plan',
      apiOf((p) => (p === '/income-sources' ? json([sourceDto, ended, irregular]) : undefined)),
    );
    await flushPromises();
    const row = wrapper.get(`[data-testid="source-row-${sourceDto.id}"]`);
    expect(row.text()).toContain('Salary');
    expect(row.text()).toContain('765.00 USD');
    expect(row.text()).toContain('10, 25');
    expect(row.text()).toContain('Основной');
    expect(row.attributes('href')).toBe(`/plan/income/${sourceDto.id}`);
    expect(wrapper.get(`[data-testid="source-row-${irregular.id}"]`).text()).toContain(
      'Нерегулярный',
    );
    expect(wrapper.find(`[data-testid="source-row-${ended.id}"]`).exists()).toBe(false);
    await wrapper.get('[data-testid="income-ended-toggle"]').trigger('click');
    expect(wrapper.get(`[data-testid="source-row-${ended.id}"]`).text()).toContain('Old job');
    wrapper.unmount();
  });

  it('invites the first source when there is none', async () => {
    const { wrapper } = await mountAt(
      IncomeSegment,
      '/plan',
      apiOf(() => undefined),
    );
    await flushPromises();
    expect(wrapper.get('[data-testid="income-empty"]').text()).toContain(
      'Пока ни одного источника',
    );
    expect(wrapper.get('[data-testid="income-add"]').attributes('href')).toBe('/plan/income/new');
    wrapper.unmount();
  });
});
