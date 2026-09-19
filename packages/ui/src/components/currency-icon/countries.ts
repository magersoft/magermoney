/**
 * The countries an account can be held in — ISO 3166-1 alpha-2, and the single
 * list the rest of the app works from.
 *
 * It lives beside the resolver because the two constraints are one: a country is
 * offerable exactly when we ship a flag for it. `scripts/build-icon-subset.ts`
 * builds `src/icons/country-flags.json` from this list and throws on a code
 * circle-flags has never heard of, so the list cannot quietly outgrow the icons.
 *
 * Derived from `@iconify-json/circle-flags` intersected with the regions
 * `Intl.DisplayNames` can name, minus the codes that are not places you keep
 * money: the historical ones (AN, CS, FX, SU, YU), the organisations (EU, UN)
 * and UK, which is GB spelled a second way.
 *
 * Names are not here. They are words, they differ per language, and they live
 * where every other word does — `apps/web/src/locales/*.json` under `country`.
 */

/*
 * Written as rows of plain text rather than 257 quoted strings: an array of
 * pairs is a page of punctuation, and the formatter would give every code a
 * line of its own.
 */
const CODES = [
  'AC AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD',
  'BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC',
  'CD CF CG CH CI CK CL CM CN CO CP CQ CR CU CV CW CX CY CZ DE',
  'DG DJ DK DM DO DZ EA EC EE EG EH ER ES ET FI FJ FK FM FO FR',
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK',
  'HM HN HR HT HU IC ID IE IL IM IN IO IQ IR IS IT JE JM JO JP',
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU',
  'LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU',
  'MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE',
  'PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB',
  'SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TA',
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US',
  'UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW',
].join(' ');

export const COUNTRY_CODES: readonly string[] = CODES.split(' ');
