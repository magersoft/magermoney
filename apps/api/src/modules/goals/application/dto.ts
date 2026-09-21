import type { GoalDto } from '@magermoney/contracts';
import type { GoalRow } from './goal-repository.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const toGoalDto = ({ userId: _u, ...row }: GoalRow): GoalDto => row;
