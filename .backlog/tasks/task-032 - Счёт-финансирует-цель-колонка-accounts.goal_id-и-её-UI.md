---
id: TASK-032
title: 'Счёт финансирует цель: колонка accounts.goal_id и её UI'
status: To Do
assignee: []
created_date: '2026-09-19 13:23'
labels:
  - phase-4
  - api
  - web
  - db
milestone: m-0
dependencies:
  - TASK-031
references:
  - docs/db/schema.dbml
  - docs/superpowers/specs/2026-09-11-phase-2-accounts-design.md
  - CONTEXT.md
type: feature
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Заглушка скоупа фазы 4. В docs/db/schema.dbml колонка accounts.goal_id уже описана с пометкой «phase 4: added by a later migration», а спека фазы 2 (2026-09-11-phase-2-accounts-design.md) прямо говорит, что goal_id добавляется отдельной миграцией в фазе 4. Без этой связи накопленное по цели не посчитать: цель финансируется счетами, и счёт финансирует не больше одной цели (CONTEXT.md, «Goal»).

Критерии ниже — рамка; уточнить из спеки фазы 4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Миграция добавляет accounts.goal_id (nullable, FK на goals) без потери данных
- [ ] #2 Счёт может быть привязан не более чем к одной цели
- [ ] #3 Удаление цели не удаляет счета: выбранное поведение FK описано в задаче и покрыто тестом
- [ ] #4 Форма счёта позволяет выбрать цель и отвязать её
- [ ] #5 Карточка счёта и экран цели показывают связь
- [ ] #6 bun run test, lint, typecheck проходят
<!-- AC:END -->
