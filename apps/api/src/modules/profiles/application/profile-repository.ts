export interface Profile {
  id: string;
  displayName: string | null;
  locale: 'ru' | 'en';
  defaultCurrency: string;
  reportingCurrencies: string[];
  onboardingCompletedAt: string | null;
}
export type ProfilePatch = Partial<Omit<Profile, 'id'>>;
export interface ProfileRepository {
  findById(id: string): Promise<Profile | null>;
  update(id: string, patch: ProfilePatch): Promise<Profile | null>;
}
