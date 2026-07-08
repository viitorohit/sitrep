# CLAUDE.md — sitrep Project

## Project Overview
sitrep is an open-source AI-native project operations framework — the operations, cost, and continuity layer for AI-assisted development. It lives inside developer repos as markdown files that AI coding assistants read and update. It sits BESIDE planning tools (Jira, OpenSpec, Spec Kit), it does not replace them.

**GitHub:** github.com/viitorohit/sitrep · **Domain:** getsitrep.dev · **License:** MIT
**Shipped:** v0.2.0 (tag on origin/main) · **In development:** v0.3.0 "Sharper & Self-Sufficient"

## Sources of Truth — Priority Order
1. **Jira project GETSITREP** — canonical for scope, status, build order. Atlassian MCP is connected — fetch live rather than asking the session owner to paste.
2. **This repo, `docs/specs/`** — canonical for technical specs (command canon, adapter contract, cost schema), as they're authored. **Confluence is a mirror of this, not the source** (flipped 2026-07-03 — see ADR index below; specs not yet migrated are still Confluence-only until their owning Story authors the `docs/specs/` version as part of its acceptance criteria).
3. **`docs/adr/`** — canonical for *why* a decision was made. Immutable once Accepted; only ever superseded, never edited. Read the relevant ADR instead of asking "why" — don't re-litigate a decision that already has one.
4. **This file** — durable operating rules only (governance, hard laws, pointers). No decision rationale lives here anymore — that's what ADRs are for. No file-tree snapshot either (previous versions drifted twice) — audit the actual tree yourself at session start (`ls`, `git status`).
5. **`sitrep/` dogfood files** — currently STALE (last session 2026-04-06, pre-Jira roadmap). Do not orient from them until the reconciliation task below is done.

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

New architecturally-significant decision this session? Propose an ADR (use `docs/adr/template.md`), don't just narrate it in chat or bury it in a commit message.

## Verified Repo Facts (audited 2026-07-03 — re-verify, don't assume)
- 9 command MDs exist; `dashboard.md` sits at repo ROOT (misplaced; moves to commands/ under GETSITREP-13).
- **No `package.json`, no `index.js` exist.** README/MANIFEST claims of `npx getsitrep init` do not match this repo — the working install path is `install.sh`. GETSITREP-8 builds the CLI greenfield. Do not "fix" the README preemptively; that claim is handled under GETSITREP-8/32.
- `.gitignore` exists locally but is UNTRACKED — nothing has actually been ignored yet. `marketing/` is tracked and public. Resolution → ADR-0003.
- `package.json`/`index.js` do not exist in this repo — the npm-published CLI has no in-repo source. Resolution → ADR-0004.
- Local main = origin/main + 1 unpushed commit; untracked: .gitignore, CLAUDE.md, PROJECT_PLAN.md, .claude/, .DS_Store files.

## SESSION 1 OPENING TASKS (do these before any feature code)
1. **Git hygiene** (confirm each step with the session owner before executing):
   - `git rm -r --cached marketing/` (untrack, keep local files, history stays intact)
   - Ensure `.gitignore` contains `marketing/`, `.DS_Store`, `sitrep/.sitrep-active-session`
   - `git add .gitignore CLAUDE.md .claude/` and commit (`chore: untrack marketing/, add CLAUDE.md v0.3`)
   - `git push origin main` — this pushes both the untrack commit and the previously-unpushed session-4 commit
2. **Dogfood reconciliation:** rewrite `sitrep/PROJECT_PLAN.md` phases to mirror the Jira v0.3–v0.5 structure (the session owner pastes the tier/story list). Log this as a session in `sitrep/STATUS_REPORT.md`. The repo must track itself truthfully before it tracks new work.

## v0.3 Scope — Tier Build Order (mirror of Jira, dated 2026-07-03)
- **Tier 0 (parallel, current):** GETSITREP-4 (cost schema: every figure labeled actual/estimate), GETSITREP-13 (command MD refresh; merge /pulse into /sitrep, drop /doctor-redundancy, relocate dashboard.md → 9 commands become 8), GETSITREP-36 (adapter contract: plan/cost/auto-run, all optional).
- **Tier 1:** GETSITREP-8 (CLI extraction — greenfield), GETSITREP-28 (selfheal drift). Need Tier 0 merged.
- **Tier 2:** GETSITREP-17 (onboarding wizard), GETSITREP-21 (auto-run adapters: Claude Code, Codex, Cursor committed; Copilot conditional), GETSITREP-25 (plan-presence guard). Need GETSITREP-8.
- **Tier 3:** GETSITREP-32 (housekeeping, pre-launch gate — includes README npx-claim fix and repo description fix, currently "Five slash commands").
- **Command canon stays 9 until GETSITREP-13 merges.** Never update command counts/lists ahead of the ticket that owns them.

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
