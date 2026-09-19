---
id: TASK-006
title: 'Компонент: карточка счёта и стопка карточек'
status: In Progress
assignee:
  - '@claude'
created_date: '2026-09-19 11:11'
updated_date: '2026-09-19 11:40'
labels:
  - design
  - ui
dependencies:
  - TASK-004
  - TASK-005
documentation:
  - docs/design/moni-review.md
type: task
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
У Moni карточка счёта — главный опознавательный элемент: цветной прямоугольник с балансом, логотипом платёжной системы и последними цифрами. Она появляется горизонтальной полосой на главной и вертикальной стопкой внахлёст на экране счетов (слайды 10, 12, 23).

У нас счёт — не банковская карта: реквизитов мы не храним, зато у каждого счёта есть валюта. Поэтому место логотипа платёжной системы занимает иконка валюты, место маскированного номера — название счёта, а цвет карточки несёт валюту, а не украшает. Счёт в валюте, отличной от базовой, должен быть виден как таковой.

Компонент нужен двум экранам сразу (Главная и Счета) и в двух раскладках — полоса и стопка внахлёст, — поэтому собирается один раз здесь.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Карточка показывает название счёта, баланс через amount lockup и иконку валюты
- [ ] #2 Цвет карточки выводится из валюты детерминированно, а не задаётся вручную на каждом экране
- [ ] #3 Счёт в валюте, отличной от базовой, визуально отличим от счёта в базовой
- [ ] #4 Есть раскладка-полоса (горизонтальный скролл) и раскладка-стопка внахлёст; обе — из одного компонента карточки
- [ ] #5 В полосе последним элементом идёт плитка добавления счёта
- [ ] #6 Карточка — ссылка на счёт: цель нажатия >=44px, фокус с клавиатуры виден, порядок табуляции в стопке совпадает с визуальным
- [ ] #7 Текст на карточке проходит AA на её заливке в обеих темах
- [ ] #8 Тесты покрывают обе раскладки, плитку добавления и признак неосновной валюты
- [ ] #9 bun run test, lint, typecheck проходят
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Tint tokens: add --mm-*-tint-l / --mm-*-tint-c to tokens.css (both themes, both dark branches). The card fill is oklch(tint-l tint-c <hue>); lightness and chroma are fixed per theme, so ink on the fill clears AA for every hue — proved across the whole wheel in tokens-contrast.test.ts.
2. packages/ui/src/components/account-card/currency-tint.ts: currencyHue(code) — deterministic, golden-angle over the app's known-currency order (FIAT_FLAG keys + CRYPTO_KNOWN, append-only), hashed fallback for an unknown code. Pure, tested without mounting.
3. AccountCard.vue: reka-ui Primitive as='a' (a screen passes :as=RouterLink), currency icon (wrapped aria-hidden), account name and AmountLockup both in ink, mono-caps code badge only when code !== baseCode. Content sits in the top band so a stacked card still shows it.
4. AccountCardStrip.vue: horizontal scroll with snap, fixed-width cards, add-account tile last (label and target passed in).
5. AccountCardStack.vue: overlapping stack — each item but the last reserves only the peek height and the card overflows it; DOM order is visual order, ascending z-index, hover/focus-within raises the card so its focus ring is never clipped.
6. Export from packages/ui/src/index.ts; tests in packages/ui/test/account-card.test.ts cover both layouts, the add tile, the foreign-currency mark, tab order and determinism.
7. bun run test, lint, typecheck.
<!-- SECTION:PLAN:END -->
