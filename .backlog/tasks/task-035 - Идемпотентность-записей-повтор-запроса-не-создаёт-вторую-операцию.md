---
id: TASK-035
title: 'Идемпотентность записей: повтор запроса не создаёт вторую операцию'
status: To Do
assignee: []
created_date: '2026-09-19 13:24'
labels:
  - tech-debt
  - api
dependencies: []
references:
  - docs/discovery/phase-3-execution-ledger.md
  - docs/discovery/phase-2-execution-ledger.md
type: bug
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Найдено при разборе фазы 2 и перенесено в follow-ups фазы 3 (docs/discovery/phase-3-execution-ledger.md). Если ответ на POST потерялся в сети, клиент повторяет запрос, и в журнале появляется второй Inflow или второй баланс — на телефоне с рваным соединением это реальный сценарий, а не теоретический. Ключей идемпотентности в API нет ни у одной записи.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Клиент присылает ключ идемпотентности при создании Inflow, перевода и записи баланса
- [ ] #2 Повторный запрос с тем же ключом возвращает результат первого и не пишет вторую строку
- [ ] #3 Ключи хранятся так, что не растут бесконечно (срок жизни описан в задаче)
- [ ] #4 Тест воспроизводит потерянный ответ и повтор, и доказывает, что строка одна
<!-- AC:END -->
