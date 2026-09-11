---
status: accepted
---
# Balances are declared, not derived from transactions

The user records "account X now holds Y" (a Balance entry), never individual purchases. The current balance is the latest entry; earlier entries are kept as history. Transfers and Inflows are first-class operations that *produce* Balance entries, but no balance is ever computed as a sum of transactions. This matches how the spreadsheet was used for years (rewrite the number) while keeping history, and deliberately rejects the YNAB-style ledger, which the owner would not maintain.

## Consequences

- Monthly spending is not itemised; it is the remainder of the capital change after Inflows and Revaluation, explained at month close by one Spend figure per Budget.
- A future itemised mode would sit on top of this model, not replace it.
