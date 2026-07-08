# CLAUDE.md — sitrep Project

## Project Overview
sitrep is an open-source AI-native project operations framework — the operations, cost, and continuity layer for AI-assisted development. It lives inside developer repos as markdown files that AI coding assistants read and update. It sits BESIDE planning tools (Jira, OpenSpec, Spec Kit), it does not replace them.

**GitHub:** github.com/viitorohit/sitrep · **Domain:** getsitrep.dev · **License:** MIT
**Shipped:** v0.3.0 "Sharper & Self-Sufficient" (npm + GitHub release, 2026-07-08) · **In development:** v0.4.0 "Cost-to-Outcome & Beside"

## Sources of Truth — Priority Order
1. **Jira project GETSITREP** — canonical for scope, status, build order. Atlassian MCP is connected — fetch live rather than asking the session owner to paste.
2. **This repo, `docs/specs/`** — canonical for technical specs (command canon, adapter contract, cost schema), as they're authored. **Confluence is a mirror of this, not the source** (flipped 2026-07-03 — see ADR index below; specs not yet migrated are still Confluence-only until their owning Story authors the `docs/specs/` version as part of its acceptance criteria).
3. **`docs/adr/`** — canonical for *why* a decision was made. Immutable once Accepted; only ever superseded, never edited. Read the relevant ADR instead of asking "why" — don't re-litigate a decision that already has one.
4. **This file** — durable operating rules only (governance, hard laws, pointers). No decision rationale lives here anymore — that's what ADRs are for. No file-tree snapshot either (previous versions drifted twice) — audit the actual tree yourself at session start (`ls`, `git status`).
5. **`sitrep/` dogfood files** — reconciled and actively maintained (`STATUS_REPORT.md`/`PROJECT_PLAN.md`/`.sitrep-data.json` via `session-end`, `dashboard.html` folded into the same commit per ADR-0007). Still worth a quick `git log`/Jira cross-check at session start — this project has hit real drift before when a session skipped `session-end` (see GETSITREP-54, and the Session 9 close-out incident in `sitrep/STATUS_REPORT.md`'s own log).

## Decision Log (ADRs)
Full record in `docs/adr/`. Index:
| # | Decision | Status |
|---|---|---|
| 0001 | Single repo, no fork/dev-split | Accepted |
| 0002 | Story-level branching, not sub-task-level | Accepted |
| 0003 | marketing/ untrack-only, not history rewrite | Accepted |
| 0004 | CLI (GETSITREP-8) built greenfield in-repo, not ported | Accepted |
| 0005 | Command MDs are permanent thin wrappers; CLI is sole source of truth | Accepted |
| 0006 | Third-party integrations are tool-neutral and agent-mediated; sitrep never custodies credentials | Accepted |
| 0007 | Dashboard regeneration is auto-folded into session-end, bounded by the shared staleness threshold | Accepted |

New architecturally-significant decision this session? Propose an ADR (use `docs/adr/template.md`), don't just narrate it in chat or bury it in a commit message.

## Verified Repo Facts (re-audited 2026-07-09 — v0.3 fully shipped; re-verify, don't assume)
- `package.json` and `bin/getsitrep.js` are real and in-repo (GETSITREP-8). The CLI is published to npm as `getsitrep@0.3.0` (2026-07-08) — `npx getsitrep init` works exactly as README documents.
- 8 command MDs live in `commands/` (canon locked by GETSITREP-13); `.claude/commands/` is a byte-identical thin-wrapper mirror (ADR-0005).
- `.gitignore` is tracked; `marketing/` is gitignored (ADR-0003), not public.
- Every command supports `--help`/`-h` without running (GETSITREP-55); `session-end`/`dashboard` refuse outright (no write, no commit) on any other malformed flag rather than proceeding with placeholder data (GETSITREP-54).

## v0.4 Scope — Tier Build Order (mirror of Jira, current as of 2026-07-09)
- **Tier 0 — shipped:** GETSITREP-48 (cost-to-outcome pipeline), GETSITREP-49 (native/OpenSpec/Spec Kit plan adapter), GETSITREP-35 (proactive nudges).
- **Tier 1 — shipped:** GETSITREP-50 (tool-neutral external integration, ADR-0006), GETSITREP-51 (report/plan/progress commands), GETSITREP-44 (model cost breakdown).
- **Tier 1, remaining:** GETSITREP-42 (dashboard: session timeline + print CSS polish — cost charts already landed via GETSITREP-44).
- **Tier 2:** GETSITREP-52 (scoped plan-vs-reality conflict check). Needs Tier 1.
- **Tier 3:** GETSITREP-53 (cost optimization advisory). Needs GETSITREP-52.
- **v0.4.0 tags/releases only once Tier 2+3 land** — matching the v0.2/v0.3 precedent of releasing complete versions only, not partial ones.

## Session Governance — Story → Branch → Ticket Loop
1. Pick up one Story per session-thread, respecting tier order. One branch per Story: `{JIRA-KEY}-{slug}` off main. Subtasks share the Story branch.
2. `main` is protected and always releasable. No direct pushes.
3. Propose Jira transitions (→ In Progress, → In Review) via the connected Jira MCP; the session owner applies or approves. **NEVER transition anything to Done and never merge — human-approved only.**
4. **Session-end is a hard gate — a session is NOT closed until ALL of these are done, in order:**
   a. Run SitRep's own `/session-end` — updates `sitrep/STATUS_REPORT.md`, `sitrep/PROJECT_PLAN.md`, `.sitrep-data.json`, commits. This is the dogfood layer; skipping it is the exact drift this whole restructure was meant to stop.
   b. Run `/dashboard` if meaningful progress happened this session — regenerates `sitrep/dashboard.html`, archives the previous one.
   c. Post a Jira comment on the Story summarizing what happened this session (even if incomplete/paused).
   d. If a spec was authored or changed in `docs/specs/`, push the matching update to its Confluence mirror via the connected Confluence MCP — same session, not deferred.
   e. If a new architecturally-significant decision was made, write an ADR (`docs/adr/template.md`) — don't leave it undocumented for a future session to reconstruct.
   f. Anything cross-cutting (affects other Stories, contradicts an existing ADR, or needs judgment beyond this session's Story) — flag explicitly in the session-end summary so the session owner can bring it to the planning chat. Don't silently resolve it and don't silently skip it.
   Routine Jira/Confluence sync happens directly from Claude Code (MCP is connected) — no relay through chat needed for (c) or (d). Chat is for (f).
   **Before ending, self-report against this list explicitly** — a one-line checklist in the session summary ("a✓ b✓ c✓ d n/a e n/a f: none") — don't just assume it happened.
5. PR: squash merge, references Jira key, states which acceptance criteria are met.

## Engineering Hard Laws
- **Hard Law #5:** every hook/adapter/auto-run mechanism is fail-open, idempotent, non-interactive. sitrep must NEVER block a developer's workflow. Conflict with a requirement → stop and flag, don't violate.
- **Cost labeling:** no cost number exists without an `actual`/`estimate` label at the data-model level.
- **No lock-in:** core CLI is platform-agnostic; platform hooks are optional layers, never core dependencies.
- **Don't rebuild solved layers:** token metering integrates with ccusage (configurable at onboarding, default on if detected).

## Coding Standards
- Zero external dependencies — Node.js builtins only (fs, path, readline) once the CLI exists.
- Every command is a single .md file. No build step.
- Templates use `[placeholder]` brackets. Generated writes check existence first — never overwrite user data.
- Dashboard: single self-contained HTML, under 80KB, no CDN, inline SVG/CSS charts only.
- Token cost impact matters — every feature justifies its token overhead. Audience: vibe coders, not enterprise DevOps.

## Git Workflow
- Commits: `feat:`, `fix:`, `docs:`, `sitrep:` prefixes.
- Releases tagged per Fix Version (`v0.3.0`…), published as GitHub Releases.
- Old command names never used: /doctor → /selfheal, /task-add → /capture. Manifest file is MANIFEST.md.
