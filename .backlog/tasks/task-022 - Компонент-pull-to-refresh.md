---
id: TASK-022
title: 'Компонент: pull-to-refresh'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 13:15'
updated_date: '2026-09-20 11:14'
labels:
  - ui
dependencies: []
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->

Экраны приложения — PWA, и на телефоне список обновляют жестом «потянуть вниз». Сейчас такого жеста нет ни в packages/ui, ни в приложении. Нужен переиспользуемый компонент, который потом подключается на любой экран со списком, первым — на курсы валют.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->

- [x] #1 Компонент оборачивает контент и по жесту вниз от верха прокручиваемой области вызывает событие refresh
- [x] #2 Жест срабатывает только когда контент прокручен к самому верху и не мешает обычной прокрутке
- [x] #3 Есть индикатор: тянется, готов к отпусканию, идёт обновление; порог и сопротивление подобраны так, чтобы жест ощущался естественно
- [x] #4 Пока идёт обновление, повторный жест игнорируется; состояние управляется через prop или через промис из обработчика
- [x] #5 Анимация берёт пресеты из packages/ui/src/motion и уважает prefers-reduced-motion
- [x] #6 На десктопе без касания компонент ничего не ломает; для доступности есть альтернатива жесту (кнопка или доступное действие), её можно подключить снаружи
- [x] #7 Экспортируется из packages/ui, покрыт тестами и историей/примером использования, если такие есть в пакете

<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->

1. Pure gesture arithmetic in packages/ui/src/components/pull-to-refresh/pull.ts: exponential resistance to a ceiling, phase, progress, scrollable-ancestor and at-top detection.
2. PullToRefresh.vue wraps a slot, arms only at the top of the scroller, owns the gesture with a non-passive touchmove.
3. Indicator with three states (pulling / ready / refreshing), driven by phase and progress.
4. Pending state from an awaited onRefresh callback or from the refreshing prop; a second gesture while busy is ignored.
5. refresh() exposed so a screen can wire a button to the same call.
6. Motion through the package's own tokens (duration-base, duration-fast, ease-out-quart); reduced motion is covered by the global catch-all in styles/index.css.
7. Export from packages/ui, tests in packages/ui/test/pull-to-refresh.test.ts.

<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->

onRefresh is a callback prop rather than an emit on purpose: a component that holds the pending state has to await what the handler returns, and an emit returns nothing. It doubles as @refresh at the call site. (An earlier version had both, and Vue called the handler twice — an emit named refresh resolves to the onRefresh prop.)
Resistance is offset = max * (1 - exp(-distance/max)) with max = 2 * threshold: one-to-one at the start, asymptotic at the end, so the rubber never snaps.
The touchmove listener is registered manually with passive: false — a template listener cannot ask for that, and without it the page scrolls under the pull.
No story/example harness exists in this package; the tests are the usage record. Verified: packages/ui 253 tests pass, plus monorepo typecheck and lint.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->

Added PullToRefresh to packages/ui: it wraps content, arms only when the scroller under the finger is at its top, follows the pull with exponential resistance and shows a three-state indicator (pulling, ready, refreshing). The handler can own the pending state via an awaited onRefresh or via the refreshing prop; gestures during a refresh are ignored; refresh() is exposed so a button can stand in for the gesture on a device without touch. Motion uses the package's duration/ease tokens and inherits the global prefers-reduced-motion catch-all. Verified by packages/ui/test/pull-to-refresh.test.ts (11 cases: arithmetic, threshold, short pull, upward drag, scrolled page, re-entrancy, external pending state, disabled, exposed refresh, untouched content) — 253 ui tests, full monorepo typecheck and lint green.
<!-- SECTION:FINAL_SUMMARY:END -->
