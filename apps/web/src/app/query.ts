import { QueryClient } from '@tanstack/vue-query';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

const WEEK_MS = 7 * 24 * 3_600_000;

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
persistQueryClient({
  queryClient,
  persister: createAsyncStoragePersister({
    storage: {
      getItem: async (key) => (await get<string>(key)) ?? null,
      setItem: (key, value) => set(key, value),
      removeItem: (key) => del(key),
    },
  }),
  maxAge: WEEK_MS,
});
