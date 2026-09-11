import { createClient } from '@supabase/supabase-js';

/**
 * The auth provider. PKCE because the app is a public client: the code that
 * comes back in the URL is worthless without the verifier this client kept, so
 * a link forwarded to someone else cannot sign them in.
 */
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true } },
);
