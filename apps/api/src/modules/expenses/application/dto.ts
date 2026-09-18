import type { ExpenseCategoryDto, ExpenseDto } from '@magermoney/contracts';
import type { ExpenseCategoryRow } from './category-repository.js';
import type { ExpenseRow } from './expense-repository.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toCategoryDto = ({ userId: _u, ...row }: ExpenseCategoryRow): ExpenseCategoryDto =>
  row;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toExpenseDto = ({ userId: _u, ...row }: ExpenseRow): ExpenseDto => row;
