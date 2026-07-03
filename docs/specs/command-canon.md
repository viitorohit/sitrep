# Command Canon — v0.3

> **Status:** Binding spec, authored by GETSITREP-13 per the signed-off audit (GETSITREP-41, Confluence: "Command MD Audit — v0.2 Baseline & Refresh Verdicts", 2026-07-02).
> **Source of truth:** this file is canonical. The Confluence "Command MD Audit" page is a mirror copied FROM this file, not the other way around (flipped 2026-07-03 — see CLAUDE.md Sources of Truth and the ADR index).

## The 8 commands

`session-start`, `session-end`, `sitrep`, `capture`, `plan-update`, `selfheal`, `handoff`, `dashboard`.

Math: 9 files in `commands/` − `pulse` (merged into `sitrep`) − `doctor` (dropped, full overlap with `selfheal`) + `dashboard` (relocated from repo root into `commands/`) = **8**.

## Command classes

**Automatic (hook-fired):** `session-start`, `session-end`. Meant to run unattended via platform hooks (SessionStart/SessionEnd). Must be fail-open, idempotent, non-interactive per Hard Law #5 — never block a developer's workflow.

**Intentional (manually invoked):** `sitrep`, `capture`, `plan-update`, `selfheal`, `handoff`, `dashboard`. Always available on demand; not currently hook-fired. (A future "Nudged" class — proactive suggestions to run these — is planned for v0.4 under GETSITREP-35 and is explicitly out of scope for v0.3.)

## Per-command status (this refresh)

| Command | Class | This refresh |
|---|---|---|
| `session-start` | Automatic | Rewritten — stripped file-repair (now solely /selfheal's job), removed blocking "Do NOT proceed" language, fail-open |
| `session-end` | Automatic | Refreshed — same fail-open/no-file-repair fix; cost figures now explicitly labeled `actual`/`estimate`; added `Branch` field to the session log template. Token/cost estimation logic **stays in prose for now** — moving it into the CLI is deferred until GETSITREP-8 exists (see below) |
| `sitrep` | Intentional | Rewritten — absorbed `/pulse`'s session command tracker and next-suggestion logic |
| `capture` | Intentional | Refreshed — removed file-repair overlap with /selfheal. Task-ID assignment math **stays in prose for now**, same CLI deferral as session-end |
| `plan-update` | Intentional | Light refresh — removed file-repair overlap with /selfheal |
| `selfheal` | Intentional | Rewritten — removed hardcoded `.claude/commands/` paths (Hard Law #1 violation); now checks the canon against the active platform's command directory generically. Foundation for GETSITREP-28 (hash manifest, drift detection, lock/diff/restore) — that full system is not yet built |
| `handoff` | Intentional | Light refresh — removed file-repair overlap with /selfheal |
| `dashboard` | Intentional | Relocated from repo root into `commands/`; light refresh |
| ~~`pulse`~~ | — | **Dropped** — merged into `sitrep` |
| ~~`doctor`~~ | — | **Dropped** — full functional overlap with `selfheal`, no unique content |

## Deferred scope (explicit)

The audit's verdicts for `session-end` and `capture` called for moving their embedded cost-estimation and task-ID math "to the CLI." That CLI is GETSITREP-8, which does not exist yet and is itself gated on this Story (GETSITREP-13) finishing — so this refresh does the structural/canon work now and defers the CLI-migration portions. Each affected MD carries a forward-pointer note. This is a deliberate scope cut agreed with the session owner, not an oversight.

## Cross-cutting rules applied to every rewritten MD

- No hardcoded platform-specific paths (e.g. `.claude/`) — Hard Law #1
- No blocking "Do NOT proceed" steps in hook-fireable commands — Hard Law #5 (fail-open)
- Cost figures carry an explicit `actual`/`estimate` label — Hard Law (cost labeling)
- File-repair behavior is consolidated in `selfheal` only — every other command defers to it rather than searching/moving files itself
