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
  isPinned: false,
  cardLast4: null,
  cardNetwork: null,
  cardTier: null,
  cardExpires: null,
  colorway: null,
  note: null,
  sortOrder: 0,
  archivedAt: null,
  goalId: null,
  balance: '10',
  balanceRecordedAt: '2026-09-01T00:00:00.000Z',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A response that never settles until the test lets it, so an in-between state can be observed. */
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
    // The server's own truth ('99.00') deliberately differs from the optimistic
    // guess ('99'): only a real GET after settle can produce '99.00', so this
    // assertion is falsifiable by a settle that skips the refetch (e.g. a
    // `refetchType: 'none'` regression), not just by the optimistic patch itself.
    let stored: AccountDto = acc;
    // When set, a GET blocks on this instead of answering immediately — used to
    // prove the rollback value comes from `onError`, not from a refetch that
    // just happens to agree with it.
    let pendingGet: ReturnType<typeof deferred<Response>> | null = null;
    let post = deferred<Response>();
    const { accounts, record } = mountIt(async (path, init) => {
      if (init?.method === 'POST') return post.promise;
      return pendingGet ? pendingGet.promise : json([stored]);
    });
    await flushPromises();
    expect(accounts().accounts.value[0]?.balance).toBe('10');

    // --- Optimistic value, then reconciliation with the server ---
    const p1 = record().record(acc.id, { amount: '99' });
    await flushPromises();
    expect(accounts().accounts.value[0]?.balance).toBe('99');

    stored = { ...stored, balance: '99.00', balanceRecordedAt: '2026-09-11T00:00:00.000Z' };
    post.resolve(
      json(
        {
          id: '22222222-2222-4222-8222-222222222222',
          accountId: acc.id,
          amount: '99',
          recordedAt: '2026-09-11T00:00:00.000Z',
          origin: 'manual',
          transferId: null,
          inflowId: null,
          note: null,
        },
        201,
      ),
    );
    await p1;
    await flushPromises();
    // Only the settle-triggered refetch could have produced this exact value.
    expect(accounts().accounts.value[0]?.balance).toBe('99.00');

    // --- Rollback on a failing POST ---
    post = deferred<Response>();
    pendingGet = deferred<Response>();
    const p2 = record()
      .record(acc.id, { amount: '5' })
      .catch(() => undefined);
    await flushPromises();
    post.resolve(json({ code: 'recorded_in_future', message: 'no' }, 400));
    await flushPromises();
    // The settle-triggered GET is still pending (blocked on `pendingGet`), so
    // this value can only have come from `onError`'s rollback.
    expect(accounts().accounts.value[0]?.balance).toBe('99.00');

    pendingGet.resolve(json([stored]));
    await p2;
    await flushPromises();
    expect(accounts().accounts.value[0]?.balance).toBe('99.00');
  });
});
