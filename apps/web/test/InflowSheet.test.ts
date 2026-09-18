import { describe, expect, it, vi } from 'vitest';
import { DOMWrapper, flushPromises } from '@vue/test-utils';
import InflowSheet from '../src/modules/income/ui/InflowSheet.vue';
import { inflowDto, sourceDto, SOURCE_ID } from './fixtures/income.js';
import { acc, apiOf, json, mountAt } from './fixtures/income-mount.js';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@magermoney/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@magermoney/ui')>();
  return { ...actual, useToast: () => ({ toast }) };
});

const USD_ACC = '33333333-3333-4333-8333-333333333333';
const EUR_ACC = '44444444-4444-4444-8444-444444444444';
const GBP_ACC = '55555555-5555-4555-8555-555555555555';
const body = () => new DOMWrapper(document.body);
const patchBody = (calls: [string, RequestInit | undefined][]) =>
  JSON.parse(
    calls.find(([p, i]) => p === `/inflows/${inflowDto.id}` && i?.method === 'PATCH')?.[1]
      ?.body as string,
  ) as Record<string, unknown>;
const postBodies = (calls: [string, RequestInit | undefined][], path: string) =>
  calls
    .filter(([p, i]) => p === path && i?.method === 'POST')
    .map(([, i]) => JSON.parse(i?.body as string));

/** The fixture's source has no default account; these tests also need one that has. */
type Source = Omit<typeof sourceDto, 'defaultAccountId'> & { defaultAccountId: string | null };

function api(
  calls: [string, RequestInit | undefined][],
  sources: Source[] = [{ ...sourceDto, defaultAccountId: USD_ACC }],
) {
  return apiOf((path, init) => {
    calls.push([path, init]);
    if (path === '/income-sources' && init?.method === 'POST')
      return json(
        { ...sourceDto, id: '77777777-7777-4777-8777-777777777777', name: 'Gift', currency: 'EUR' },
        201,
      );
    if (path === '/income-sources') return json(sources);
    if (path === '/inflows' && init?.method === 'POST') return json(inflowDto, 201);
    if (path.startsWith('/inflows') && init?.method === 'PATCH') return json(inflowDto);
    if (path.startsWith('/inflows') && init?.method === 'DELETE')
      return new Response(null, { status: 204 });
    if (path === '/accounts')
      return json([acc(USD_ACC, 'USD'), acc(EUR_ACC, 'EUR'), acc(GBP_ACC, 'GBP')]);
    return undefined;
  });
}

describe('InflowSheet', () => {
  it("defaults to the source's account, asks for the credited amount only across currencies, and posts both", async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls), {
      props: { open: true, sourceId: SOURCE_ID },
    });
    await flushPromises();
    expect((body().get('[data-testid="inflow-account"]').element as HTMLSelectElement).value).toBe(
      USD_ACC,
    );
    expect(body().find('[data-testid="inflow-credited"]').exists()).toBe(false);

    await body().get('[data-testid="inflow-account"]').setValue(EUR_ACC);
    await body().get('[data-testid="inflow-amount"]').setValue('116');
    expect(body().find('[data-testid="inflow-credited"]').exists()).toBe(true);
    // 116 USD at 1 EUR = 1.16 USD
    expect(body().get('[data-testid="inflow-hint"]').text()).toContain('100');
    await body().get('[data-testid="inflow-credited"]').setValue('98');
    expect(body().get('[data-testid="inflow-rate"]').text()).toContain('0.8448275862');

    await body().get('form').trigger('submit');
    await flushPromises();
    const [posted] = postBodies(calls, '/inflows');
    expect(posted).toMatchObject({
      incomeSourceId: SOURCE_ID,
      amount: '116',
      accountId: EUR_ACC,
      creditedAmount: '98',
    });
    // Untouched date: the server stamps today.
    expect(posted).not.toHaveProperty('receivedOn');
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
    wrapper.unmount();
  });

  it('records an inflow without an account, and sends the date once it was touched', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls, [sourceDto]), {
      props: { open: true, sourceId: SOURCE_ID },
    });
    await flushPromises();
    await body().get('[data-testid="inflow-amount"]').setValue('500');
    const date = body().get('[data-testid="inflow-date"]');
    await date.setValue('2026-09-01');
    await date.trigger('change');
    await body().get('form').trigger('submit');
    await flushPromises();
    const [posted] = postBodies(calls, '/inflows');
    expect(posted).toEqual({
      incomeSourceId: SOURCE_ID,
      amount: '500',
      receivedOn: '2026-09-01',
      note: null,
    });
    wrapper.unmount();
  });

  it('creates a source on the fly — no gross, no pay days — and records against it', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls), { props: { open: true } });
    await flushPromises();
    await body().get('[data-testid="inflow-source"]').setValue('__new__');
    await body().get('[data-testid="inflow-new-name"]').setValue('Gift');
    await body().get('[data-testid="inflow-new-currency"]').setValue('EUR');
    await body().get('[data-testid="inflow-amount"]').setValue('50');
    await body().get('form').trigger('submit');
    await flushPromises();
    expect(postBodies(calls, '/income-sources')[0]).toMatchObject({
      name: 'Gift',
      currency: 'EUR',
      grossAmount: '0',
      payDays: [],
      isPrimary: false,
      taxRate: '0',
      commissionRate: '0',
    });
    expect(postBodies(calls, '/inflows')[0]).toMatchObject({
      incomeSourceId: '77777777-7777-4777-8777-777777777777',
      amount: '50',
    });
    wrapper.unmount();
  });

  it('edits an existing inflow, and says in its own words why a frozen one cannot change', async () => {
    toast.mockClear();
    const calls: [string, RequestInit | undefined][] = [];
    const credited = { ...inflowDto, accountId: USD_ACC, creditedAmount: '500' };
    const fetch = apiOf((path, init) => {
      calls.push([path, init]);
      if (init?.method === 'PATCH') return json({ code: 'inflow_not_latest', message: 'x' }, 409);
      if (path === '/income-sources') return json([sourceDto]);
      if (path === '/accounts') return json([acc(USD_ACC, 'USD')]);
      return undefined;
    });
    const { wrapper } = await mountAt(InflowSheet, '/', fetch, {
      props: { open: true, inflow: credited },
    });
    await flushPromises();
    expect((body().get('[data-testid="inflow-amount"]').element as HTMLInputElement).value).toBe(
      '500',
    );
    expect(body().get('[data-testid="inflow-source"]').attributes('disabled')).toBeDefined();
    await body().get('[data-testid="inflow-amount"]').setValue('600');
    await body().get('form').trigger('submit');
    await flushPromises();
    expect(calls.some(([p, i]) => p === `/inflows/${inflowDto.id}` && i?.method === 'PATCH')).toBe(
      true,
    );
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('самое свежее'));
    expect(wrapper.emitted('update:open')).toBeUndefined();
    wrapper.unmount();
  });

  it('drops a credited amount typed for another account, and waits for the new one', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls), {
      props: { open: true, sourceId: SOURCE_ID },
    });
    await flushPromises();
    await body().get('[data-testid="inflow-amount"]').setValue('116');
    await body().get('[data-testid="inflow-account"]').setValue(EUR_ACC);
    await body().get('[data-testid="inflow-credited"]').setValue('98');
    expect((body().get('[data-testid="inflow-credited"]').element as HTMLInputElement).value).toBe(
      '98',
    );

    await body().get('[data-testid="inflow-account"]').setValue(GBP_ACC);
    await flushPromises();
    // 98 was typed in euros; nothing of it may travel as pounds.
    expect((body().get('[data-testid="inflow-credited"]').element as HTMLInputElement).value).toBe(
      '',
    );
    expect(body().get('[data-testid="inflow-save"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it('will not record an amount that is zero however it is written', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls), {
      props: { open: true, sourceId: SOURCE_ID },
    });
    await flushPromises();
    await body().get('[data-testid="inflow-amount"]').setValue('0.00');
    expect(body().get('[data-testid="inflow-save"]').attributes('disabled')).toBeDefined();
    wrapper.unmount();
  });

  it("sends the account and the credited amount together when a credited inflow's amount changes", async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const credited = { ...inflowDto, accountId: EUR_ACC, creditedAmount: '98' };
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls, [sourceDto]), {
      props: { open: true, inflow: credited },
    });
    await flushPromises();
    // The prefilled credited amount survives the account list arriving.
    expect((body().get('[data-testid="inflow-credited"]').element as HTMLInputElement).value).toBe(
      '98',
    );
    await body().get('[data-testid="inflow-amount"]').setValue('600');
    await body().get('[data-testid="inflow-credited"]').setValue('510');
    await body().get('form').trigger('submit');
    await flushPromises();
    // The API recomputes the account's entry from both, and refuses one without the other.
    expect(patchBody(calls)).toMatchObject({
      amount: '600',
      accountId: EUR_ACC,
      creditedAmount: '510',
    });
    wrapper.unmount();
  });

  it('un-credits an inflow by sending a null account, and no credited amount with it', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const credited = { ...inflowDto, accountId: EUR_ACC, creditedAmount: '98' };
    const { wrapper } = await mountAt(InflowSheet, '/', api(calls, [sourceDto]), {
      props: { open: true, inflow: credited },
    });
    await flushPromises();
    await body().get('[data-testid="inflow-account"]').setValue('');
    await body().get('form').trigger('submit');
    await flushPromises();
    const patched = patchBody(calls);
    expect(patched).toMatchObject({ accountId: null });
    expect(patched).not.toHaveProperty('creditedAmount');
    wrapper.unmount();
  });
});
