# ADR-0005: Command MDs Are Permanent Thin Wrappers — the CLI Is the Sole Source of Truth

**Status:** Accepted
**Date:** 2026-07-07

## Context

GETSITREP-8/10 were marked Done with an unmet acceptance criterion: "slash commands become thin wrappers that just call the CLI." In practice, all 8 `commands/*.md` files (and the `.claude/commands/` mirror) kept their full, original prose logic — the CLI built under GETSITREP-8 was added as a second, independently-maintained implementation of the same behavior, not a replacement.

This stopped being a documentation nitpick once GETSITREP-28 (selfheal drift detection, lock/diff/restore) started treating a command MD as something with a "canonical" version to diff and restore against. Two live implementations of the same command — one prose an AI interprets, one real code — can silently diverge in behavior (confirmed in practice: `session-end`'s token-estimate heuristic, `capture`'s interactive phase-prompt, and `selfheal`'s Checks 3-5 all differed between what the MD claimed and what the CLI actually did before this session's work closed those gaps).

Options considered:
1. Keep both: MD prose stays the "spec," CLI is a parallel implementation, accept that they can drift.
2. Convert MDs to thin wrappers now, but only for the commands where it's trivial (pure pass-through), leaving `capture`/`plan-update`/`session-end` as-is.
3. Convert all 8 MDs to thin wrappers, closing the CLI's remaining gaps first so no functionality silently regresses.

## Decision

Option 3. All 8 command MDs are thin wrappers that invoke `getsitrep <command>` and print its output verbatim. The CLI (`src/commands/*.js`) is the single source of truth for command behavior — full stop, not "the spec unless it hasn't caught up yet."

Two commands (`plan-update`, `session-end`) retain a small amount of prose — not because the CLI is incomplete, but because structuring free-form/conversational input into the JSON the CLI expects is inherently an LLM-judgment step no deterministic code can do. That's a permanent, intentional exception, not a residual gap to close later.

Before this conversion, the CLI's own remaining gaps (selfheal Checks 3-5, dashboard's missing sections) were closed first, specifically to avoid a version of sitrep where flipping the MDs silently dropped functionality the old prose used to cover.

## Consequences

- One implementation per command, going forward. A future feature request against a command means changing `src/commands/*.js`, never the MD.
- `commands/*.md` and `.claude/commands/*.md` are now byte-identical (verified via `selfheal diff --file <name>` reporting no differences for all 8) — the long-standing "dogfood mirror drift" problem is resolved as a side effect, not a separate fix.
- Any future adapter (Codex, Cursor, GETSITREP-21) gets this for free: writing a thin wrapper for a new platform is a one-line invocation, not a re-authoring of prose logic per platform.
- The CLI's behavior is now genuinely the spec. Any gap between what a command MD's short reference text says and what the CLI does is a bug to fix in the CLI (or the reference text), not an acceptable, permanent split.
- `capture`, `session-start`, `sitrep`, `selfheal`, `handoff`, `dashboard` have zero retained prose. `plan-update` and `session-end` retain the minimum needed for the one step that must stay human/LLM-judgment — this split is intentional and should not be "completed away" in a future session.
