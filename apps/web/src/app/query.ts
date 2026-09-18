import { QueryClient, type DefaultOptions } from '@tanstack/vue-query';
import {
  persistQueryClient,
  type PersistQueryClientOptions,
} from '@tanstack/query-persist-client-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import { ACCOUNTS_KEY } from '@/modules/accounts/offline';
import { INFLOWS_KEY } from '@/modules/income/offline';
import { TRANSFERS_KEY } from '@/modules/transfers/offline';
import { isNetworkFailure } from '@/shared/api/client';
import { onClearClientCaches } from '@/shared/cache/client-caches';

const WEEK_MS = 7 * 24 * 3_600_000;
/** One offline failure pauses; the few retries after that are for a flaky connection, not for a busy server. */
const MUTATION_RETRIES = 3;

/** How long a cached answer may be restored after the tab was last closed. */
export const PERSIST_MAX_AGE = WEEK_MS;

/**
 * `offlineFirst` is the point of the PWA: a cached answer is served without a
 * network round trip, and a mutation made on a plane is not thrown away.
 *
 * A mutation is retried only when the request never reached the API. While the
 * browser is offline the retryer pauses it instead of spending an attempt, so
 * the write waits for the connection and goes out by itself. An answer the
 * server gave — 400, 409, 500 — is final and is never sent twice: a second
 * `recordBalance` would be a second entry in the journal.
 */
export const defaultQueryOptions: DefaultOptions = {
  queries: { staleTime: 60_000, gcTime: WEEK_MS, networkMode: 'offlineFirst', retry: 1 },
  mutations: {
    networkMode: 'offlineFirst',
    retry: (failureCount: number, error: Error) =>
      isNetworkFailure(error) && failureCount < MUTATION_RETRIES,
  },
};

export const queryClient = new QueryClient({ defaultOptions: defaultQueryOptions });

/** The cache outlives the tab: IndexedDB, not memory, and not localStorage. */
export const persister = createAsyncStoragePersister({
  storage: {
    getItem: async (key) => (await get<string>(key)) ?? null,
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
});

/**
 * The buster is the app version: a release whose queries changed shape must not
 * hydrate from the previous release's cache.
 */
export function persistOptions(client: QueryClient): PersistQueryClientOptions {
  return { queryClient: client, persister, maxAge: PERSIST_MAX_AGE, buster: __APP_VERSION__ };
}

let cacheRestoredResolve!: () => void;
/**
 * Settles once the persisted cache has been read back, paused mutations
 * included (`dehydrate` keeps exactly those). `VueQueryPlugin` owns the restore,
 * so this is how the rest of the app learns that it has happened.
 */
export const cacheRestored = new Promise<void>((resolve) => {
  cacheRestoredResolve = resolve;
});

/**
 * Handed to `VueQueryPlugin`, which gates mounting on the restore. Persisting at
 * module scope instead would race hydration against the first fetches.
 */
export function clientPersister(client: QueryClient): [() => void, Promise<void>] {
  const [unsubscribe, restored] = persistQueryClient(persistOptions(client));
  void restored.then(cacheRestoredResolve, cacheRestoredResolve);
  return [unsubscribe, restored];
}

/**
 * Sends the writes that were made offline. A mutation restored from IndexedDB
 * is paused until something resumes it, and it must not be resumed before the
 * session is known: it would go out without a token and come back 401.
 */
export async function replayOfflineMutations(client: QueryClient): Promise<void> {
  await client.resumePausedMutations();
  await Promise.all([
    client.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
    client.invalidateQueries({ queryKey: TRANSFERS_KEY }),
    client.invalidateQueries({ queryKey: INFLOWS_KEY }),
  ]);
}

/**
 * Both halves of the cache go at sign-out: the in-memory one, and the copy in
 * IndexedDB that would otherwise hydrate the next account from the previous
 * one. Registered here rather than in `main.ts` so that owning the cache and
 * clearing it cannot drift apart.
 *
 * Mutations still waiting for a connection go with them (`clear` empties the
 * mutation cache too, and `sign-out-clears-caches` holds it to that): they were
 * made by the account that is leaving, and replaying them under the next
 * person's token would write their money into someone else's journal.
 */
onClearClientCaches(async () => {
  queryClient.clear();
  await persister.removeClient();
});
