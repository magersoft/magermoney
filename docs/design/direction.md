# Magermoney — visual direction

## The read

Magermoney replaces a spreadsheet its owner has kept by hand since 2015. That is the subject: a
personal ledger, ten years deep, in a dozen currencies at once. The interface is scanned, not read —
someone opens it to answer "how much, in what, and is it more than last month". So the design takes
its cues from the ledger and the exchange board rather than from fintech marketing: warm paper
neutrals, one ink-coloured accent, amounts set as the largest thing on screen with their currency
code tagged beside them in small mono caps.

Two conventions come straight from double-entry bookkeeping and do real work here:
**in the black, in the red** — a balance is ink, never green; only *changes* (deltas, goal progress,
month-over-month) are allowed colour. And **the ledger rule** — rows are separated by hairlines, not
by cards-inside-cards. Both keep a many-currency screen calm when fifteen numbers are visible at once.

## Dials

| Dial | Setting | Why |
|---|---|---|
| Temperature | Warm neutrals, cool accent | Paper and ink. Also keeps us off the slate-blue default. |
| Contrast | High on amounts, low on chrome | Amounts are the content; labels, rules and chrome recede. |
| Density | Dense data, comfortable controls | 52px data rows; 44px minimum tap target on iPhone. |
| Radius | Two tiers: soft containers, sharp data | Cards 14–20px, controls 8px, rows 0. Not "rounded-lg on everything". |
| Colour count | 1 accent + 3 semantics | Accent never means positive/negative; those are their own hues. |
| Motion | Settle, never bounce | Short distances, ease-out, no springs, no count-ups. |

## Signature

The **amount lockup**: a large tabular-figure amount with its currency code set beside it in mono
small-caps at ~0.6× size and +0.08em tracking, baseline-aligned. It is the one repeated device the
app is recognised by, and it is the same lockup at every scale — dashboard hero, row, chip.

## Type

| Role | Family | Notes |
|---|---|---|
| Interface, amounts | **Instrument Sans** | Google Fonts. A contemporary grotesque with a slightly narrow set — legible at 13px, characterful at 32px. Amounts use `font-variant-numeric: tabular-nums lining-nums`. |
| Codes, data labels, timestamps | **IBM Plex Mono** | Google Fonts. Humanist mono, warm; used only at small sizes, uppercase, tracked out. |

Fonts are loaded by the consuming app (`apps/web`), not by `packages/ui`; the tokens declare full
fallback stacks so the package is usable without them.

**Scale** (1.2 minor third, 16px base): 12 / 13 / 14 / 16 / 20 / 24 / 32 / 44.
Weights: 400 body, 500 labels, 600 amounts and headings. Nothing heavier — bold weights on a
number-dense screen read as alarm.
Line heights: 1.5 body, 1.25 headings, 1.1 amounts. Tracking: −0.01em at 24px and up, +0.08em on
mono labels.

## Tokens

Neutral axis is hue 80 (warm) at chroma <= 0.012; the accent is hue 272 (ink blue-violet) — fountain
pen ink, the mark of a hand-kept ledger. Raw tokens are namespaced `--mm-*` so they never collide
with the shadcn variable contract, which `src/styles/index.css` maps onto them.

| Token | Light | Dark | Contrast on bg |
|---|---|---|---|
| `--mm-bg` | `oklch(0.981 0.005 85)` | `oklch(0.18 0.008 80)` | — |
| `--mm-surface` | `oklch(0.995 0.002 85)` | `oklch(0.22 0.008 80)` | — |
| `--mm-surface-raised` | `oklch(1 0 0)` | `oklch(0.26 0.009 80)` | — |
| `--mm-ink` | `oklch(0.23 0.012 80)` | `oklch(0.96 0.004 85)` | 16.0 / 16.8 |
| `--mm-muted` | `oklch(0.52 0.012 80)` | `oklch(0.68 0.01 80)` | 5.2 / 6.5 |
| `--mm-line` | `oklch(0.9 0.008 80)` | `oklch(0.31 0.008 80)` | hairline, non-text |
| `--mm-line-strong` | `oklch(0.65 0.01 80)` | `oklch(0.49 0.01 80)` | 3.0 / 3.0 |
| `--mm-accent` | `oklch(0.52 0.19 272)` | `oklch(0.68 0.16 272)` | 5.5 / 6.3 |
| `--mm-accent-fg` | `oklch(0.99 0 0)` | `oklch(0.17 0.02 272)` | 5.7 / 6.5 on accent |
| `--mm-positive` | `oklch(0.52 0.13 155)` | `oklch(0.72 0.14 155)` | 4.9 / 8.0 |
| `--mm-negative` | `oklch(0.53 0.19 25)` | `oklch(0.7 0.17 25)` | 5.5 / 6.5 |
| `--mm-warning` | `oklch(0.555 0.14 75)` | `oklch(0.8 0.13 75)` | 4.6 / 9.9 |

Every foreground token clears WCAG AA on its own theme's background. `--mm-line` is the row hairline
and is deliberately quiet; anything the user has to find — a field boundary, a focus ring — uses
`--mm-line-strong` or the accent, which clear the 3:1 non-text minimum.

Radius: `--radius-xs 0.375rem`, `--radius-sm 0.5rem`, `--radius-md 0.875rem`, `--radius-lg 1.25rem`.
Spacing: 4px base step, gutters 16px on iPhone / 24px on web. Coarse pointers get a 44px minimum on
every control, whatever size variant the screen chose.

## Motion

Calm means *settle*, not spring. Entry moves 8px and fades; exits fade only, faster than entries,
because leaving should never hold the user up.

- Durations: `--duration-fast 150ms` (state, hover, press), `--duration-base 240ms` (enter, sheets),
  `--duration-slow 400ms` (route and modal transitions only).
- Curve: `--ease-out-quart cubic-bezier(0.25, 1, 0.5, 1)` for everything entering; linear for opacity-only.
- Animate `opacity` and `transform` only. Never `height`, `top`, `box-shadow`.
- Lists stagger 40ms per item, capped at 8 items — beyond that the tail feels broken, not lively.
- A changing amount cross-fades and slides 4px. It never counts up: counting is slower to read and
  the number is the point.
- `prefers-reduced-motion: reduce` zeroes every duration token; animations still run, instantly, so
  nothing depends on an animation callback to become visible.

## Do / don't

- **Do** give every amount tabular figures and right-align them in any column.
- **Do** distinguish positive / negative / warning from the accent — a green button must never mean
  "primary action".
- **Do** keep the accent for one thing per screen: the primary action or the active state.
- **Don't** colour a balance. Ink for balances; colour only for change.
- **Don't** drift into cream-and-serif: the light background is near-white (L 0.98), the display face
  is a grotesque, and there is no terracotta anywhere.
- **Don't** use gradients for surfaces, shadows deeper than a 1px hairline plus a soft ambient, or a
  second accent hue.
- **Don't** round data rows or table cells; the hairline is the separator.
- **Don't** animate on scroll in product screens. Motion responds to input, not to reading.
