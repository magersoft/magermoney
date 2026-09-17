export type DateLocale = 'ru' | 'en';
const intl = (l: DateLocale) => (l === 'ru' ? 'ru-RU' : 'en-US');
/**
 * `dateStyle: 'medium'` renders ru-RU as "11 сент. 2026 г." on current ICU —
 * a Russian ledger reads dates as dd.mm.yyyy, so ru gets explicit numeric
 * fields instead; en keeps the CLDR medium style ("Sep 11, 2026").
 */
const dateOptions = (l: DateLocale): Intl.DateTimeFormatOptions =>
  l === 'ru' ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { dateStyle: 'medium' };
const dateTimeOptions = (l: DateLocale): Intl.DateTimeFormatOptions =>
  l === 'ru'
    ? { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { dateStyle: 'medium', timeStyle: 'short' };
export const formatDate = (iso: string, locale: DateLocale): string =>
  new Intl.DateTimeFormat(intl(locale), dateOptions(locale)).format(new Date(iso));
export const formatDateTime = (iso: string, locale: DateLocale): string =>
  new Intl.DateTimeFormat(intl(locale), dateTimeOptions(locale)).format(new Date(iso));
/** `datetime-local` wants local time without the zone. */
export const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (local: string): string => new Date(local).toISOString();
