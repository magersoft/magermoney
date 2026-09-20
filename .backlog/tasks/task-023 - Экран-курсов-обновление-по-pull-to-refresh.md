---
id: TASK-023
title: 'Экран курсов: обновление по pull-to-refresh'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:15'
updated_date: '2026-09-20 11:18'
labels:
  - rates
  - ui
dependencies:
  - TASK-021
  - TASK-022
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

На экране Настройки → Курсы (/settings/rates, RatesPage.vue) курсы добавленных валют устаревают, а обновить их с телефона нечем. Нужно подключить жест pull-to-refresh, чтобы курсы всех валют из списка подтягивались по запросу.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Потянув список вниз, пользователь запускает обновление курсов через новый эндпоинт
- [x] #2 После успеха таблица и дата «на дату» обновляются, ручные курсы остаются на месте
- [x] #3 При ошибке показывается тост, список не пропадает; если курсы уже свежие, пользователь видит спокойное сообщение, а не ошибку
- [x] #4 Инвалидируются запросы, зависящие от курсов (главная, счета), через ключи из rates/offline.ts
- [x] #5 Строки локализованы в en.json и ru.json
- [x] #6 Тест экрана: жест вызывает обновление, ошибка не ломает список

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. rates/offline.ts: RATES_KEY and ratesKey, moved out of use-rates so a key import does not drag the screen in.
2. ratesApi.refresh() -> POST /rates/refresh, parsed through RefreshRatesResultSchema.
3. useRefreshRates(): mutation invalidating RATES_KEY.
4. RatesPage wraps the list in PullToRefresh and declares a bar action calling the same handler.
5. Copy in en.json and ru.json: refresh, refreshAria, refreshing, alreadyFresh, refreshFailed.
6. Screen tests: the gesture refreshes and refetches, an already-fresh answer is calm, a failure keeps the list.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

AC4: invalidating RATES_KEY is the whole propagation. Home and Accounts convert client-side through useRates(), so they share the ['rates', …] query rather than holding rate-derived server data of their own — nothing else needs invalidating, and the reason is written into use-refresh-rates.ts so a later reader does not add a second key on faith.
Manual rates survive because the refresh only writes source='api' rows and GET /rates still prefers a manual override.
The bar action is the accessible alternative to the drag (TASK-022 AC6) and reuses the exact same handler; it is exercised through PullToRefresh's exposed refresh() in the screen tests, since a screen mounted outside AppShell has no bar.
Verified: apps/web 285 tests pass (4 in RatesPage.test.ts), monorepo test/typecheck/lint/build green, impeccable detector clean on the changed screen and component.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Rates can now be refreshed from the screen: the list is wrapped in PullToRefresh, the gesture calls POST /rates/refresh and invalidates RATES_KEY (new rates/offline.ts), so the table, the 'as of' date and every other screen reading the same rates query update; manual overrides stay. An already-fresh answer raises a calm 'These are already the latest rates.', a failure raises 'Could not fetch the rates.' and leaves the list where it was. The same handler is on the top bar so the refresh is reachable without a touch screen. Copy is in en.json and ru.json. Verified by apps/web/test/RatesPage.test.ts (gesture refreshes and refetches, already-fresh path, failure path keeps the list) and the full monorepo test/typecheck/lint/build run.
<!-- SECTION:FINAL_SUMMARY:END -->
