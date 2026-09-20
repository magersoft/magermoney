---
id: TASK-052
title: 'Главная, Счета и Счёт: обновление по pull-to-refresh'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-20 14:18'
updated_date: '2026-09-20 14:23'
labels:
  - ui
  - accounts
  - dashboard
dependencies: []
type: enhancement
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Жест pull-to-refresh есть только на экране курсов (TASK-023). На Главной, в списке Счетов и на странице одного счёта данные так же устаревают, а обновить их с телефона нечем: приходится уходить со screenа и возвращаться. Компонент PullToRefresh уже в packages/ui, эндпоинт обновления курсов уже есть — нужно подключить их к трём экранам так, чтобы один жест обновлял всё, что экран показывает, а не только одну из его таблиц.

Каждый из трёх экранов показывает суммы, пересчитанные по курсам, поэтому жест должен и просить свежие курсы, и перечитать данные экрана. Ошибка курсов не должна отменять перечитывание остального.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Одна общая точка входа для жеста: экран не перечисляет ключи запросов руками, обновляется всё, что этот экран сейчас показывает
- [x] #2 На Главной жест обновляет всю сводку: счета, поступления, расходы, бюджеты и курсы
- [x] #3 В списке Счетов жест обновляет счета и курсы, итог капитала пересчитывается
- [x] #4 На странице счёта жест обновляет сам счёт и его журнал операций
- [x] #5 Пока обновление идёт, повторный жест игнорируется; после него экран не мигает скелетоном поверх уже показанных данных
- [x] #6 Если курсы не пришли, остальные данные всё равно перечитываются, а пользователь видит спокойное сообщение
- [x] #7 Строки локализованы в en.json и ru.json, если появились новые
- [x] #8 Тесты на каждый из трёх экранов: жест вызывает обновление и не ломает экран при ошибке

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. shared/query/use-screen-refresh.ts: refetchQueries({ type: 'active' }) — the screen's own mounted queries, no key list to maintain — plus an optional step the screen passes for work that is not a refetch.
2. The three screens pass useRefreshRates().refresh as that step, wrap their content in PullToRefresh and toast rates.refreshFailed if the rates step fails, without cancelling the refetch.
3. Tests: DashboardPage, AccountsPage, AccountDetailPage.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

AC1: shared/query/use-screen-refresh.ts uses refetchQueries({ type: 'active' }) — the queries some mounted component is currently observing, which is the same set as 'what this screen shows' and stays true when a screen grows a block. A hand-written key list per screen is the version of this that silently stops covering half the screen later.
The rates step runs before the refetch (a refetch landing first would read the old numbers) and its failure is returned, not thrown, so an unreachable provider never leaves the rest of the screen stale. Screens toast rates.refreshFailed on that.
AC5: no skeleton flash — refetchQueries keeps the previous data in place while it runs, and the component ignores a second gesture while isPending.
No new copy beyond a11y.refreshing (the busy label a screen reader hears); the failure reuses rates.refreshFailed.
Desktop needs no equivalent control: vue-query's refetchOnWindowFocus is left at its default, so the same queries reload when the window is focused again.
Verified: apps/web 289 tests (3 new), full monorepo test/typecheck/lint/build green, impeccable detector clean on all three screens.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Pull-to-refresh now works on Home, Accounts and one Account. Each screen wraps its content in PullToRefresh and calls the new shared useScreenRefresh, which asks the backend for today's rates and then refetches every query the screen is currently observing — no per-screen key list to keep in sync. A rates failure is reported with a toast and does not stop the rest of the screen reloading. Verified by new tests on all three screens (the gesture reaches every composed list on Home, accounts plus rates on the list screen, the account and its journal on the detail screen, and the failure path keeps the screen intact) plus the full monorepo run.
<!-- SECTION:FINAL_SUMMARY:END -->
