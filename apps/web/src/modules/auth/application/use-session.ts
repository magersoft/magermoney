import { err, ok, type Result } from 'neverthrow';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import type { SessionUser } from '../domain/session';
import { supabase } from '../infrastructure/supabase';
import { useSessionStore } from '../infrastructure/session-store';

const callbackUrl = (): string => `${location.origin}/auth/callback`;

export interface Session {
  user: Ref<SessionUser | null>;
  ready: Ref<boolean>;
  signInWithGoogle(): Promise<void>;
  signInWithMagicLink(email: string): Promise<Result<void, Error>>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
}

/**
 * Signing in and out, as the screens need it. Errors from the provider come
 * back as a `Result` rather than a throw: a wrong e-mail is an outcome the
 * sign-in form has to render, not an exception.
 */
export function useSession(): Session {
  const { user, ready } = storeToRefs(useSessionStore());

  return {
    user,
    ready,
    signInWithGoogle: async () => {
      const { error } = await supabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl() },
      });
      if (error) throw error;
    },
    signInWithMagicLink: async (email: string) => {
      const { error } = await supabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl() },
      });
      return error ? err(error) : ok(undefined);
    },
    signOut: async () => {
      await supabase().auth.signOut();
    },
    getAccessToken: async () => (await supabase().auth.getSession()).data.session?.access_token ?? null,
  };
}
