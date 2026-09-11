import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

/**
 * Signs in by generating a magic link server-side (no inbox needed), then
 * drives the UI.
 *
 * The session is handed to the app by writing it under the exact
 * localStorage key `@supabase/supabase-js` computes for its default storage
 * adapter: `sb-${new URL(url).hostname.split('.')[0]}-auth-token` (see
 * `SupabaseClient` construction) — note `hostname`, not `host`: for a URL
 * with a port the hostname excludes it, so `http://127.0.0.1:54321` yields
 * `sb-127-auth-token`. Confirmed against the running app: after completing a
 * real magic-link sign-in through Inbucket at http://127.0.0.1:54324, the
 * app itself wrote its session under `sb-127-auth-token` in localStorage.
 */
test('sign in, see home, switch currency', async ({ page }) => {
  const admin = createClient(
    process.env.E2E_SUPABASE_URL!,
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!,
  );
  const email = `e2e-${Date.now()}@magermoney.test`;
  await admin.auth.admin.createUser({ email, email_confirm: true });
  const { data } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  // The installed @supabase/auth-js names this field `hashed_token`, not the
  // `token_hash` the brief assumed — confirmed against `GoTrueAdminApi`'s own
  // JSDoc example. `verifyOtp`'s parameter is still called `token_hash`; it is
  // only the response field that differs.
  const token_hash = data.properties!.hashed_token;
  const anon = createClient(process.env.E2E_SUPABASE_URL!, process.env.E2E_SUPABASE_ANON_KEY!);
  const { data: s } = await anon.auth.verifyOtp({ token_hash, type: 'magiclink' });

  const storageKey = `sb-${new URL(process.env.E2E_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;

  await page.goto('/sign-in');
  await page.evaluate(([k, v]: [string, string]) => localStorage.setItem(k, v), [
    storageKey,
    JSON.stringify(s.session),
  ] as [string, string]);
  await page.goto('/');

  await expect(page.getByTestId('home-greeting')).toBeVisible();
  const before = await page.getByTestId('sample-amount').innerText();
  await page.getByTestId('currency-switch').getByRole('button', { name: 'USD' }).click();
  await expect(page.getByTestId('sample-amount')).not.toHaveText(before);
  await expect(page.getByTestId('sample-amount')).toContainText('$');
});
