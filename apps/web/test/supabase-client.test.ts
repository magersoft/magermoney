import { describe, expect, it, vi } from 'vitest';

const createClient = vi.fn((...args: unknown[]) => ({ auth: {}, args }));
vi.mock('@supabase/supabase-js', () => ({ createClient }));

const { supabase } = await import('../src/modules/auth/infrastructure/supabase.js');

describe('the Supabase client', () => {
  it('runs PKCE, leaves the URL to the callback screen, and is built once', () => {
    supabase();
    supabase();

    expect(createClient).toHaveBeenCalledTimes(1);

    const options = createClient.mock.calls[0]?.[2] as unknown as { auth: Record<string, unknown> };

    expect(options.auth.flowType).toBe('pkce');
    // Left on, the client would spend the code before the callback screen could.
    expect(options.auth.detectSessionInUrl).toBe(false);
    expect(options.auth.persistSession).toBe(true);
  });
});
