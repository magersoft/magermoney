import type { Sql } from '../../../shared/db/client.js';
import type { Profile, ProfilePatch, ProfileRepository } from '../application/profile-repository.js';
const cols = 'id, display_name, locale, default_currency, reporting_currencies, onboarding_completed_at';
export class PgProfileRepository implements ProfileRepository {
  constructor(private readonly sql: Sql) {}
  async findById(id: string): Promise<Profile | null> {
    const [row] = await this.sql<Profile[]>`select ${this.sql.unsafe(cols)} from profiles where id = ${id}`;
    return row ?? null;
  }
  async update(id: string, patch: ProfilePatch): Promise<Profile | null> {
    const data: Record<string, unknown> = {};
    if (patch.displayName !== undefined) data.display_name = patch.displayName;
    if (patch.locale !== undefined) data.locale = patch.locale;
    if (patch.defaultCurrency !== undefined) data.default_currency = patch.defaultCurrency;
    if (patch.reportingCurrencies !== undefined) data.reporting_currencies = patch.reportingCurrencies;
    if (patch.onboardingCompletedAt !== undefined) data.onboarding_completed_at = patch.onboardingCompletedAt;
    if (Object.keys(data).length === 0) return this.findById(id);
    const [row] = await this.sql<Profile[]>`update profiles set ${this.sql(data)} where id = ${id} returning ${this.sql.unsafe(cols)}`;
    return row ?? null;
  }
}
