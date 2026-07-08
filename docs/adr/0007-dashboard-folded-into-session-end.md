# ADR-0007: Dashboard Regeneration Is Auto-Folded Into session-end, Bounded by the Shared Staleness Threshold

**Status:** Accepted
**Date:** 2026-07-08

## Context

`getsitrep dashboard` has always been a fully separate, manually-invoked command with its own commit. This session found a concrete instance of the cost of that: after Session 8 closed (2026-07-07), four more Stories (GETSITREP-48/35/49/50) were merged to `main` across PRs #13-#17, but no `session-end` was ever run for that work — `sitrep/STATUS_REPORT.md`, `.sitrep-data.json`, and `sitrep/dashboard.html` all silently drifted a full session behind real git/Jira state, undetected until a manual git-log-vs-Jira audit caught it. The dashboard specifically had no independent mechanism to notice or bound this drift; it stays exactly as stale as whoever last remembered to run it.

Separately, GETSITREP-35 (proactive command advisor) already built a real staleness signal for a different purpose — a mid-session nudge, not an enforcement mechanism: `src/lib/nudge-triggers.js`'s `dashboardStaleTrigger({sessionCount, dashboardArchiveCount})`, which fires only once `sessionCount - dashboardArchiveCount >= SESSIONS_WITHOUT_DASHBOARD_THRESHOLD` (currently `3`). It tells a developer "you might want to run `/dashboard`" — it doesn't run it for them, and it doesn't fire at all outside an active hook-bound session.

Options considered:
1. **Leave dashboard regeneration fully manual**, relying on the mid-session nudge and human discipline. Rejected — this is the exact mechanism that just failed for four Stories in a row; a nudge that can itself go unheeded (or never fire, e.g. if hooks aren't wired up in the environment that did the work) doesn't bound the drift, only makes it more visible sometimes.
2. **Regenerate the dashboard unconditionally on every `session-end`.** Rejected — `session-end` already fires on every session by design (that's its whole job); doing this every single time adds a second commit-worthy write (a fresh `dashboard.html` + a new archived snapshot under `sitrep/history/dashboards/`) even when nothing meaningful changed since the last view, working against this project's own no-nag/no-noise design philosophy (the same philosophy that gave `dashboardStaleTrigger` a threshold instead of firing on every tick).
3. **Fold dashboard regeneration into `session-end`, gated by the same `dashboardStaleTrigger` signal already built for the nudge**, sharing one implementation of "how stale is the dashboard" rather than inventing a second heuristic that could silently diverge from the first.

## Decision

Option 3. `session-end.js` now computes `dashboardStaleTrigger({sessionCount, dashboardArchiveCount})` (via `dashboard.archiveCount()`, extracted out of `nudge-check.js`'s former private copy of the same logic so there is exactly one implementation) immediately before its own commit. If the trigger fires, `session-end` calls `dashboard.generate()` — the part of `dashboard.js`'s `execute()` that builds/archives/writes the HTML, now extracted so it can run without also firing dashboard's own separate `commit()` — and folds the resulting file writes into `session-end`'s single existing `commit(['sitrep/'], ...)` call. If it doesn't fire, `session-end` just reports how many sessions have passed since the last dashboard view. A dashboard-generation failure is caught and degrades to a warning line; it never blocks `session-end`'s own commit (Hard Law #5).

**Invariant: exactly one commit per `session-end` invocation, regardless of whether the dashboard fold occurred.**

## Consequences

- Dashboard staleness is now bounded to at most `SESSIONS_WITHOUT_DASHBOARD_THRESHOLD - 1` (currently 2) sessions automatically, self-healing on every `session-end` — the exact class of drift this session found and fixed can no longer accumulate silently past that bound, with or without a human remembering to run `/dashboard` separately.
- `getsitrep dashboard` as a standalone manual command is unchanged — it still works exactly as before (`execute()` still calls `generate()` then its own `commit()`), for anyone who wants a fresh view sooner than the threshold would trigger automatically.
- One shared threshold and one shared archive-count implementation now serve both the mid-session nudge (GETSITREP-35) and the session-boundary auto-fold (this ADR) — changing the threshold's value or the counting logic in the future changes both consistently, by construction.
- Doesn't solve: dashboard staleness between the last `session-end` and the *next* one — if a lot happens in a single very long session without closing it out, the dashboard still won't update until that session ends. That's `session-start`/mid-session tooling's territory, not this ADR's.
- Doesn't solve the deeper structural gap this session also found and filed separately (GETSITREP-54): nothing yet mechanically guarantees `session-end` itself gets run at all (e.g. work merged via a path that never invokes it). This ADR bounds dashboard staleness *given* `session-end` runs; it doesn't guarantee `session-end` runs.

---
*ADRs are immutable once Accepted. To change a decision, write a new ADR that supersedes this one — don't edit this file.*
