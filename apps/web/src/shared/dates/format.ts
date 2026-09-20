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
/**
 * The name of the month a calendar date falls in: «Сентябрь 2026». Russian
 * gives it lower case, which is right inside a sentence and wrong as the
 * heading of a period, so the first letter is raised.
 */
export const formatMonth = (isoDate: string, locale: DateLocale): string => {
  const day = new Date(`${isoDate}T12:00:00`);
  /* Built from the month alone: ru-RU's own year pattern adds a «г.» the heading has no use for. */
  const name = new Intl.DateTimeFormat(intl(locale), { month: 'long' }).format(day);
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${day.getFullYear()}`;
};

/** A day under a heading that already named the month: «10 сентября», "Sep 10". */
export const formatDayAndMonth = (isoDate: string, locale: DateLocale): string =>
  new Intl.DateTimeFormat(
    intl(locale),
    locale === 'ru' ? { day: 'numeric', month: 'long' } : { month: 'short', day: 'numeric' },
  ).format(new Date(`${isoDate}T12:00:00`));

/** When in the day it happened: «14:32». */
export const formatTime = (iso: string, locale: DateLocale): string =>
  new Intl.DateTimeFormat(intl(locale), { hour: '2-digit', minute: '2-digit' }).format(
    new Date(iso),
  );

/** `datetime-local` wants local time without the zone. */
export const toLocalInput = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (local: string): string => new Date(local).toISOString();
/** A calendar date (`YYYY-MM-DD`), as opposed to an instant: formatted at local noon so no zone can move it to the day before. */
export const formatDay = (isoDate: string, locale: DateLocale): string =>
  new Intl.DateTimeFormat(intl(locale), dateOptions(locale)).format(
    new Date(`${isoDate}T12:00:00`),
  );
