/**
 * Everything a sign-out has to forget. On a shared device the next person signs
 * in to the same browser, so an answer cached for the previous account — in the
 * query cache, in its IndexedDB mirror, in the service worker's `api` bucket or
 * in a remembered display currency — would be their data on someone else's
 * screen.
 *
 * The owners register their own cleanup at import time; this module knows only
 * that they exist. That keeps `shared` free of any module's subject matter and
 * keeps the wiring impossible to forget: importing the cache is registering it.
 */

/** The runtime cache name the service worker keeps API responses under (`vite.config.ts`). */
export const API_CACHE_NAME = 'api';

type Cleanup = () => void | Promise<void>;

const cleanups = new Set<Cleanup>();

/** Registers a cleanup. Returns a function that unregisters it, for tests. */
export function onClearClientCaches(cleanup: Cleanup): () => void {
  cleanups.add(cleanup);
  return () => cleanups.delete(cleanup);
}

/**
 * Best effort by design: a storage failure must not leave the person signed in
 * with a half-cleared cache, so each cleanup is awaited and its failure logged
 * rather than thrown.
 */
export async function clearClientCaches(): Promise<void> {
  for (const cleanup of cleanups) {
    try {
      await cleanup();
    } catch (error) {
      console.error('Failed to clear a client cache on sign-out', error);
    }
  }

  // Absent in tests, in Node, and on an insecure origin.
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(API_CACHE_NAME);
  } catch (error) {
    console.error('Failed to clear the service worker API cache on sign-out', error);
  }
}
