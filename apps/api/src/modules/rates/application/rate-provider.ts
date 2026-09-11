import type { Result } from 'neverthrow';
export class ProviderError extends Error { readonly code = 'PROVIDER_FAILED'; constructor(readonly provider: string, detail: string) { super(`${provider}: ${detail}`); } }
export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
export interface RateProvider { kind: 'fiat' | 'crypto'; fetch(codes: string[]): Promise<Result<{ base: string; value: string }[], ProviderError>> }
