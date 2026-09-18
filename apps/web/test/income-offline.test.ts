import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QueryClient,
  dehydrate,
  hydrate,
  onlineManager,
  type DehydratedState,
} from '@tanstack/vue-query';
import { defaultQueryOptions } from '../src/app/query.js';
import { ACCOUNTS_KEY } from '../src/modules/accounts/offline.js';
import { CREATE_INFLOW_KEY, registerIncomeMutations } from '../src/modules/income/offline.js';
import { inflowDto, SOURCE_ID } from './fixtures/income.js';
import { acc, json } from './fixtures/income-mount.js';

const OWNER = '99999999-9999-4999-8999-999999999999';
const ACCOUNT_ID = '33333333-3333-4333-8333-333333333333';
const clients: QueryClient[] = [];
const newClient = () => {
  const client = new QueryClient({ defaultOptions: defaultQueryOptions });
  client.mount();
  clients.push(client);
  return client;
};
async function whenPaused(client: QueryClient): Promise<void> {
  for (let i = 0; i < 400; i++) {
    if (
      client
        .getMutationCache()
        .getAll()
        .some((m) => m.state.isPaused)
    )
      return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('The mutation never paused');
}
const run = (client: QueryClient, vars: unknown) =>
  client
    .getMutationCache()
    .build(client, {
      ...client.getMutationDefaults(CREATE_INFLOW_KEY),
      mutationKey: CREATE_INFLOW_KEY,
    })
    .execute(vars);

afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) client.unmount();
});

describe('an inflow recorded offline', () => {
  it('is persisted while paused and posted by the next tab', async () => {
    const offline = newClient();
    registerIncomeMutations(
      offline,
      {
        fetch: async () => {
          throw new TypeError('Failed to fetch');
        },
      },
      () => OWNER,
    );
    onlineManager.setOnline(false);
    void run(offline, {
      ownerId: OWNER,
      input: { incomeSourceId: SOURCE_ID, amount: '500' },
    }).catch(() => undefined);
    await whenPaused(offline);
    const persisted = JSON.parse(JSON.stringify(dehydrate(offline))) as DehydratedState;
    expect(persisted.mutations).toHaveLength(1);

    onlineManager.setOnline(true);
    const fetch = vi.fn(async (_path: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(inflowDto, 201) : json([]),
    );
    const restored = newClient();
    registerIncomeMutations(restored, { fetch }, () => OWNER);
    hydrate(restored, persisted);
    await restored.resumePausedMutations();

    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe('/inflows');
    // The owner id decides whether the write may travel; it is never part of the body.
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({
      incomeSourceId: SOURCE_ID,
      amount: '500',
    });
  }, 15000);

  it("is never sent under another account's token, and does not roll that account's cache back to the previous owner's", async () => {
    const fetch = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(inflowDto, 201),
    );
    const client = newClient();
    registerIncomeMutations(client, { fetch }, () => 'somebody-else');
    const theirs = [acc(ACCOUNT_ID, 'USD', { balance: '77' })];
    client.setQueryData(ACCOUNTS_KEY, theirs);

    await expect(
      run(client, {
        ownerId: OWNER,
        input: { incomeSourceId: SOURCE_ID, amount: '500', accountId: ACCOUNT_ID },
      }),
    ).rejects.toThrow();

    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);
    // The optimistic +500 is undone by a refetch, not by restoring a snapshot: after a real
    // sign-out/sign-in that snapshot would be the previous person's accounts.
    const state = client.getQueryState(ACCOUNTS_KEY);
    expect(state?.isInvalidated).toBe(true);
  });
});
