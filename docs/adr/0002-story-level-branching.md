# ADR-0002: Story-Level Branching, Not Sub-task-Level

**Status:** Accepted
**Date:** 2026-07-01

## Context
Original convention was one branch per Jira sub-task. In practice, many sub-tasks are minutes of work — a branch, session, and PR per sub-task was overhead disproportionate to the work itself.

## Decision
One git branch per Jira **Story**, named after its key (e.g. `GETSITREP-8-cli-core-extraction`). All sub-tasks under a Story are worked inside that single branch, across however many sessions it takes. Sub-tasks remain the fine-grained Jira tracking unit and are marked Done individually as they complete — they just don't each get their own branch.

This makes Sub-task, Session, and Branch three independently-sized units:
- **Sub-task** — Jira tracking granularity, unchanged.
- **Session** — a real block of work, ends at a natural checkpoint, not a fixed duration or a fixed alignment to sub-task boundaries.
- **Branch** — the git/PR unit, opens when a Story starts, closes when its acceptance criteria are met.

Exception: a sub-task large or risky enough to warrant isolation may get its own branch off the Story branch — case-by-case, not the default.

## Consequences
- PR review happens at Story granularity (coherent unit of value), not fragmented across dozens of micro-PRs.
- Requires Jira sub-task status to be trusted as the real-time granular signal, since git branches no longer map 1:1 to it.
- `main` stays protected and always releasable regardless of how long a Story branch is open.
