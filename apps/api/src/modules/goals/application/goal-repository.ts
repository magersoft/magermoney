import type { MarkColor } from '@magermoney/domain';

export interface GoalRow {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  /** A card-palette colour name; the check constraint holds the list. */
  color: MarkColor | null;
  targetAmount: string;
  currency: string;
  targetDate: string | null; // YYYY-MM-DD
  /** Stamped once, by the server, when the goal is first funded. Never cleared by a falling rate. */
  achievedAt: string | null; // ISO
  archivedAt: string | null; // ISO
  sortOrder: number;
}
export type NewGoal = Omit<GoalRow, 'id' | 'userId'>;
export type GoalPatch = Partial<NewGoal>;

export interface GoalRepository {
  /** Includes archived goals; ordered by sort order, then name. */
  list(userId: string): Promise<GoalRow[]>;
  findById(userId: string, id: string): Promise<GoalRow | null>;
  insert(userId: string, data: NewGoal): Promise<GoalRow>;
  update(userId: string, id: string, patch: GoalPatch): Promise<GoalRow | null>;
  delete(userId: string, id: string): Promise<boolean>;
}
