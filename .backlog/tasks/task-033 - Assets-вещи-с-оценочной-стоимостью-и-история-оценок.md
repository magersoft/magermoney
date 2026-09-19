---
id: TASK-033
title: 'Assets: вещи с оценочной стоимостью и история оценок'
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
  - TASK-029
references:
  - docs/db/schema.dbml
  - CONTEXT.md
documentation:
  - docs/design/direction.md
type: feature
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Заглушка скоупа фазы 4. Asset — то, чем владеют и что имеет оценочную стоимость, но не является деньгами на счёте: машина, техника. У него есть история оценок, и он может как учитываться в общем капитале, так и не учитываться; целью он не бывает (CONTEXT.md, «Asset»). Таблицы assets и asset_valuations уже описаны в docs/db/schema.dbml с пометкой phase 4, миграции нет.

Отдельный вопрос для спеки: участие в общем капитале меняет цифру на Главной, которая сегодня складывается только из счетов.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Миграция создаёт assets и asset_valuations по docs/db/schema.dbml, с user_id и RLS
- [ ] #2 Оценка добавляется отдельной записью, история сохраняется; текущая стоимость — последняя оценка
- [ ] #3 Флаг участия в общем капитале учитывается при расчёте капитала на Главной
- [ ] #4 CRUD доступен через API, use case фильтрует по userId и возвращает Result
- [ ] #5 Экран и форма собраны на языке редизайна; строки en.json и ru.json прогнаны через humanize-text
- [ ] #6 bun run test, lint, typecheck проходят
<!-- AC:END -->
