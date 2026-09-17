import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  QueryClient,
  dehydrate,
  hydrate,
  onlineManager,
  type DehydratedState,
} from '@tanstack/vue-query';
import { defaultQueryOptions } from '../src/app/query.js';
import { ApiError } from '../src/shared/api/client.js';
import { RECORD_BALANCE_KEY, registerAccountMutations } from '../src/modules/accounts/index.js';

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const OWNER = '99999999-9999-4999-8999-999999999999';
const entry = {
  id: '22222222-2222-4222-8222-222222222222',
  accountId: ACCOUNT_ID,
  amount: '99',
  recordedAt: '2026-09-11T00:00:00.000Z',
  origin: 'manual',
  transferId: null,
  note: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Mounted, as `VueQueryPlugin` mounts it: an unmounted client never hears the browser come back online. */
const newClient = () => {
  const client = new QueryClient({ defaultOptions: defaultQueryOptions });
  client.mount();
  clients.push(client);
  return client;
};
const clients: QueryClient[] = [];
/** Waits for the mutation the cache is holding to report itself paused. */
async function whenPaused(client: QueryClient): Promise<void> {
  // The retryer sleeps its back-off before it notices there is no network, so
  // the pause can be a second away.
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

afterEach(() => {
  onlineManager.setOnline(true);
  for (const client of clients.splice(0)) client.unmount();
});

describe('mutations made offline', () => {
  it('pauses a network failure and finishes it on reconnect, without the person doing anything', async () => {
    const client = newClient();
    onlineManager.setOnline(false);
    let attempts = 0;
    const settled = client
      .getMutationCache()
      .build(client, {
        mutationFn: async () => {
          attempts += 1;
          // What `fetch` itself rejects with when there is no network.
          if (attempts === 1) throw new TypeError('Failed to fetch');
          return 'recorded';
        },
      })
      .execute(undefined);

    await whenPaused(client);
    expect(attempts).toBe(1);

    onlineManager.setOnline(true);
    await expect(settled).resolves.toBe('recorded');
    expect(attempts).toBe(2);
  }, 15000);

  it('never retries an answer the server actually gave', async () => {
    const client = newClient();
    let attempts = 0;
    const settled = client
      .getMutationCache()
      .build(client, {
        mutationFn: async () => {
          attempts += 1;
          throw new ApiError(400, 'recorded_in_future', 'A balance cannot be dated in the future');
        },
      })
      .execute(undefined);

    await expect(settled).rejects.toBeInstanceOf(ApiError);
    expect(attempts).toBe(1);
  });

  it('replays a recordBalance that was persisted while the tab was closed', async () => {
    // --- The tab that went offline: the mutation pauses and is dehydrated ---
    const offline = newClient();
    registerAccountMutations(
      offline,
      {
        fetch: async () => {
          throw new TypeError('Failed to fetch');
        },
      },
      () => OWNER,
    );
    onlineManager.setOnline(false);
    void offline
      .getMutationCache()
      .build(offline, {
        ...offline.getMutationDefaults(RECORD_BALANCE_KEY),
        mutationKey: RECORD_BALANCE_KEY,
      })
      .execute({ ownerId: OWNER, id: ACCOUNT_ID, input: { amount: '99' } })
      .catch(() => undefined);
    await whenPaused(offline);
    const persisted = JSON.parse(JSON.stringify(dehydrate(offline))) as DehydratedState;
    expect(persisted.mutations).toHaveLength(1);

    // --- The next tab: the defaults are registered, the cache is restored, the POST goes out ---
    onlineManager.setOnline(true);
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return json(entry, 201);
      return json([]);
    });
    const restored = newClient();
    registerAccountMutations(restored, { fetch }, () => OWNER);
    hydrate(restored, persisted);
    await restored.resumePausedMutations();

    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(post?.[0]).toBe(`/accounts/${ACCOUNT_ID}/balances`);
    expect(JSON.parse(post?.[1]?.body as string)).toMatchObject({ amount: '99' });
  });

  it('refuses to replay a write that belongs to another account', async () => {
    // The tab was signed out and signed in as someone else while the write was
    // parked: sending it now would file this money in the wrong journal.
    const fetch = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(entry, 201),
    );
    const client = newClient();
    registerAccountMutations(client, { fetch }, () => 'somebody-else');

    const settled = client
      .getMutationCache()
      .build(client, {
        ...client.getMutationDefaults(RECORD_BALANCE_KEY),
        mutationKey: RECORD_BALANCE_KEY,
      })
      .execute({ ownerId: OWNER, id: ACCOUNT_ID, input: { amount: '99' } });

    await expect(settled).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('sends the write without the owner id in the body', async () => {
    const fetch = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>(async () =>
      json(entry, 201),
    );
    const client = newClient();
    registerAccountMutations(client, { fetch }, () => OWNER);

    await client
      .getMutationCache()
      .build(client, {
        ...client.getMutationDefaults(RECORD_BALANCE_KEY),
        mutationKey: RECORD_BALANCE_KEY,
      })
      .execute({ ownerId: OWNER, id: ACCOUNT_ID, input: { amount: '99' } });

    const post = fetch.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post?.[1]?.body as string)).toEqual({ amount: '99' });
  });
});
