import type { RateRepository } from './rate-repository.js';
export const listCurrencies = (repo: RateRepository) => () => repo.listCurrencies();
