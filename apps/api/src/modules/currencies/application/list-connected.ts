import type { UserCurrencyRepository } from './user-currency-repository.js';
export const listConnected = (repo: UserCurrencyRepository) => (userId: string) =>
  repo.listConnected(userId);
