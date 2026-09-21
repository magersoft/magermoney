import { randomUUID } from 'node:crypto';
import type {
  GoalPatch,
  GoalRepository,
  GoalRow,
  NewGoal,
} from '../application/goal-repository.js';

export class MemoryGoalRepository implements GoalRepository {
  constructor(public rows: GoalRow[] = []) {}
  private mine(userId: string) {
    return this.rows.filter((r) => r.userId === userId);
  }
  async list(userId: string) {
    return this.mine(userId).sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    );
  }
  async findById(userId: string, id: string) {
    return this.mine(userId).find((r) => r.id === id) ?? null;
  }
  async insert(userId: string, data: NewGoal) {
    const row: GoalRow = { ...data, id: randomUUID(), userId };
    this.rows.push(row);
    return row;
  }
  async update(userId: string, id: string, patch: GoalPatch) {
    const row = await this.findById(userId, id);
    if (!row) return null;
    Object.assign(row, patch);
    return row;
  }
  async delete(userId: string, id: string) {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !(r.userId === userId && r.id === id));
    return this.rows.length < before;
  }
}
