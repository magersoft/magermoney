/**
 * The HTTP transport. It knows about tokens and JSON bodies and nothing else —
 * the base URL and the token source are injected by `app`, so this file stays
 * free of app config and of any module's subject matter.
 */

import { ErrorDtoSchema } from '@magermoney/contracts';

export type GetToken = () => Promise<string | null>;

export interface ApiClient {
  fetch(path: string, init?: RequestInit): Promise<Response>;
}

export function createApiClient(base: string, getToken: GetToken): ApiClient {
  return {
    async fetch(path: string, init: RequestInit = {}): Promise<Response> {
      const token = await getToken();
      const headers = new Headers(init.headers);
      if (token) headers.set('authorization', `Bearer ${token}`);
      if (init.body && !headers.has('content-type'))
        headers.set('content-type', 'application/json');
      return fetch(`${base}${path}`, { ...init, headers });
    },
  };
}

/**
 * A failure the UI can act on: the HTTP status for deciding what to do, the
 * API's own code for deciding what it was, and a message already written for a
 * person (the API never returns anything else, see shared/errors in apps/api).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** What `parse` needs from a schema, so this file does not depend on a zod version. */
export interface ResponseSchema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: Error };
}

/**
 * The single door every response comes through. A body that does not match the
 * contract is a failure here rather than a stray `undefined` three layers up.
 */
export async function parse<T>(res: Response, schema: ResponseSchema<T>): Promise<T> {
  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const parsed = ErrorDtoSchema.safeParse(body);
    throw parsed.success
      ? new ApiError(res.status, parsed.data.code, parsed.data.message)
      : new ApiError(res.status, 'UNKNOWN', res.statusText || 'Request failed');
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new ApiError(res.status, 'MALFORMED_RESPONSE', parsed.error.message);
  return parsed.data;
}

/**
 * A list of whatever the item schema validates. Endpoints that answer with an
 * array would otherwise force every caller to depend on a zod version of its
 * own, which is exactly what `ResponseSchema` exists to avoid.
 */
export function listOf<T>(item: ResponseSchema<T>): ResponseSchema<T[]> {
  return {
    safeParse(input: unknown) {
      if (!Array.isArray(input)) return { success: false, error: new Error('Expected an array') };
      const out: T[] = [];
      for (const [i, raw] of input.entries()) {
        const parsed = item.safeParse(raw);
        if (!parsed.success)
          return { success: false, error: new Error(`Item ${i}: ${parsed.error.message}`) };
        out.push(parsed.data);
      }
      return { success: true, data: out };
    },
  };
}
