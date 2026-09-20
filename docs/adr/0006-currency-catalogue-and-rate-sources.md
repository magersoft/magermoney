# 0006 — The currency catalogue is the database, and it records where each rate comes from

Status: accepted · 2026-09-20

## Context

The app shipped with nineteen currencies written out twice: `DEFAULT_CURRENCIES`
in `packages/domain` and an `insert` in the first migration. Adding a currency
meant a release, so nobody could hold Colombian pesos without one.

Opening the catalogue up runs into the rates. The two providers do not cover the
same ground and do not speak the same language:

- **open.er-api** quotes about 160 fiat currencies against USD, by ISO code.
  Roughly two dozen ISO 4217 codes are not among them.
- **CoinGecko** prices by its own identifier — `bitcoin`, not `BTC` — so a
  ticker alone is not enough to ask about a coin, and two coins can share a
  ticker.

A catalogue that ignored this would offer a currency the app cannot price, and
a conversion against a missing rate is not a visible failure: it reads as a
balance of zero.

## Decision

**`public.currencies` is the catalogue.** The domain keeps only
`SAMPLE_CURRENCIES`, a fixture for tests; nothing on a production path reads it.
The API's registry (`CatalogueRegistry`) loads the table once per cold start,
behind a middleware that runs before any handler, and answers synchronously from
that snapshot — every use case validates a currency deep inside a `Result`
chain and cannot await. It has no compiled-in fallback: answering from nineteen
currencies during a database outage would reject two hundred perfectly good
accounts as unknown currencies, which is a worse failure than the outage.

**Each row names its rate source.** `rate_source` is `'open-er-api'`,
`'coingecko'` or null, and `coingecko_id` carries CoinGecko's name for a coin.
A check constraint ties the two to `kind`, so the catalogue cannot drift into
asking the wrong provider. The rates job reads the currencies to ask for from
this column rather than from a list in its own code, which is also what lets
TASK-025 narrow it further to the currencies somebody has actually connected.

**A currency with no source is marked, not hidden.** `rate_source is null`
means no provider quotes it. Such a currency can still be connected, held and
recorded; what it cannot do is convert automatically. The screen says so and
offers a manual rate, which the app already supports.

**The catalogue is generated, and the output is committed.**
`apps/api/scripts/currency-catalogue/` holds the curated code lists; names and
minor units come from ICU. The generated rows are committed as
`catalogue.json` and as the migration, and the tests check the committed file.
The two runtimes in this repo ship different CLDR vintages — the rupiah has two
minor digits under one and none under the other — so a test that re-derived the
data would be testing the machine it ran on. Scales already used to interpret
stored balances are pinned by hand for the same reason.

## Consequences

- Adding a currency is a migration, not a release.
- A cold start costs one extra query. The snapshot is held for ten minutes.
- Three ISO currencies currently have no source: KPW, SVC, VED. They are
  usable, with manual rates.
- Mantle (MNT) is out of the catalogue: its ticker is the Mongolian tugrik's
  ISO code, and `code` is the primary key. A future coin that collides the same
  way needs a decision, not a silent overwrite.
