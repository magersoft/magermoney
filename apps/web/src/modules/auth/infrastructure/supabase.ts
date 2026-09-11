import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/**
 * The auth provider. PKCE because the app is a public client: the code that
 * comes back in the URL is worthless without the verifier this client kept, so
 * a link forwarded to someone else cannot sign them in.
 *
 * `detectSessionInUrl` is off because the callback screen does the exchange
 * itself. Left on, the client would consume the code during the session read
 * that happens before mount, and the callback would then exchange a spent code
 * and show a failure for a sign-in that actually worked.
 *
 * Built on first use rather than at import: constructing it opens a realtime
 * transport and demands configuration, and a module that merely imports the
 * auth module's public API should pay for neither.
 */
export function supabase(): SupabaseClient {
  client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    },
  );
  return client;
}
