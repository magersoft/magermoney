---
id: TASK-031
title: 'Goals: цели-копилки, их API и экран пятым табом'
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
  - docs/discovery/decisions-log.md
documentation:
  - docs/design/direction.md
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Заглушка скоупа фазы 4: детали придут из спеки (TASK-029), сейчас задача существует, чтобы скоуп не потерялся. Цель — то, на что копят: целевая сумма, целевая дата, доля месячных сбережений и счета, которые её финансируют; накопленное = сумма балансов этих счетов в валюте цели (CONTEXT.md, «Goal»). Таблица goals уже описана в docs/db/schema.dbml с пометкой phase 4, миграции нет. По решению фазы 3 (decisions-log, п.4) Goals становится пятым табом рядом с Home · Accounts · Plan · Settings; в TASK-012 блок Goals с референса Moni на Главную сознательно не переносился, потому что целей ещё нет.

Критерии ниже — рамка; уточнить их из спеки, когда она появится.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Миграция создаёт goals по docs/db/schema.dbml, с user_id и RLS
- [ ] #2 Домен считает накопленное по цели как сумму балансов привязанных счетов в валюте цели
- [ ] #3 CRUD цели доступен через API, use case фильтрует по userId и возвращает Result
- [ ] #4 Экран целей открывается пятым табом навигации; вёрстка на языке редизайна (docs/design/direction.md)
- [ ] #5 Пустое состояние ведёт к созданию первой цели
- [ ] #6 Строки en.json и ru.json прогнаны через humanize-text; bun run test, lint, typecheck проходят
<!-- AC:END -->
