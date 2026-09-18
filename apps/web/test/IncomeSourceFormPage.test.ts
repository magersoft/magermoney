import { describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import IncomeSourceFormPage from '../src/modules/income/ui/IncomeSourceFormPage.vue';
import { sourceDto } from './fixtures/income.js';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';

vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast: vi.fn() }) };
});

describe('IncomeSourceFormPage', () => {
  it('posts rates as fractions and pay days sorted, previews the net, and opens the new source', async () => {
    let body: Record<string, unknown> | undefined;
    const { wrapper, router } = await mountAt(
      IncomeSourceFormPage,
      '/plan/income/new',
      apiOf((_p, init) => {
        if (init?.method !== 'POST') return undefined;
        body = JSON.parse(init.body as string) as Record<string, unknown>;
        return json(sourceDto, 201);
      }),
    );
    await flushPromises();
    await wrapper.get('[data-testid="source-name"]').setValue('Salary');
    await wrapper.get('[data-testid="source-gross"]').setValue('1000');
    await wrapper.get('[data-testid="source-tax"] input').setValue('15');
    await wrapper.get('[data-testid="source-commission"] input').setValue('10');
    await wrapper.get('[data-testid="day-25"]').trigger('click');
    await wrapper.get('[data-testid="day-10"]').trigger('click');
    // 1000 × 0.85 × 0.9
    expect(wrapper.get('[data-testid="source-net"]').text()).toContain('765.00');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(body).toMatchObject({
      name: 'Salary',
      grossAmount: '1000',
      currency: 'USD',
      taxRate: '0.15',
      commissionRate: '0.1',
      payDays: [10, 25],
      isPrimary: false,
      activeTo: null,
      defaultAccountId: null,
    });
    expect(body?.activeFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(router.currentRoute.value.path).toBe(`/plan/income/${sourceDto.id}`);
    wrapper.unmount();
  });

  it('fills the form from the source being edited and patches it', async () => {
    let method = '';
    const { wrapper } = await mountAt(
      IncomeSourceFormPage,
      `/plan/income/${sourceDto.id}/edit`,
      apiOf((p, init) => {
        if (init?.method === 'PATCH') {
          method = `PATCH ${p}`;
          return json(sourceDto);
        }
        return p === '/income-sources' ? json([sourceDto]) : undefined;
      }),
    );
    await flushPromises();
    expect((wrapper.get('[data-testid="source-name"]').element as HTMLInputElement).value).toBe(
      'Salary',
    );
    expect(wrapper.get('[data-testid="day-10"]').attributes('aria-pressed')).toBe('true');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(method).toBe(`PATCH /income-sources/${sourceDto.id}`);
    wrapper.unmount();
  });
});
