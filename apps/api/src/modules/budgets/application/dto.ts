import type { BudgetDto } from '@magermoney/contracts';
import type { BudgetRow } from './budget-repository.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toBudgetDto = ({ userId: _u, ...row }: BudgetRow): BudgetDto => row;
