---
id: TASK-027
title: 'Избранные валюты отчёта: хранение и логика переключателя'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:17'
updated_date: '2026-09-20 15:37'
labels:
  - api
  - currencies
dependencies:
  - TASK-025
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Переключатель валюты отчёта (CurrencySwitch) показывает варианты из `useDisplayCurrency().options`, и набор сейчас определяется кодом. Когда валют станет много (TASK-025), переключатель должен показывать только те, что человек отметил избранными. Лимит три: больше не помещается рядом с логотипом и кнопкой темы на телефоне (об этом в комментарии CurrencySwitch), и переключатель остаётся быстрым.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Избранные валюты хранятся на пользователя (например поле в profiles или отдельная таблица) с RLS; порядок сохраняется
- [x] #2 Максимум три избранные валюты: лимит проверяется в use case и в БД, попытка добавить четвёртую даёт понятную ошибку
- [x] #3 Избранными можно сделать только подключённые валюты; отключение валюты убирает её из избранных, если она не последняя
- [x] #4 Всегда есть хотя бы одна избранная валюта; текущая валюта отчёта входит в избранные, а при её удалении из избранных переключается на первую оставшуюся
- [x] #5 useDisplayCurrency.options отдаёт избранные, остальные экраны продолжают работать с current без изменений
- [x] #6 Работает офлайн: изменение проходит через очередь мутаций (rates/offline.ts)
- [x] #7 Контракты в packages/contracts, тесты use cases и useDisplayCurrency
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Favourites ARE profiles.reporting_currencies, which already drives useDisplayCurrency().options — the work is the rules around it, not a new table.
2. Migration 20260920000016: trim existing rows over three (keeping the default), then check constraints for size 1..3 and for the default being one of them.
3. Contracts: MAX_REPORTING_CURRENCIES = 3, applied to both the DTO and the patch input.
4. updateProfile takes the UserCurrencyRepository: refuses a fourth currency (TOO_MANY_REPORTING_CURRENCIES) and one that is not connected (CURRENCY_NOT_CONNECTED).
5. disconnectCurrency stops refusing over the profile and instead drops the currency from the switch, moving the default and falling back to another connected currency if the switch would empty — two tables, so it moves to the unit of work, which gains profiles and userCurrencies.
6. Web: useProfile goes through the offline mutation queue (registerProfileMutations + profile/offline.ts, registered in the composition root) so a change made offline survives.
7. Tests for the limit, the connected rule, the three disconnect outcomes and the display-currency fallback.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
No new table: profiles.reporting_currencies already stores an ordered, RLS-protected list per user and already feeds useDisplayCurrency().options. Adding a second home for the same fact would have been the wrong call — what was missing is the rules.

Limit (AC#2): MAX_REPORTING_CURRENCIES = 3 in contracts, enforced in updateProfile with its own code (TOO_MANY_REPORTING_CURRENCIES) and by a check constraint. The migration trims existing rows over three first, keeping the default currency, or the constraint could not be added. Verified against the local database: an UPDATE to four codes is rejected by name.

Connected-only (AC#3): updateProfile now takes the UserCurrencyRepository and refuses a currency the person has not connected, with CURRENCY_NOT_CONNECTED — otherwise the switch offers something no form does, and tapping it makes every amount unconvertible.

Deliberate reversal of a TASK-025 decision: disconnecting a currency no longer REFUSES when the profile points at it. TASK-025's guard included the profile; TASK-027 AC#3 says disconnecting should take the currency out of the favourites instead, and that is the better rule — an account is evidence the currency holds money, a place in the switch is only a preference. So disconnect now drops it from reporting_currencies, moves default_currency if it was the one, and falls back to another connected currency rather than emptying the switch. That is two tables in one decision, so disconnectCurrency moved onto the unit of work, and Repos gained profiles and userCurrencies.

AC#6: useProfile now goes through the offline mutation queue — registerProfileMutations in profile/mutation-defaults.ts, a profile/offline.ts entry, registered in the composition root beside the other three. The optimistic update and rollback moved into the registration so a mutation restored from IndexedDB behaves like a fresh one. Reordering the switch on a train now survives the tunnel.

AC#4 needed no change to createDisplayCurrency — it already re-picks when options change — but it was untested; there are now tests that the current currency moves off one taken out of the switch and always lands on something the switch offers.

Verification: bun run test (948 passing), typecheck, lint; migration applied locally and the constraint checked with psql.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The display switch is now capped at three currencies, all of which must be connected, enforced in the use case with its own error code and by check constraints in the database (existing rows over three were trimmed first, keeping the default). Disconnecting a currency no longer refuses because the switch points at it — that is a preference, not evidence the currency holds money — so it drops out of the switch, the default moves if it was the one, and another connected currency takes its place rather than the switch emptying; that is two tables, so it moved onto the unit of work. Profile changes now travel through the offline mutation queue, so reordering the switch without a connection survives the closed tab. Verified with the full suite (948 tests), typecheck, lint, and psql against the migrated local database, where an update to four currencies is rejected by constraint name.
<!-- SECTION:FINAL_SUMMARY:END -->
