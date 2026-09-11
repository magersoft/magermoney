---
status: accepted
---

# Money is decimal end to end

Balances range from 2 100 675,19 UZS to 0,0157 BTC and PEPE prices with more than eight decimals, so integer minor units and float64 both break somewhere. Amounts and rates are `numeric` in Postgres, decimal strings in the API, and a `Money` value object over an arbitrary-precision decimal library in `packages/domain`. Rounding is a domain rule (`Money.round()` knows its currency's scale) and happens only at the UI boundary or when the domain says so.

## Considered options

- Float64 everywhere: simplest, but errors accumulate across years of snapshots.
- BigInt in minor units with per-currency scale: exact, but rates still need decimals and every currency carries a scale.
