---
id: TASK-005
title: 'Компонент: amount lockup с символом валюты и мелкой дробной частью'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-19 11:11'
updated_date: '2026-09-19 11:31'
labels:
  - design
  - ui
dependencies:
  - TASK-004
documentation:
  - docs/design/direction.md
type: task
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Amount lockup — подпись приложения, единственный приём, по которому его узнают, и он меняется целиком: раньше код валюты стоял в mono-капсе после числа, теперь символ идёт перед числом, а дробная часть набирается 0.6x от целой (решение согласовано с владельцем при разборе референса).

Двенадцать валют ломают приём в двух местах, и компонент обязан их разрешать: у USDT и BTC символа нет, а знак доллара носят несколько валют. Правило записано в direction.md, раздел Signature. Компонент один и тот же на любом масштабе — герой главной, строка списка, чип, — поэтому размер задаётся снаружи, а пропорция целых к дробным остаётся неизменной.

Все остальные компоненты и экраны берут суммы через него, так что он идёт первым в слое.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Символ валюты стоит перед числом, дробная часть набрана 0.6x от целой и выровнена по базовой линии
- [ ] #2 Для валюты без однозначного символа (USDT, BTC) его место занимает код в mono-капсе
- [ ] #3 Компонент умеет добавить код валюты после числа — для экранов, где встречаются две валюты с одинаковым глифом
- [ ] #4 Цифры табличные (tabular-nums lining-nums); сумма одинаковой длины не дёргается при обновлении
- [ ] #5 Размер задаётся снаружи; пропорция целых и дробных сохраняется на всех кеглях от чипа до героя
- [ ] #6 Отрицательная сумма отличается от положительной; баланс остаётся чернильным, цвет получает только изменение
- [ ] #7 Экспортирован из публичного API packages/ui
- [ ] #8 Тесты покрывают: валюту с символом, без символа, режим с кодом, ноль, отрицательное, крупное значение с разделителями
- [ ] #9 bun run test, lint, typecheck проходят
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pure formatter packages/ui/src/components/amount-lockup/format-amount.ts: resolveCurrencySymbol(code, locale) via Intl narrowSymbol (symbol === code or RangeError => no symbol), formatAmountLockup(amount, opts) => { sign, lead: {kind: 'symbol'|'code'}, integer, fraction, code } built from Intl formatToParts, never arithmetic.
2. Failing tests first (packages/ui/test/amount-lockup.test.ts): symbol currency, USDT/BTC without symbol, trailing-code mode, zero, negative, large value with separators, ru/en separators, mount assertions for 0.6em fraction, tabular digits and the accessible plain string.
3. AmountLockup.vue: inline-flex baseline row, size inherited from the caller (font-size outside), fraction and mono code at 0.6em so the proportion holds at every step, sr-only plain amount plus aria-hidden visual parts, weight 600, data-amount for tabular-nums.
4. variant 'balance' (ink, minus sign U+2212) vs 'change' (explicit +/- and positive/negative token colour) — balances stay ink per direction.md.
5. Export the component, the formatter and its types from packages/ui/src/index.ts; extend the exports test.
6. bun run test, lint, typecheck.
<!-- SECTION:PLAN:END -->
