# Cost Data Schema — v0.3

> **Status:** Binding spec for GETSITREP-4. No cost number in sitrep may exist without an `actual`/`estimate` label — this is a hard law, not a preference.

## The rule

Every token/cost figure sitrep writes — in `.sitrep-data.json`, `STATUS_REPORT.md`, `session-end` output, or the dashboard — carries one of two labels:

- **`actual`** — sourced from a real meter (ccusage, or exact counts the AI tool reports)
- **`estimate`** — sourced from the light/medium/heavy heuristic already in `session-end.md`

Never write a bare number. If neither source is available, write "not tracked" instead of guessing.

## Two cost-source modes

1. **Thin local estimate (default, zero-dependency)** — the heuristic already in `commands/session-end.md`: light ~20k / medium ~60k / heavy ~150k tokens, priced from `MANIFEST.md`'s static pricing table. Always available, no setup. Labeled `estimate`.
2. **ccusage (when detected)** — per CLAUDE.md's existing hard law ("don't rebuild solved layers"), sitrep reads Claude Code's local usage data via ccusage instead of estimating. Gives real `input`/`output`/`cache_creation`/`cache_read` token counts and cost per session. Labeled `actual`. Wiring this in is GETSITREP-17 (onboarding wizard) / GETSITREP-8 (CLI) scope, not this ticket — this spec just defines the schema those tickets build against.

No third mode planned now. A real-time per-model pricing API (instead of the static `MANIFEST.md` table) is a good future idea but explicitly out of scope for v0.3 — noted here so it isn't lost, not built.

## `.sitrep-data.json` schema addition

Add two fields to every session record (already applied to `session-end.md`'s template in GETSITREP-13):

```json
{
  "tokens": { "input": N, "output": N, "cache_creation": N, "cache_read": N, "total": N },
  "cost_usd": N.NN,
  "cost_label": "actual" | "estimate",
  "cost_source": "ccusage" | "manual_estimate"
}
```

`cache_creation` / `cache_read` are `0` when the estimate mode is active (the heuristic doesn't distinguish them) and populated when ccusage is the source.

## Resolved risk: Tier-B separation (thinking vs. cache)

GETSITREP-4 flagged this as the one unknown that could force a re-scope. Resolution, confirmed against the Claude API and Claude Code's own log format: **there is no separate "thinking" token count anywhere in the stack.** The usage object (API, Claude Code JSONL logs, and ccusage's schema) exposes exactly four buckets — `input`, `output`, `cache_creation`, `cache_read` — and thinking content is billed and counted as part of `output`, indistinguishable from the final response text.

Practical effect: `input`/`output`/`cache_creation`/`cache_read` can be labeled `actual` when sourced from ccusage. A further split of "thinking tokens" out of `output` is **not possible from measured data** — any such split would have to be a separate `estimate`, and this spec does not add one. No re-scope needed; the schema above already reflects this (no `thinking` field).
