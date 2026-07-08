# ADR-0006: Third-Party Integrations Are Tool-Neutral and Agent-Mediated — sitrep Never Custodies Credentials

**Status:** Accepted
**Date:** 2026-07-08

## Context

GETSITREP-50's original scope assumed sitrep itself would make live, authenticated Jira REST API calls to overlay ticket status on `sitrep`/`session-start`'s output. That implies sitrep would need to obtain, hold, or read some Jira credential (API token or OAuth secret) at runtime.

Two problems, confirmed before any code was written:

1. `sitrep.config.json` — the only place such a value could plausibly live — is **tracked in git, not gitignored** (only `sitrep/.sitrep-active-session` and `marketing/` are). Any credential field added to that schema would be committed by default unless every adopting team separately remembered to exclude it.
2. **Zero network code exists anywhere in `src/` today.** Building a bespoke authenticated Jira REST client would be the CLI's first-ever live network capability, not an incremental add — and the same problem (a new bespoke client, a new credential surface) would repeat for every future integration this project is likely to want (GitHub, Linear, Confluence, Asana, Slack).

A first redesign pass removed the credential but kept the integration Jira-shaped: a `readJiraPlan()` function, a Jira-specific JSON contract (`{issues:[{key,status,done}]}`). This was rejected — it still "softlocked" the design to Jira; adding Asana next would mean writing a second, parallel bespoke reader, repeating the same mistake one tool later.

The corrected direction generalizes a pattern this project already established: **ADR-0005** decided that `session-end`/`plan-update` keep a thin sliver of prose specifically because turning free-form input into the CLI's expected JSON is "inherently an LLM-judgment step no deterministic code can do" — the calling AI agent does that step, the CLI stays a deterministic JSON-in/file-out layer. Fetching status from (or relaying updates to) a third-party tool the agent already has its own access to is the same shape of exception, applied to data *retrieval and relay* instead of data *interpretation*.

Options considered:
1. sitrep builds its own authenticated REST client per integration (env-var or config-stored credentials).
2. sitrep never touches a credential for any integration. It declares, as factual project context, which external tool (if any) a project is tracked against; the calling AI agent — which typically already has its own independent, already-authenticated access to that tool — decides on its own whether to relay sitrep-observed events there, and may optionally hand back a tool-agnostic status summary for sitrep to display. One generic mechanism, reused identically regardless of which tool is configured.
3. Integrations are out of scope entirely until a fuller design exists.

## Decision

Option 2. sitrep never stores, reads as a first-class config field, or transmits third-party credentials, for any integration, present or future. Every externally-tracked plan source works through two independent, both-optional halves, neither of which is per-tool code:

1. **Declarative relay (write direction, no sitrep code at all).** `src/lib/agents-md.js`'s factual AGENTS.md block names the configured tool and reference when `planSource` isn't a file-based source (native/openspec/speckit/none). The agent reads this at session start (already does, unconditionally, per GETSITREP-23) and decides entirely on its own — using whatever access it independently has — whether to relay sitrep-observed events (e.g. after `session-end`) to that tool. Per Hard Law #4, this is stated as fact, never as an instruction to act.
2. **Generic read-back (display direction, one shared code path for any tool).** `src/lib/plan-adapters.js`'s `readPlan()` routes any `planSource` value that isn't `native`/`openspec`/`speckit`/`none` through a single function, `readExternalPlan(source, externalData)`, consuming one tool-agnostic aggregate-summary contract (`{tool, ref, fetchedAt, totalTasks, doneTasks, summary}`) passed via `--plan-data`. Adding a new external tool needs zero new reader code — only a new allowed `planSource` value.

A future, strictly optional, per-adapter headless fallback for use with no AI agent in the loop (delegating to an already-installed, already-authenticated vendor CLI that owns its own credential storage — e.g. a future `gh`/`acli`/`jira` CLI delegation, never raw environment-variable tokens) is explicitly **deferred, not designed** — logged here the same way `docs/specs/adapter-contract.md` already defers its "ticket-sync" idea, revisited only if real demand appears.

**Standing constraint, binding on every future integration:** nothing here may change or interrupt a developer's existing workflow with a tool they've already configured in their AI agent — with or without sitrep installed. Every piece is optional, additive, and fails open.

## Consequences

- sitrep's credential attack surface for every integration, present and future, is zero by construction — there is nothing to steal from a compromised `sitrep.config.json`, a leaked repo, or a CI log, because sitrep never holds a credential.
- `sitrep.config.json` carries a standing rule (a code comment in `src/lib/config.js`): never add a token/secret field to this schema.
- External-tool status surfaced through sitrep always carries a freshness label (`fetchedAt`, rendered in `note`) rather than implying a live read — the same honesty discipline `docs/specs/cost-schema.md` already applies to cost figures (`actual`/`estimate`) is extended to plan data.
- Adding a second external tool (Asana, Linear, GitHub Issues, ...) is config-only: no new reader function, no new JSON contract, no new AGENTS.md logic — verified directly in `test/plan-adapters.js` by exercising `planSource: 'asana'`, a value that exists nowhere else in this codebase, through the exact same code path `jira` uses.
- Building a bespoke authenticated REST client per integration is explicitly ruled out as the default going forward — a future integration proposing its own REST client is a deviation from this ADR and needs its own superseding decision, not a quiet exception.
- Doesn't solve: a project with no AI agent in the loop and no locally-installed vendor CLI has no supported path to live external-tool data. That use case isn't designed here; it's an honest, named gap, not a silently-dropped requirement.
