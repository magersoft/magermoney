import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;

/**
 * The auth provider. PKCE because the app is a public client: the code that
 * comes back in the URL is worthless without the verifier this client kept, so
 * a link forwarded to someone else cannot sign them in.
 *
 * Built on first use rather than at import: constructing it opens a realtime
 * transport and demands configuration, and a module that merely imports the
 * auth module's public API should pay for neither.
 */
export function supabase(): SupabaseClient {
  client ??= createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true },
  });
  return client;
}
