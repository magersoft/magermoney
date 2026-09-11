import { QueryClient } from '@tanstack/vue-query';
import {
  persistQueryClient,
  type PersistQueryClientOptions,
} from '@tanstack/query-persist-client-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

const WEEK_MS = 7 * 24 * 3_600_000;

/** How long a cached answer may be restored after the tab was last closed. */
export const PERSIST_MAX_AGE = WEEK_MS;

/**
 * `offlineFirst` is the point of the PWA: a cached answer is served without a
 * network round trip, and a mutation made on a plane is not thrown away.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: WEEK_MS, networkMode: 'offlineFirst', retry: 1 },
    mutations: { networkMode: 'offlineFirst' },
  },
});

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

/**
 * Handed to `VueQueryPlugin`, which gates mounting on the restore. Persisting at
 * module scope instead would race hydration against the first fetches.
 */
export function clientPersister(client: QueryClient): [() => void, Promise<void>] {
  return persistQueryClient(persistOptions(client));
}
