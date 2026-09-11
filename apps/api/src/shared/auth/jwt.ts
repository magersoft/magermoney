import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { err, ok, type Result } from 'neverthrow';
import { UnauthorizedError } from '../errors/http.js';

export interface VerifySupabaseJwtOptions {
  jwks?: JWTVerifyGetKey | undefined;
  secret?: string | undefined;
}

export function createSupabaseJwks(supabaseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL('/auth/v1/.well-known/jwks.json', supabaseUrl));
}

export async function verifySupabaseJwt(
  token: string,
  opts: VerifySupabaseJwtOptions,
): Promise<Result<{ userId: string }, UnauthorizedError>> {
  try {
    const { alg } = decodeProtectedHeader(token);

    if ((alg === 'ES256' || alg === 'RS256') && opts.jwks) {
      const { payload } = await jwtVerify(token, opts.jwks, { algorithms: ['ES256', 'RS256'], audience: 'authenticated' });
      return typeof payload.sub === 'string' ? ok({ userId: payload.sub }) : err(new UnauthorizedError());
    }

    if (alg === 'HS256' && opts.secret) {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(opts.secret), {
        algorithms: ['HS256'],
        audience: 'authenticated',
      });
      return typeof payload.sub === 'string' ? ok({ userId: payload.sub }) : err(new UnauthorizedError());
    }

    return err(new UnauthorizedError());
  } catch {
    return err(new UnauthorizedError());
  }
}
