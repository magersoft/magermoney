---
id: TASK-039
title: 'Фикстура income-mount: профиль с невалидным uuid ломает /me в тестах'
status: To Do
assignee: []
created_date: '2026-09-19 13:25'
labels:
  - tech-debt
  - web
dependencies: []
references:
  - docs/discovery/phase-3-execution-ledger.md
  - apps/web/test/fixtures/income-mount.ts
type: bug
ordinal: 37000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Найдено при финальном ре-ревью фазы 3. apps/web/test/fixtures/income-mount.ts отдаёт профиль, у которого id не uuid, поэтому запрос /me в тестах с этой фикстурой никогда не резолвится, и тесты проходят на запасной валюте вместо профильной. Они зелёные, но проверяют не тот путь — тихая дыра в покрытии.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Профиль в фикстуре имеет валидный uuid и /me резолвится
- [ ] #2 Тесты, использующие фикстуру, проверяют валюту из профиля, а не запасную
- [ ] #3 Если после починки какой-то тест падает, он чинится по существу, а не возвратом старой фикстуры
<!-- AC:END -->
