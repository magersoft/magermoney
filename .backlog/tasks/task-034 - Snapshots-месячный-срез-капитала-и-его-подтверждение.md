---
id: TASK-034
title: 'Snapshots: месячный срез капитала и его подтверждение'
status: To Do
assignee: []
created_date: '2026-09-19 13:24'
labels:
  - phase-5
  - api
  - web
  - db
milestone: m-1
dependencies:
  - TASK-030
references:
  - docs/db/schema.dbml
  - CONTEXT.md
  - docs/adr
type: feature
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Заглушка скоупа. В docs/db/schema.dbml таблицы snapshots, snapshot_balances и snapshot_rates помечены phase 5 (не 4, как можно решить по follow-ups фазы 3): один снимок на пользователя в месяц, draft создаёт крон, пользователь подтверждает его в confirmed, legacy — импортированные из таблицы итоги, которые нельзя пересчитать в другие валюты (ADR 0005, CONTEXT.md «Snapshot»). Снимки — основа аналитики: месячная дельта, средние, прогноз строятся над ними и Inflow.

Критерии ниже — рамка; уточнить из спеки фазы 5 (TASK-030).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Миграция создаёт snapshots, snapshot_balances и snapshot_rates по docs/db/schema.dbml, с user_id и RLS
- [ ] #2 Снимок замораживает балансы всех счетов и курсы, которыми он посчитан
- [ ] #3 Крон создаёт draft раз в месяц; повторный запуск не создаёт второй снимок за тот же месяц
- [ ] #4 Пользователь подтверждает draft, и подтверждённый снимок больше не пересчитывается
- [ ] #5 Legacy-снимок с одними итогами не пытается конвертироваться в другие валюты
- [ ] #6 bun run test, lint, typecheck проходят
<!-- AC:END -->
