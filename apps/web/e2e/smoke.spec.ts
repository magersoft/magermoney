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
/**
 * A freshly deployed staging has no rates until the daily cron first runs, and
 * the home screen has nothing to convert without them. Seeding is the same job
 * the cron triggers, so this exercises the real path rather than inserting rows.
 */
async function seedRates(): Promise<void> {
  const secret = process.env.E2E_CRON_SECRET;
  const api = process.env.E2E_API_URL;
  if (!secret || !api) {
    console.log('E2E_CRON_SECRET or E2E_API_URL is unset; running against whatever rates exist.');
    return;
  }
  const res = await fetch(`${api}/jobs/rates?kind=fiat`, {
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!res.ok) throw new Error(`Seeding rates failed: ${res.status} ${res.statusText}`);
}

const EMAIL_PREFIX = 'e2e-';
const EMAIL_DOMAIN = '@magermoney.test';
const STALE_AFTER_MS = 60 * 60 * 1000;

test.beforeAll(seedRates);

test('sign in, see home, switch currency', async ({ page }) => {
  const admin = createClient(
    process.env.E2E_SUPABASE_URL!,
    process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Deletes any `e2e-*@magermoney.test` user older than an hour. Guards
  // against a run that crashed between `createUser` and its own cleanup —
  // against staging, this test runs on every PR, so a leaked user per crash
  // would otherwise grow `auth.users` without bound.
  const cutoff = Date.now() - STALE_AFTER_MS;
  for (let page2 = 1; ; page2++) {
    const { data: listed, error } = await admin.auth.admin.listUsers({
      page: page2,
      perPage: 200,
    });
    if (error) throw error;
    const stale = listed.users.filter(
      (u) =>
        u.email?.startsWith(EMAIL_PREFIX) &&
        u.email.endsWith(EMAIL_DOMAIN) &&
        new Date(u.created_at).getTime() < cutoff,
    );
    await Promise.all(stale.map((u) => admin.auth.admin.deleteUser(u.id)));
    if (listed.users.length < 200) break;
  }

  const email = `${EMAIL_PREFIX}${Date.now()}${EMAIL_DOMAIN}`;
  const { data: created } = await admin.auth.admin.createUser({ email, email_confirm: true });
  const userId = created.user!.id;

  try {
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
    await expect(page.getByTestId('capital-total')).toBeVisible();

    // New profiles default to EUR (spec §1); switch to USD so the totals
    // checked below can be compared against the accounts' own currency
    // without a conversion in the way. The final step switches back to EUR.
    await page.getByTestId('currency-switch').getByRole('button', { name: 'USD' }).click();

    // Create two accounts through the form.
    for (const [name, , opening] of [
      ['Alfa', 'USD', '100'],
      ['Beta', 'USD', '0'],
    ] as const) {
      await page.goto('/accounts/new');
      await page.getByTestId('form-name').fill(name);
      await page.getByTestId('form-bank').fill(name);
      await page.getByTestId('form-country').fill('RU');
      await page.getByTestId('form-opening').fill(opening);
      await page.getByTestId('form-submit').click();
      await expect(page.getByTestId('account-name')).toHaveText(name);
    }

    // Record a balance on Beta from its detail page.
    await page.getByTestId('account-record').click();
    await page.getByTestId('balance-amount').fill('10');
    await page.getByTestId('balance-save').click();
    await expect(page.getByTestId('account-balance')).toContainText('10');

    // Transfer 40 from Alfa to Beta; the total stays 110, Beta shows 50.
    // The <select> options are labelled "<name> · <balance> <currency>", so the
    // account name is matched as a substring rather than an exact label; the
    // installed @playwright/test types accept only a string label, not RegExp,
    // so the matching option is found via its text and selected by value.
    const selectAccountByName = async (
      select: ReturnType<typeof page.getByTestId>,
      name: string,
    ) => {
      const value = await select.locator('option', { hasText: name }).getAttribute('value');
      await select.selectOption(value!);
    };
    await page.getByTestId('account-transfer').click();
    const from = page.getByTestId('transfer-from');
    await selectAccountByName(from, 'Alfa');
    await selectAccountByName(page.getByTestId('transfer-to'), 'Beta');
    await page.getByTestId('transfer-sent').fill('40');
    await page.getByTestId('transfer-save').click();
    await expect(page.getByTestId('account-balance')).toContainText('50');
    await page.goto('/');
    await expect(page.getByTestId('capital-total')).toContainText('110');

    // The display currency switch still converts everything.
    await page.getByTestId('currency-switch').getByRole('button', { name: 'EUR' }).click();
    await expect(page.getByTestId('capital-total')).toContainText('€');
  } finally {
    await admin.auth.admin.deleteUser(userId);
  }
});
