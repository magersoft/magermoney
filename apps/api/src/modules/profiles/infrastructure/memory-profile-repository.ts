import type { Profile, ProfilePatch, ProfileRepository } from '../application/profile-repository.js';
export class MemoryProfileRepository implements ProfileRepository {
  private rows: Map<string, Profile>;
  constructor(seed: Profile[]) { this.rows = new Map(seed.map((p) => [p.id, p])); }
  async findById(id: string) { return this.rows.get(id) ?? null; }
  async update(id: string, patch: ProfilePatch) {
    const cur = this.rows.get(id); if (!cur) return null;
    const next = { ...cur, ...patch }; this.rows.set(id, next); return next;
  }
}
