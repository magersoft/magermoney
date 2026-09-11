import { jwtVerify } from 'jose';
import { err, ok, type Result } from 'neverthrow';
import { UnauthorizedError } from '../errors/http.js';

export async function verifySupabaseJwt(token: string, secret: string): Promise<Result<{ userId: string }, UnauthorizedError>> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'], audience: 'authenticated' });
    return typeof payload.sub === 'string' ? ok({ userId: payload.sub }) : err(new UnauthorizedError());
  } catch {
    return err(new UnauthorizedError());
  }
}
