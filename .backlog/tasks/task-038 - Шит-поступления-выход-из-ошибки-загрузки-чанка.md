---
id: TASK-038
title: 'Шит поступления: выход из ошибки загрузки чанка'
status: To Do
assignee: []
created_date: '2026-09-19 13:24'
labels:
  - tech-debt
  - web
dependencies: []
references:
  - docs/discovery/phase-3-execution-ledger.md
type: bug
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Найдено при финальном ре-ревью фазы 3. Когда чанк InflowSheet не загружается, QuickActions рисует RouteError прямо внизу страницы, а флаг inflowWanted не сбрасывается — единственный выход, который остаётся пользователю, это перезагрузка, которую предлагает сам RouteError. Нужен отказоустойчивый вид в форме шита, который можно закрыть.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Ошибка загрузки чанка показывается в шите, а не врезкой внизу страницы
- [ ] #2 Шит закрывается, и флаг ожидания сбрасывается
- [ ] #3 После закрытия повторное нажатие пробует загрузить чанк снова
- [ ] #4 Тест воспроизводит отказ загрузки и закрытие шита
<!-- AC:END -->
