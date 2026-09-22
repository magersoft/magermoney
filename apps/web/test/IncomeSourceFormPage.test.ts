import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import { resetDisplayCurrency } from '../src/modules/rates/application/use-display-currency.js';
import IncomeSourceFormPage from '../src/modules/income/ui/IncomeSourceFormPage.vue';
import { sourceDto } from './fixtures/income.js';
import { apiOf, json, mountAt } from './fixtures/income-mount.js';
import { pickCurrency } from './fixtures/currency-picker.js';

vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast: vi.fn() }) };
});

/** The sheet is portalled to the body, so that is where the form is read from. */
const sheet = () => new DOMWrapper(document.body);
const field = (testid: string) => sheet().get(`[data-testid="${testid}"] input`);
const amount = () => sheet().get('[data-slot="quick-action-amount"] input');
const confirm = () => sheet().get('[data-slot="quick-action-confirm"]');

describe('IncomeSourceFormPage', () => {
  // The display currency is one instance for the whole app; each mount gets its own.
  beforeEach(() => resetDisplayCurrency());

  it('opens a new source in the currency the screens already report in', async () => {
    const { wrapper } = await mountAt(
      IncomeSourceFormPage,
      '/plan/income/new',
      apiOf((p) =>
        p === '/me'
          ? json({
              id: '11111111-1111-4111-8111-111111111111',
              displayName: null,
              locale: 'ru',
              defaultCurrency: 'RUB',
              reportingCurrencies: ['RUB', 'USD'],
              onboardingCompletedAt: null,
            })
          : undefined,
      ),
    );
    await flushPromises();
    expect(
      sheet().get('[data-testid="source-currency"] [data-testid="currency-value"]').text(),
    ).toBe('RUB');

    /* Searched by name, like every other currency field in the app. */
    await pickCurrency(sheet().get('[data-testid="source-currency"]').element, 'USD');
    expect(
      sheet().get('[data-testid="source-currency"] [data-testid="currency-value"]').text(),
    ).toBe('USD');
    wrapper.unmount();
  });

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
    await field('source-name').setValue('Salary');
    await amount().setValue('1000');
    await sheet().get('[data-testid="source-tax"] input').setValue('15');
    await sheet().get('[data-testid="source-commission"] input').setValue('10');
    await sheet().get('[data-testid="day-25"]').trigger('click');
    await sheet().get('[data-testid="day-10"]').trigger('click');
    // 1000 × 0.85 × 0.9
    expect(sheet().get('[data-testid="source-net"]').text()).toContain('765.00');
    await confirm().trigger('click');
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
    expect((field('source-name').element as HTMLInputElement).value).toBe('Salary');
    expect(sheet().get('[data-testid="day-10"]').attributes('aria-pressed')).toBe('true');
    await confirm().trigger('click');
    await flushPromises();
    expect(method).toBe(`PATCH /income-sources/${sourceDto.id}`);
    wrapper.unmount();
  });
});
