import { describe, expect, it, vi } from 'vitest';
import { exchangeCallback } from '../src/modules/auth/application/exchange-callback';

const clientWith =
  (exchange: (code: string) => Promise<{ error: { message: string } | null }>) => () => ({
    auth: { exchangeCodeForSession: exchange },
  });

describe('exchangeCallback', () => {
  it('passes the bare code from the URL, never the whole URL', async () => {
    const exchange = vi.fn(async () => ({ error: null }));
    const result = await exchangeCallback(
      new URL('https://app.test/auth/callback?code=abc-123&redirect=%2Fsettings'),
      clientWith(exchange),
    );
    expect(result.isOk()).toBe(true);
    expect(exchange).toHaveBeenCalledWith('abc-123');
  });

  it('reports a provider refusal without calling the exchange', async () => {
    const exchange = vi.fn(async () => ({ error: null }));
    const result = await exchangeCallback(
      new URL('https://app.test/auth/callback?error=access_denied&error_description=User+refused'),
      clientWith(exchange),
    );
    expect(result._unsafeUnwrapErr()).toBe('User refused');
    expect(exchange).not.toHaveBeenCalled();
  });

  it('fails when there is no code', async () => {
    const result = await exchangeCallback(
      new URL('https://app.test/auth/callback'),
      clientWith(vi.fn()),
    );
    expect(result._unsafeUnwrapErr()).toBe('missing code');
  });

  it('surfaces the GoTrue error message', async () => {
    const result = await exchangeCallback(
      new URL('https://app.test/auth/callback?code=x'),
      clientWith(async () => ({ error: { message: 'invalid flow state' } })),
    );
    expect(result._unsafeUnwrapErr()).toBe('invalid flow state');
  });
});
