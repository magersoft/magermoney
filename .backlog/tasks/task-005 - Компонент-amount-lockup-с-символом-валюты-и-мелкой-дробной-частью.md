---
id: TASK-005
title: 'Компонент: amount lockup с символом валюты и мелкой дробной частью'
status: Done
assignee:
  - '@claude'
created_date: '2026-09-19 11:11'
updated_date: '2026-09-19 11:34'
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
- [x] #1 Символ валюты стоит перед числом, дробная часть набрана 0.6x от целой и выровнена по базовой линии
- [x] #2 Для валюты без однозначного символа (USDT, BTC) его место занимает код в mono-капсе
- [x] #3 Компонент умеет добавить код валюты после числа — для экранов, где встречаются две валюты с одинаковым глифом
- [x] #4 Цифры табличные (tabular-nums lining-nums); сумма одинаковой длины не дёргается при обновлении
- [x] #5 Размер задаётся снаружи; пропорция целых и дробных сохраняется на всех кеглях от чипа до героя
- [x] #6 Отрицательная сумма отличается от положительной; баланс остаётся чернильным, цвет получает только изменение
- [x] #7 Экспортирован из публичного API packages/ui
- [x] #8 Тесты покрывают: валюту с символом, без символа, режим с кодом, ноль, отрицательное, крупное значение с разделителями
- [x] #9 bun run test, lint, typecheck проходят
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
AmountLockup лежит в packages/ui/src/components/amount-lockup: чистый форматтер format-amount.ts (resolveCurrencySymbol + formatAmountLockup + plainAmount) и тонкий AmountLockup.vue поверх него.

Решения:
- Сумма уходит в Intl строкой, а не числом (NumberFormat v3): десятичная строка из Money печатается точно, без потери разрядов на больших балансах.
- Символ ищется через narrowSymbol; Intl отвечает самим кодом для BTC/XRP и бросает RangeError на четырёхбуквенном USDT — оба случая дают null, то есть код в mono-капсе. Отдельного списка валют не нужно.
- Размер нигде не объявлен: 0.6x дробных и mono-кода выражены в em, поэтому пропорция держится от чипа до героя, а кегль задаёт вызывающий класс.
- Минус — U+2212, а не дефис Intl; -0.00 считается нулём и знака не получает.
- Табличные цифры приходят из data-amount (правило в styles/index.css), плюс дробная часть и знак не меняют ширину целой.
- Доступность: sr-only со всей суммой одной строкой, визуальная разбивка под aria-hidden.

Проверка: bunx vitest run test/amount-lockup.test.ts — 17 тестов; bun run test (343 теста), bun run lint, bun run typecheck — зелёные.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Добавлен amount lockup — подпись приложения: символ валюты перед числом, дробная часть 0.6x на той же базовой линии, mono-капс код там, где символа нет (USDT, BTC), и опциональный код после числа для экранов с общим глифом. Компонент и форматтер экспортированы из packages/ui. Проверено тестами packages/ui/test/amount-lockup.test.ts (17 шт.: валюта с символом и без, режим с кодом, ноль, отрицательное, крупное значение с разделителями ru/en, 0.6em дробной части, табличные цифры, наследование кегля, цвет только у изменения, публичный экспорт) и полными bun run test / lint / typecheck.
<!-- SECTION:FINAL_SUMMARY:END -->
