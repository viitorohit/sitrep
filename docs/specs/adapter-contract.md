# Adapter Contract — v0.4

> **Status:** Binding spec for GETSITREP-36 (Tier 0, v0.3). Defines the *interface* — GETSITREP-8 (CLI extraction) built against it, GETSITREP-21 (auto-run adapters) implemented the hook-writer side for Claude Code, Codex, and Cursor (`src/lib/hooks.js`) plus the AGENTS.md factual nudge (`src/lib/agents-md.js`), and GETSITREP-35 (v0.4, proactive command advisor) implemented the mid-session `PostToolUse`/`afterFileEdit` hook binding referenced below. Copilot/VS Code (GETSITREP-38) remains unimplemented — the reuse-path it depends on hasn't been verified against a live install. The "Hook event support" table below is still the unverified-against-live-vendor-docs snapshot noted in its own header; the writers implement that snapshot, they don't independently re-confirm it. GETSITREP-50 (v0.4) added the tool-neutral integration mechanism — see the new section below and ADR-0006.
> **Source of truth:** this file is canonical. Confluence's "Command × Platform × Hook Mapping" page mirrors it, not the reverse (same flip as command-canon.md and cost-schema.md).

## Why adapters, and why optional

Per Hard Law "no lock-in": the core CLI is platform-agnostic; every adapter below is an optional layer sitrep can run without. A bare install with zero adapters configured still works — plan tracking falls back to native `PROJECT_PLAN.md`, cost tracking falls back to the local estimate heuristic (`docs/specs/cost-schema.md`), and nothing auto-runs until a hook adapter is wired up.

## Three adapter types (v0.3 scope)

| Type | Options | Default when none configured |
|---|---|---|
| **Plan-source** | native (`PROJECT_PLAN.md`), OpenSpec, Spec Kit, or any externally-tracked tool (jira today; asana/linear/github etc. later — all handled by the one generic mechanism below, GETSITREP-50) | native |
| **Cost-source** | thin local log (estimate), ccusage (actual) | thin local log — see `docs/specs/cost-schema.md`, not duplicated here |
| **Auto-run** | hooks (per-platform), plugin manifest, AGENTS.md factual nudge | none — all commands stay manually invocable |

A fourth type — **ticket-sync** (SitRep pushing status back to Jira/Confluence automatically) — was proposed and deferred in v0.3 planning; GETSITREP-50 (below) resolves this differently than originally framed: not a sitrep-built push mechanism, but a declarative one the calling AI agent acts on with its own tooling.

## Tool-neutral integration mechanism (GETSITREP-50, v0.4) — sitrep never custodies credentials

Full decision recorded in **ADR-0006**; summary here for adapter-contract completeness.

sitrep never stores, reads as a config field, or transmits credentials for any external tool, present or future — `sitrep.config.json` is tracked in git, not gitignored, so there is nowhere safe to put one, and sitrep has zero network code by design. Every externally-tracked plan source (`jira` today, any future value) works through two independent, both-optional, both-agent-mediated halves:

1. **Declarative relay (write direction — no sitrep code at all).** When `planSource` names an external tool, `src/lib/agents-md.js`'s factual AGENTS.md block names the tool and its reference. The calling AI agent — which typically already has its own independent access to that tool (an MCP connection or similar) — decides entirely on its own whether to relay sitrep-observed events (e.g. after `session-end`) there. sitrep never attempts this, never verifies it happened, never knows how. Per Hard Law #4, this line is factual, never an instruction to act.
2. **Generic read-back (display direction — one shared code path for any tool).** `src/lib/plan-adapters.js`'s `readPlan()` routes *any* `planSource` value that isn't `native`/`openspec`/`speckit`/`none` through one function, `readExternalPlan(source, externalData)` — a tool-agnostic aggregate-summary contract (`{tool, ref, fetchedAt, totalTasks, doneTasks, summary}`), passed via `--plan-data '<json>'` on `sitrep`/`session-start`. Adding a new external tool (asana, linear, github, ...) needs **zero new reader code** — just a new allowed `planSource` value.

A future, strictly optional, per-adapter headless fallback (delegating to an already-installed, already-authenticated vendor CLI that owns its own credential storage — never raw env-var tokens) remains explicitly deferred, not designed, same treatment as the ticket-sync idea above.

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

**Update (v0.4, GETSITREP-35 shipped):** GETSITREP-36's own Jira description lists `dashboard` as "on-demand only" and describes a third *Nudged* tier for the other five Intentional commands — that Nudged tier now exists: GETSITREP-35's `nudge-check` command (bound to `PostToolUse`/`afterFileEdit`, see the Hook event support table below) surfaces opportunity-detection nudges for `sitrep`, `capture`, `selfheal`, `handoff`, and `dashboard`. `plan-update`'s divergence trigger remains unimplemented — it depends on GETSITREP-52 (Scoped conflict check), not yet built. This spec's two-tier model (Automatic/Intentional) still describes the *invocation* mechanism accurately; "Nudged" is a cross-cutting behavior layered on top of the Intentional tier, not a third invocation class.

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
