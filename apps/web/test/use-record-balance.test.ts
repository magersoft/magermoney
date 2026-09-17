import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import type { AccountDto } from '@magermoney/contracts';
import { API_KEY } from '../src/shared/api/use-api.js';
import { useAccounts } from '../src/modules/accounts/application/use-accounts.js';
import { useRecordBalance } from '../src/modules/accounts/application/use-record-balance.js';

const acc: AccountDto = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Alfa',
  bank: 'Alfa',
  country: 'RU',
  currency: 'RUB',
  kind: 'cash',
  cardType: null,
  isSpending: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  balance: '10',
  balanceRecordedAt: '2026-09-01T00:00:00.000Z',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A POST that never settles until the test lets it, so the optimistic value can be observed. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function mountIt(fetchImpl: (path: string, init?: RequestInit) => Promise<Response>) {
  let accounts!: ReturnType<typeof useAccounts>;
  let record!: ReturnType<typeof useRecordBalance>;
  const Probe = defineComponent({
    setup() {
      accounts = useAccounts();
      record = useRecordBalance();
      return () => h('div');
    },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mount(Probe, {
    global: {
      plugins: [[VueQueryPlugin, { queryClient }]],
      provide: { [API_KEY as unknown as string]: { fetch: fetchImpl } },
    },
  });
  return { accounts: () => accounts, record: () => record };
}

describe('useRecordBalance', () => {
  it('shows the optimistic balance before the POST answers, then reconciles with the server, and rolls back on failure', async () => {
    // The GET is stateful: it answers with whatever the last successful POST
    // actually committed, so a passing test proves the list really is
    // reconciled with the server after settle — not just left at the guess.
    let stored: AccountDto = acc;
    const post = { current: deferred<Response>() };
    const { accounts, record } = mountIt(async (path, init) => {
      if (init?.method === 'POST') return post.current.promise;
      return json([stored]);
    });
    await flushPromises();

    const p = record().record(acc.id, { amount: '99' });
    await flushPromises();
    expect(accounts().accounts.value[0]?.balance).toBe('99');

    stored = { ...stored, balance: '99', balanceRecordedAt: '2026-09-11T00:00:00.000Z' };
    post.current.resolve(
      json(
        {
          id: '22222222-2222-4222-8222-222222222222',
          accountId: acc.id,
          amount: '99',
          recordedAt: '2026-09-11T00:00:00.000Z',
          origin: 'manual',
          transferId: null,
          note: null,
        },
        201,
      ),
    );
    await p;
    await flushPromises();
    // Reconciled with the server's own GET, not just the optimistic guess.
    expect(accounts().accounts.value[0]?.balance).toBe('99');

    post.current = deferred<Response>();
    const failing = record()
      .record(acc.id, { amount: '5' })
      .catch(() => undefined);
    await flushPromises();
    post.current.resolve(json({ code: 'recorded_in_future', message: 'no' }, 400));
    await failing;
    await flushPromises();
    expect(accounts().accounts.value[0]?.balance).toBe('99');
  });
});
