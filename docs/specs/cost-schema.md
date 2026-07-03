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

## Decision: pricing lookup — delegate where solved, stay static where it isn't

Verified: ccusage does not maintain its own pricing table. It fetches live from [LiteLLM's community-maintained pricing feed](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json) (`model_prices_and_context_window.json`, auto-synced, 100+ models, including cache/reasoning-token pricing), with offline-cache fallback. This is a "someone already solved it" case, per sitrep's own principle: replicate solved layers, don't rebuild them.

- **`actual` mode (ccusage present):** sitrep does **not** build or maintain its own pricing lookup. It reads ccusage's own computed `cost_usd` as-is — ccusage already prices it from LiteLLM's live data. Building a separate LiteLLM-fetch integration here would just reinvent what ccusage already does. This is the same "don't rebuild solved layers" law already in CLAUDE.md, applied specifically to pricing (not just token metering).
- **`estimate` mode (no meter running):** sitrep keeps its own small static pricing table in `MANIFEST.md`, used only for the rough heuristic multiply, always labeled `estimate`. This stays static and manually-maintained **on purpose** — nobody has actually solved "accurate cost with no real meter running" (it's inherently a guess), and even ccusage's own live-pricing path has an open, unresolved upstream issue on historical-pricing accuracy. Adding a live-fetch dependency for a path that's explicitly an estimate anyway would violate the zero-dependency core law for no real accuracy gain.

**No real-time pricing API for sitrep to build, in either mode.** Not deferred to a future version either — the `actual` need is already met by delegating to ccusage/LiteLLM; the `estimate` need is inherently approximate everywhere, including upstream. This is a closed decision, not an open question.

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
