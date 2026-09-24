---
id: TASK-063
title: 'e2e smoke: создание счёта падает на поле страны'
status: To Do
assignee: []
created_date: '2026-09-24 11:24'
labels:
  - testing
  - frontend
dependencies: []
references:
  - apps/web/e2e/smoke.spec.ts
type: bug
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Playwright smoke (`apps/web/e2e/smoke.spec.ts`) падает на строке 115: `page.getByTestId('form-country').fill('RU')`. Поле страны в форме счёта стало комбобоксом (`data-slot="combobox"`, CountrySelect), а тест всё ещё заполняет его как обычный input — Playwright отвечает «Element is not an <input>…». Из-за этого smoke не доходит ни до одного шага после создания счётов. В TASK-062 шаг «Обновить остаток» в этом тесте переписан под новый шит (`balance-form`, `quick-action-amount`, `quick-action-confirm`), но ни разу не запускался — его нужно проверить, когда тест снова пройдёт. Локальный запуск: E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY / E2E_SUPABASE_ANON_KEY из `bunx supabase status -o env`, затем `bunx playwright test` в apps/web.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Smoke выбирает страну через комбобокс так же, как это делает человек (роль/опция, а не fill по testid обёртки)
- [ ] #2 bunx playwright test в apps/web проходит целиком против локального Supabase
- [ ] #3 Шаг «Обновить остаток» на странице счёта в smoke проходит на новом шите из TASK-062
<!-- AC:END -->
