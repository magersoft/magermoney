---
status: accepted
---

# Read models are computed on the client from raw data

The API stores and returns raw entities (accounts, balance entries, goals, rates, ...). Dashboard, savings analytics and yearly history are pure functions in `packages/domain` executed in the browser, so switching the Display currency or editing a balance recomputes instantly and works offline. The API imports the same package to validate invariants on write. The one stored derived value is the monthly Snapshot, because it must freeze the rates of that day.

## Considered options

- Server-built read models (`GET /dashboard`): single place for logic, but every interaction waits on the network and offline shows stale numbers only.
