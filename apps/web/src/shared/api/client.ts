/**
 * The HTTP transport. It knows about tokens and JSON bodies and nothing else —
 * the base URL and the token source are injected by `app`, so this file stays
 * free of app config and of any module's subject matter.
 */

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
      if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
      return fetch(`${base}${path}`, { ...init, headers });
    },
  };
}
