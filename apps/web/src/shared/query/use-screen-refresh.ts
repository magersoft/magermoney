import { ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';

/**
 * "Reload what I am looking at", for a pull-to-refresh gesture.
 *
 * The set of queries is not a list a screen maintains: `type: 'active'`
 * refetches exactly the queries some mounted component is currently observing,
 * which is the same thing as "what this screen shows" and stays true when the
 * screen grows a block. A hand-written key list is the version of this that
 * silently stops covering half the screen six months later.
 *
 * `step` is for work that is not a refetch — asking the backend to go and
 * fetch today's rates, say. It runs first, because a refetch that lands before
 * it would read the old numbers, and its failure is reported rather than
 * thrown: the rates provider being unreachable is no reason to leave the rest
 * of the screen stale.
 */
export function useScreenRefresh(step?: () => Promise<unknown>) {
  const qc = useQueryClient();
  const isPending = ref(false);

  /** Resolves `false` when `step` failed — everything else refetched anyway. */
  async function refresh(): Promise<boolean> {
    if (isPending.value) return true;
    isPending.value = true;
    let ok = true;
    try {
      if (step) {
        try {
          await step();
        } catch {
          ok = false;
        }
      }
      await qc.refetchQueries({ type: 'active' });
    } finally {
      isPending.value = false;
    }
    return ok;
  }

  return { refresh, isPending };
}
