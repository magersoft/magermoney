import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { SessionUser } from '../domain/session';
import { supabase } from './supabase';

/**
 * Who is signed in, kept in sync with the provider. This is UI state — the app
 * shell, the guard and the API client all read it — so Pinia is the right home;
 * nothing here is a business rule.
 */
export const useSessionStore = defineStore('session', () => {
  const user = ref<SessionUser | null>(null);
  const ready = ref(false);

  const adopt = (u: { id: string; email?: string | undefined } | null | undefined): void => {
    user.value = u ? { id: u.id, email: u.email ?? null } : null;
  };

  let started: Promise<void> | undefined;

  /**
   * Read the stored session once, then follow the provider. Awaited before the
   * app mounts, so the first navigation already knows whether it is allowed.
   */
  const init = (): Promise<void> => {
    started ??= (async () => {
      const { data } = await supabase().auth.getSession();
      adopt(data.session?.user);
      supabase().auth.onAuthStateChange((_event, session) => adopt(session?.user));
      ready.value = true;
    })();
    return started;
  };

  return { user, ready, init };
});
