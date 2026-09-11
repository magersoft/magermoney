import { inject, type InjectionKey } from 'vue';
import type { ApiClient } from './client';

/**
 * The key the composition root provides the client under. A plain string behind
 * a typed key: tests (and `provide('api', …)`) stay readable, callers still get
 * the type.
 */
export const API_KEY = 'api' as unknown as InjectionKey<ApiClient>;

/**
 * The API client, as every application-layer composable reaches it. Injection
 * rather than a module-scope singleton, so a test provides a fake and nothing
 * has to be mocked at the module level.
 */
export function useApi(): ApiClient {
  const client = inject(API_KEY, null);
  if (!client) throw new Error('No API client provided. Did app/main.ts run?');
  return client;
}
