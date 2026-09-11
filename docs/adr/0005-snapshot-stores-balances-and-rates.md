---
status: accepted
---

# A Snapshot stores per-account balances and rates, not totals

Because the user can add any currency to the Display currency switch at any time, a month-end Snapshot freezes every Account balance and every Rate of that day rather than three pre-summed totals. Totals in any currency are derived later. Snapshots imported from the spreadsheet are marked `legacy` and hold totals only; they cannot be re-derived, and the UI must say so.
