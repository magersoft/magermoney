import type { ProfileDto } from '@magermoney/contracts';

/** The languages the interface is translated into. */
export const LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/**
 * How the person is addressed. The display name if they gave one, otherwise the
 * local part of their e-mail: a greeting that reads as a name, without storing
 * one that was never offered.
 */
export function greetingName(profile: ProfileDto | undefined, email: string | null): string {
  const name = profile?.displayName?.trim();
  if (name) return name;
  const local = email?.split('@')[0]?.trim();
  return local && local.length > 0 ? local : '';
}

/**
 * The default currency has to stay inside the reporting list; the API rejects
 * a pair that does not, so the editor moves it rather than letting the person
 * save something that will bounce.
 */
export function withoutCurrency(
  reporting: readonly string[],
  defaultCurrency: string,
  removed: string,
): { reportingCurrencies: string[]; defaultCurrency: string } | null {
  const next = reporting.filter((c) => c !== removed);
  if (next.length === 0) return null;
  return {
    reportingCurrencies: next,
    defaultCurrency: next.includes(defaultCurrency) ? defaultCurrency : (next[0] as string),
  };
}
