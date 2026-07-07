# Adapter Contract — v0.3

> **Status:** Binding spec for GETSITREP-36 (Tier 0). Defines the *interface* — GETSITREP-8 (CLI extraction, Tier 1) built against it, and GETSITREP-21 (auto-run adapters, Tier 2) now implements the hook-writer side for Claude Code, Codex, and Cursor (`src/lib/hooks.js`) plus the AGENTS.md factual nudge (`src/lib/agents-md.js`). Copilot/VS Code (GETSITREP-38) remains unimplemented — the reuse-path it depends on hasn't been verified against a live install. The "Hook event support" table below is still the unverified-against-live-vendor-docs snapshot noted in its own header; the writers implement that snapshot, they don't independently re-confirm it.
> **Source of truth:** this file is canonical. Confluence's "Command × Platform × Hook Mapping" page mirrors it, not the reverse (same flip as command-canon.md and cost-schema.md).

## Why adapters, and why optional

Per Hard Law "no lock-in": the core CLI is platform-agnostic; every adapter below is an optional layer sitrep can run without. A bare install with zero adapters configured still works — plan tracking falls back to native `PROJECT_PLAN.md`, cost tracking falls back to the local estimate heuristic (`docs/specs/cost-schema.md`), and nothing auto-runs until a hook adapter is wired up.

## Three adapter types (v0.3 scope)

| Type | Options | Default when none configured |
|---|---|---|
| **Plan-source** | Jira (read), OpenSpec, Spec Kit, native (`PROJECT_PLAN.md`) | native |
| **Cost-source** | thin local log (estimate), ccusage (actual) | thin local log — see `docs/specs/cost-schema.md`, not duplicated here |
| **Auto-run** | hooks (per-platform), plugin manifest, AGENTS.md factual nudge | none — all commands stay manually invocable |

A fourth type — **ticket-sync** (SitRep pushing status back to Jira/Confluence automatically, instead of today's manual MCP calls) — was explicitly proposed and explicitly deferred: not in v0.3, revisit at v0.4/v0.5 planning. Logged here so it isn't lost, not designed.

## Platform priority (auto-run adapters)

**Committed for v0.3:** Claude Code, Codex CLI, Cursor — full hook-based adapter each, per-platform (not a shared template — the event shapes differ too much, see below).
**Conditional:** Copilot/VS Code — ships only if the native reuse path holds (VS Code parses Claude Code's `.claude/settings.json` directly via `chat.hookFilesLocations`, no translator needed). If that path doesn't hold, Copilot is dropped from v0.3 rather than sitrep building a bespoke translator — GETSITREP-38 is the go/no-go gate.

### Per-platform quirks that break a shared adapter template

- **Codex has no `SessionEnd` event.** Its `session-end` binds to `Stop` instead (turn-scoped, not a true session close — closest available equivalent). Handled per-adapter (GETSITREP-22), not papered over with a shared assumption.
- **Cursor's hook config needs a top-level `"version": 1"` field** — a different shape from the other three platforms' hook config.
- **Config file locations differ per platform** (user-level and project-level) — these same paths double as residue-detection targets for GETSITREP-39's restore-on-`init` flow.

## Command automation tiers (v0.3)

Matches the 8-command canon in `docs/specs/command-canon.md` exactly — two tiers, not three:

- **Automatic (hook-fired):** `session-start`, `session-end`. Must be fail-open, idempotent, non-interactive (Hard Law #5).
- **Intentional (manually invoked):** `sitrep`, `capture`, `plan-update`, `selfheal`, `handoff`, `dashboard`.

**Flagging a stale cross-reference:** GETSITREP-36's own Jira description lists `dashboard` as "on-demand only" and describes a third *Nudged* tier for the other five Intentional commands. The Confluence page this Story cites was revised the same day it was compiled to move `dashboard` into that Nudged tier and add context-hygiene/adoption-nudge triggers — but **the Nudged tier itself belongs to GETSITREP-35, a v0.4 nudge-engine Story that doesn't exist yet.** For v0.3, there is no engine to fire a "nudge," so the honest current-state tier for all six Intentional commands — including `dashboard` — is just "manually invoked, not yet nudged." This spec uses the two-tier model consistently with `command-canon.md`; the three-tier language in Jira/Confluence describes the v0.4 target state, not what ships now.

## Hook event support (confirmed 2026-07-02, verify against live vendor docs before shipping)

| Event | Claude Code | Codex CLI | Cursor | Copilot/VS Code |
|---|---|---|---|---|
| Session start | `SessionStart` | `SessionStart` | `sessionStart` (CLI) | `SessionStart` |
| Session end | `SessionEnd` | none — use `Stop` | `sessionEnd` (CLI) / `stop` (IDE, unverified merge status) | referenced, not directly confirmed this pass |
| Mid-session | `PostToolUse`, `UserPromptSubmit` | `PostToolUse`, `UserPromptSubmit` | `afterFileEdit`, `beforeSubmitPrompt` | `PostToolUse` |

Codex hooks are experimental, off by default, and disabled on Windows — enabling requires `codex_hooks = true` in `[features]`.

## Explicitly unresolved — do not guess these before shipping

Carried forward honestly rather than papered over:

- Cursor CLI's exact install command (not verified as of this spec)
- Whether Cursor's IDE and CLI hook surfaces have converged since 1.7, or remain distinct
- Copilot/VS Code's `SessionEnd` support — needs direct confirmation against VS Code's own docs (GETSITREP-38 gate)
- Context-telemetry availability on Codex/Cursor/Copilot (determines how far GETSITREP-35's context-hygiene nudges can reach outside Claude Code) — not this Story's problem to solve, just recorded so GETSITREP-35 doesn't have to rediscover it

## AGENTS.md / CLAUDE.md constraint

Per Hard Law #4: these files are factual context only, never imperative commands (unreliable under prompt-injection defenses). Auto-run is achieved exclusively through hooks, which are deterministic — not through instructing the file to "auto-run X."
