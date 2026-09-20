import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { API_KEY } from '../src/shared/api/use-api.js';
import { useAccounts } from '../src/modules/accounts/application/use-accounts.js';
import { useIncomeSources } from '../src/modules/income/application/use-income-sources.js';
import { useInflows } from '../src/modules/income/application/use-inflows.js';
import { useCreateInflow } from '../src/modules/income/application/use-inflow-mutations.js';
import { inflowDto, sourceDto, SOURCE_ID } from './fixtures/income.js';
import { acc, cur, json } from './fixtures/income-mount.js';

const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => (resolve = res));
  return { promise, resolve };
}

function mountIt(fetchImpl: (path: string, init?: RequestInit) => Promise<Response>) {
  let accounts!: ReturnType<typeof useAccounts>;
  let inflows!: ReturnType<typeof useInflows>;
  let other!: ReturnType<typeof useInflows>;
  let creator!: ReturnType<typeof useCreateInflow>;
  const Probe = defineComponent({
    setup() {
      accounts = useAccounts();
      // The optimistic row takes its currency from the cached sources, as a real screen has them.
      useIncomeSources();
      inflows = useInflows(() => ({ from: '2026-09-01', to: '2026-09-30' }));
      other = useInflows(() => ({ from: '2026-08-01', to: '2026-08-31' }));
      creator = useCreateInflow();
      return () => h('div');
    },
  });
  mount(Probe, {
    global: {
      plugins: [
        [
          VueQueryPlugin,
          {
            queryClient: new QueryClient({
              defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
            }),
          },
        ],
      ],
      provide: { [API_KEY as unknown as string]: { fetch: fetchImpl } },
    },
  });
  return {
    accounts: () => accounts,
    inflows: () => inflows,
    other: () => other,
    creator: () => creator,
  };
}

describe('useCreateInflow', () => {
  it('shows the receipt and the grown balance before the POST answers, only in the lists it belongs to, and takes both back on failure', async () => {
    const post = deferred<Response>();
    // After the POST is sent every GET blocks, so what is on screen can only be the optimistic patch or its rollback.
    let block = false;
    const blocked: [string, (r: Response) => void][] = [];
    const answer = (path: string) => {
      if (path === '/me/currencies') return json([cur('USD')]);
      if (path === '/income-sources') return json([sourceDto]);
      if (path.startsWith('/inflows')) return json([]);
      return json([acc(ACCOUNT_ID, 'USD', { balance: '10' })]);
    };
    const p = mountIt(async (path, init) => {
      if (init?.method === 'POST') return post.promise;
      if (block) return new Promise<Response>((res) => blocked.push([path, res]));
      return answer(path);
    });
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('10');

    block = true;
    const settled = p
      .creator()
      .create({
        incomeSourceId: SOURCE_ID,
        amount: '5.5',
        receivedOn: '2026-09-10',
        accountId: ACCOUNT_ID,
      })
      .catch(() => 'failed');
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('15.5');
    expect(p.inflows().dtos.value.map((i) => i.amount)).toEqual(['5.5']);
    expect(p.inflows().dtos.value[0]?.currency).toBe('USD');
    expect(p.other().dtos.value).toEqual([]);

    post.resolve(json({ code: 'credit_not_latest', message: 'no' }, 400));
    await flushPromises();
    // The refetch after settle is still blocked, so both of these are `onError`'s rollback.
    expect(p.accounts().accounts.value[0]?.balance).toBe('10');
    expect(p.inflows().dtos.value).toEqual([]);

    // The write resolves once that refetch has answered, as every caller awaits it.
    block = false;
    for (const [path, res] of blocked.splice(0)) res(answer(path));
    expect(await settled).toBe('failed');
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('10');
    expect(p.inflows().dtos.value).toEqual([]);
  });

  it('adds the credited amount, not the inflow amount, when the account is in another currency', async () => {
    const post = deferred<Response>();
    let block: Promise<Response> | null = null;
    const p = mountIt(async (path, init) => {
      if (init?.method === 'POST') return post.promise;
      if (block) return block;
      if (path === '/income-sources') return json([sourceDto]);
      if (path.startsWith('/inflows') || path === '/me/currencies') return json([]);
      return json([acc(ACCOUNT_ID, 'EUR', { balance: '100' })]);
    });
    await flushPromises();
    block = new Promise<Response>(() => undefined);
    void p.creator().create({
      incomeSourceId: SOURCE_ID,
      amount: '500',
      accountId: ACCOUNT_ID,
      creditedAmount: '430',
    });
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('530');
    post.resolve(json({ ...inflowDto, accountId: ACCOUNT_ID, creditedAmount: '430' }, 201));
  });

  it('leaves the balances alone for an inflow that credits nothing', async () => {
    const p = mountIt(async (path, init) => {
      if (init?.method === 'POST') return json(inflowDto, 201);
      if (path === '/income-sources') return json([sourceDto]);
      if (path.startsWith('/inflows') || path === '/me/currencies') return json([]);
      return json([acc(ACCOUNT_ID, 'USD', { balance: '10' })]);
    });
    await flushPromises();
    expect(await p.creator().create({ incomeSourceId: SOURCE_ID, amount: '500' })).toBe('sent');
    await flushPromises();
    expect(p.accounts().accounts.value[0]?.balance).toBe('10');
  });
});
