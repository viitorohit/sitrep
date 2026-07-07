# Command Canon — v0.3

> **Status:** Binding spec, authored by GETSITREP-13 per the signed-off audit (GETSITREP-41, Confluence: "Command MD Audit — v0.2 Baseline & Refresh Verdicts", 2026-07-02).
> **Source of truth:** this file is canonical. The Confluence "Command MD Audit" page is a mirror copied FROM this file, not the other way around (flipped 2026-07-03 — see CLAUDE.md Sources of Truth and the ADR index).

## The 8 commands

`session-start`, `session-end`, `sitrep`, `capture`, `plan-update`, `selfheal`, `handoff`, `dashboard`.

Math: 9 files in `commands/` − `pulse` (merged into `sitrep`) − `doctor` (dropped, full overlap with `selfheal`) + `dashboard` (relocated from repo root into `commands/`) = **8**.

## Command classes

**Automatic (hook-fired):** `session-start`, `session-end`. Meant to run unattended via platform hooks (SessionStart/SessionEnd). Must be fail-open, idempotent, non-interactive per Hard Law #5 — never block a developer's workflow.

**Intentional (manually invoked):** `sitrep`, `capture`, `plan-update`, `selfheal`, `handoff`, `dashboard`. Always available on demand; not currently hook-fired. (A future "Nudged" class — proactive suggestions to run these — is planned for v0.4 under GETSITREP-35 and is explicitly out of scope for v0.3.)

## Per-command status

| Command | Class | Status |
|---|---|---|
| `session-start` | Automatic | Thin wrapper (GETSITREP-10) over `getsitrep session-start`. Retains the 2026 best-practice reminders (model routing, `/clear` hygiene) as prose printed alongside the CLI's output. |
| `session-end` | Automatic | Thin wrapper (GETSITREP-10) over `getsitrep session-end`. Retains only the one step no CLI can do — building the session-summary JSON (including the light/medium/heavy token-estimate heuristic) from the AI's own knowledge of the conversation — then calls the CLI with `--data`. |
| `sitrep` | Intentional | Thin wrapper (GETSITREP-10) over `getsitrep sitrep`, which owns the absorbed `/pulse` tracker and next-suggestion logic. |
| `capture` | Intentional | Thin wrapper (GETSITREP-10) over `getsitrep capture`. No retained prose needed — the CLI parses `$ARGUMENTS` itself; the original "ask the user which phase" step is dropped in favor of a silent default, consistent with Hard Law #5 (non-interactive). |
| `plan-update` | Intentional | Thin wrapper (GETSITREP-10) over `getsitrep plan-update`. Retains only the one step no CLI can do — interpreting the free-form request in `$ARGUMENTS` into `{type: "decision"\|"risk", ...}` JSON — then calls the CLI with `--data`. |
| `selfheal` | Intentional | Thin wrapper (GETSITREP-10) over `getsitrep selfheal`. GETSITREP-28 (hash manifest, drift detection, lock/diff/restore) is fully landed: baseline manifest (GETSITREP-29), drift report (GETSITREP-30), Checks 3-5 (GETSITREP-10 prep), and lock/diff/restore + upgrade protection (GETSITREP-31). |
| `handoff` | Intentional | Thin wrapper (GETSITREP-10) over `getsitrep handoff`. |
| `dashboard` | Intentional | Thin wrapper (GETSITREP-10) over `getsitrep dashboard`, which now renders all 10 sections from the original design (Progress, Active Sprint, Users, Full Documents, History, and SVG charts closed the remaining gaps as GETSITREP-10 prep). |
| ~~`pulse`~~ | — | **Dropped** — merged into `sitrep` |
| ~~`doctor`~~ | — | **Dropped** — full functional overlap with `selfheal`, no unique content |

## Resolved: MD-to-thin-wrapper conversion (GETSITREP-10)

GETSITREP-8/10 were marked Done with an unmet acceptance criterion: "slash commands become thin wrappers that just call the CLI." All 8 command MDs still carried full standalone prose, independently diverging from the CLI's own implementation — the exact "overlap or conflict" risk the hash-manifest/drift tooling (GETSITREP-28) surfaced once it started treating a command MD as something with a canonical version to diff/restore against. GETSITREP-10 was reopened and completed: the CLI's remaining gaps (selfheal Checks 3-5, dashboard's missing sections) were closed first so no functionality silently regressed, then all 8 MDs (root `commands/` and the `.claude/commands/` mirror, now byte-identical) were rewritten as thin wrappers. `capture`, `session-start`, `sitrep`, `selfheal`, `handoff`, and `dashboard` are pure pass-throughs; `plan-update` and `session-end` retain the one step each genuinely needs an LLM for (structuring free-form input into the CLI's JSON shape) and nothing else.

## Cross-cutting rules applied to every rewritten MD

- No hardcoded platform-specific paths (e.g. `.claude/`) — Hard Law #1
- No blocking "Do NOT proceed" steps in hook-fireable commands — Hard Law #5 (fail-open)
- Cost figures carry an explicit `actual`/`estimate` label — Hard Law (cost labeling)
- File-repair behavior is consolidated in `selfheal` only — every other command defers to it rather than searching/moving files itself
