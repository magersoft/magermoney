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

const mountSegment = (sources: unknown[]) => {
  resetDisplayCurrency();
  return mountAt(
    IncomeSegment,
    '/plan',
    apiOf((p) => (p === '/income-sources' ? json(sources) : undefined)),
  );
};

describe('IncomeSegment', () => {
  it('lists the current sources with their net and pay days, and keeps ended ones behind a disclosure', async () => {
    const { wrapper } = await mountSegment([sourceDto, ended, irregular]);
    await flushPromises();
    const row = wrapper.get(`[data-testid="source-row-${sourceDto.id}"]`);
    expect(row.text()).toContain('Salary');
    expect(row.text()).toContain('765');
    expect(row.text()).toContain('10, 25');
    expect(row.text()).toContain('Основной');
    expect(row.attributes('href')).toBe(`/plan/income/${sourceDto.id}`);
    expect(wrapper.find(`[data-testid="source-row-${ended.id}"]`).exists()).toBe(false);
    await wrapper.get('[data-testid="income-ended-toggle"]').trigger('click');
    expect(wrapper.get(`[data-testid="source-row-${ended.id}"]`).text()).toContain('Old job');
    wrapper.unmount();
  });

  it('reads scheduled money apart from money without a date, each under its own subtotal', async () => {
    const { wrapper } = await mountSegment([sourceDto, irregular]);
    await flushPromises();
    const scheduled = wrapper.get('[data-testid="income-group-scheduled"]');
    expect(scheduled.text()).toContain('По расписанию');
    expect(scheduled.text()).toContain('765');
    expect(scheduled.findAll('[data-testid^="source-row-"]')).toHaveLength(1);
    const irregularGroup = wrapper.get('[data-testid="income-group-irregular"]');
    expect(irregularGroup.text()).toContain('Без расписания');
    expect(irregularGroup.find(`[data-testid="source-row-${irregular.id}"]`).exists()).toBe(true);
    wrapper.unmount();
  });

  it('states the net total and the day its rates come from', async () => {
    const { wrapper } = await mountSegment([sourceDto]);
    await flushPromises();
    expect(wrapper.get('[data-testid="income-net"]').text()).toContain('765');
    expect(wrapper.get('[data-testid="income-rate-note"]').text()).toContain('Курсы на');
    wrapper.unmount();
  });

  it('leaves out a group nobody has a source in', async () => {
    const { wrapper } = await mountSegment([sourceDto]);
    await flushPromises();
    expect(wrapper.find('[data-testid="income-group-irregular"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('invites the first source when there is none', async () => {
    const { wrapper } = await mountSegment([]);
    await flushPromises();
    expect(wrapper.get('[data-testid="income-empty"]').text()).toContain(
      'Пока ни одного источника',
    );
    expect(wrapper.get('[data-testid="income-add"]').attributes('href')).toBe('/plan/income/new');
    wrapper.unmount();
  });
});
