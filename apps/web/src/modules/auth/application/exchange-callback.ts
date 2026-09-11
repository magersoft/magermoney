import { err, ok, type Result } from 'neverthrow';
import { supabase } from '../infrastructure/supabase';

/**
 * Turns the callback URL into a session. GoTrue lands here with `?code=…`
 * (PKCE) or with `?error=…&error_description=…` when the provider refused.
 * `exchangeCodeForSession` takes the bare code, not the URL.
 */
export async function exchangeCallback(
  url: URL,
  client: () => {
    auth: { exchangeCodeForSession(code: string): Promise<{ error: { message: string } | null }> };
  } = supabase,
): Promise<Result<void, string>> {
  const refused = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (refused) return err(refused);
  const code = url.searchParams.get('code');
  if (!code) return err('missing code');
  const { error } = await client().auth.exchangeCodeForSession(code);
  return error ? err(error.message) : ok(undefined);
}
