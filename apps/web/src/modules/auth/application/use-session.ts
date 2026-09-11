import { err, ok, type Result } from 'neverthrow';
import { storeToRefs } from 'pinia';
import type { Ref } from 'vue';
import type { SessionUser } from '../domain/session';
import { safeRedirect } from '../domain/redirect';
import { supabase } from '../infrastructure/supabase';
import { useSessionStore } from '../infrastructure/session-store';

/**
 * The callback carries the destination, because the round trip goes through an
 * e-mail client or Google and nothing else survives it.
 */
const callbackUrl = (redirect?: string): string => {
  const safe = safeRedirect(redirect);
  const base = `${location.origin}/auth/callback`;
  return safe ? `${base}?redirect=${encodeURIComponent(safe)}` : base;
};

export interface Session {
  user: Ref<SessionUser | null>;
  ready: Ref<boolean>;
  signInWithGoogle(redirect?: string): Promise<void>;
  signInWithMagicLink(email: string, redirect?: string): Promise<Result<void, Error>>;
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
    signInWithGoogle: async (redirect?: string) => {
      const { error } = await supabase().auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl(redirect) },
      });
      if (error) throw error;
    },
    signInWithMagicLink: async (email: string, redirect?: string) => {
      const { error } = await supabase().auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl(redirect) },
      });
      return error ? err(error) : ok(undefined);
    },
    signOut: async () => {
      await supabase().auth.signOut();
    },
    getAccessToken: async () => (await supabase().auth.getSession()).data.session?.access_token ?? null,
  };
}
