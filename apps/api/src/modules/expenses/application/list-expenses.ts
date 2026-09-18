import type { ExpenseDto } from '@magermoney/contracts';
import type { Repos } from '../../../app.js';
import { toExpenseDto } from './dto.js';

/** Ended expenses are part of the list: the client decides what "active today" means. */
export const listExpenses =
  (repos: Pick<Repos, 'expenses'>) =>
  async (userId: string): Promise<ExpenseDto[]> =>
    (await repos.expenses.list(userId)).map(toExpenseDto);
