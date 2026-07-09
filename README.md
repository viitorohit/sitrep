# SitRep

> **v0.3.1** · Last updated 2026-07-09 — see [Roadmap](#roadmap) for what's shipped vs. in progress.

**The continuity, cost, and nudge layer for agentic AI coding — works with Claude Code, Codex, Cursor, or any tool that reads a repo. Zero dependencies, zero lock-in.**

> It sits *beside* Jira, OpenSpec, or Spec Kit, and reads whatever plan you already keep — never a replacement, never another system to maintain in parallel.

---

## The Problem

This isn't a claim that AI coding tools have no memory at all — several now offer session resumption, custom-instruction files, or their own context tricks. What none of them do is track *project* state: what phase you're actually in, what a feature cost across the models that built it, or carry any of that cleanly if you switch from Claude Code to Codex to Cursor on the same repo. Multiple agentic tools now routinely touch the same codebase over its life — and there's no shared layer underneath them that remembers where things stand, independent of which one is driving this week.

## The Fix

**sitrep** lives inside your repo as plain markdown, a small JSON file, and a zero-dependency CLI. Whichever AI tool opens the repo reads exactly where the project stands at session start, and writes back automatically at session end — cost, progress, and decisions included. Git is the database; nothing else to run, no account to create.

```bash
npx getsitrep init
```

One command. The wizard asks which tool(s) you use and wires up the rest — that's the entire setup, frictionless by design.

---

## What You Get

```
sitrep/
├── MANIFEST.md              ← framework version and rules
├── PROJECT_PLAN.md          ← what to build (phases, decisions, risks)
├── STATUS_REPORT.md         ← where you are (tasks, progress, sessions)
├── .sitrep-data.json        ← cost + token + user tracking data
├── HANDOFF.md               ← context package (auto-generated)
├── dashboard.html           ← visual MIS report (auto-generated)
└── history/
    ├── sessions/            ← per-session detail logs
    ├── handoffs/            ← archived handoff snapshots
    └── dashboards/          ← archived dashboard snapshots
```

---

## Daily Workflow

```
session-start  →  know where you left off
      ↓
   you build
      ↓
session-end    →  progress, costs, tokens, decisions — logged and committed
```

Two commands minimum. Everything else is optional but compounds in value. On Claude Code this is `/session-start` and `/session-end` typed in chat; on Cursor, Codex, or a bare terminal it's `getsitrep session-start`/`getsitrep session-end`; with hooks configured (Claude Code, Cursor, Codex all support this) it fires automatically and you don't type anything either way.

---

## Commands

| Command | When | What it does |
|---------|------|--------------|
| `/session-start` | Start of session | Reads status, prints orientation with cost summary |
| `/session-end` | End of session | Updates tasks, progress, costs, tokens, session log. Commits. |
| `/sitrep` | Anytime | Quick read-only status check |
| `/capture` | New work surfaces | `/capture fix auth bug --phase 3` → adds to both files |
| `/plan-update` | Scope changes | Add features, decisions, risks to the plan |
| `/selfheal` | Things feel off | Health check + auto-fix. `/selfheal deep` for codebase audit. |
| `/handoff` | Switching context | Context package. `/handoff human` or `/handoff ai` |
| `/dashboard` | Visual report | Generates full MIS dashboard as HTML |

---

## CLI (v0.3.1, published)

Alongside the slash-command files above, sitrep now also ships a real,
dependency-free Node.js CLI (GETSITREP-8) that implements the same 8 commands
as callable functions — usable from a bare terminal, a CI job, or any AI
coding tool that can run a shell command, not just Claude Code.

**Published on npm (v0.3.0 initial publish, v0.3.1 current):**

```bash
npx getsitrep init
```

Or install it globally:

```bash
npm install -g getsitrep
getsitrep init
```

Working from a clone instead (e.g. contributing)?

```bash
git clone https://github.com/viitorohit/sitrep.git
cd sitrep
npm link          # links your clone's code to the global `getsitrep` command
getsitrep init
```

`init` (GETSITREP-17) is the recommended first command on a new project — a one-time wizard that configures your plan source (native/Jira/OpenSpec/Spec Kit) and cost source, writes `sitrep.config.json`, bootstraps `sitrep/` from templates, and copies the 8 command MDs into `.claude/commands/`. It's not one of the 8 canon slash commands (it only runs once, like the old `install.sh`) and it detects prior sitrep state before touching anything — safe to re-run.

Every command also accepts `--help`/`-h` for its own usage, without running (safe to explore, including for an AI agent probing the CLI's surface — see `docs/adr/` for why this matters).

For whichever AI tool(s) you select, `init` also wires up automatic session tracking (GETSITREP-21): SessionStart/SessionEnd hooks for Claude Code and Cursor, a SessionStart + `Stop`-bound hook for Codex (it has no native SessionEnd), and a factual (never imperative) `AGENTS.md` block as a portable fallback for any tool. It merges into existing hook config files rather than overwriting them — a pre-existing `.claude/settings.json` with your own permissions/hooks stays intact. Copilot/VS Code is not yet covered: the reuse-path this depends on (VS Code parsing `.claude/settings.json` natively) hasn't been verified against a live install (GETSITREP-38).

| Command | Usage | What it does |
|---|---|---|
| `init` | `getsitrep init [--yes] [--plan ...] [--cost ...] [--tools ...]` | One-time onboarding wizard — not a slash command |
| `session-start` | `getsitrep session-start` | Orientation banner — phase, progress, cost, blockers |
| `session-end` | `getsitrep session-end --data '<json>'` | Logs the session, updates cost/token totals, commits |
| `sitrep` | `getsitrep sitrep` | Quick read-only status check |
| `capture` | `getsitrep capture "<description>" --phase N` | Adds a task to a phase (or `--future` for the backlog) |
| `plan-update` | `getsitrep plan-update --data '<json>'` | Records a decision or risk in PROJECT_PLAN.md. If no plan exists yet, `--generate [--brief "..."]` creates a draft from repo introspection (GETSITREP-25) |
| `selfheal` | `getsitrep selfheal` | File-structure/integrity health check, auto-fixes what it safely can |
| `handoff` | `getsitrep handoff [human\|ai]` | Generates a context handoff document |
| `dashboard` | `getsitrep dashboard` | Regenerates the self-contained HTML dashboard |
| `report` | `getsitrep report [--phase N \| --ticket ID \| --model NAME]` | Cost-to-outcome summary — cost by phase, by ticket, and by model, from the already-persisted rollup |
| `plan` | `getsitrep plan [--phase N]` | Read-only view of the plan — overview or one phase's full content, works against any configured plan source |
| `progress` | `getsitrep progress` | Quick, source-agnostic progress readout with a visual bar |

`session-end` and `plan-update` take structured JSON (via `--data` or piped
stdin) rather than free-form prose — see
[docs/specs/adapter-contract.md](docs/specs/adapter-contract.md) for the
exact schema and how an AI assistant is expected to produce it.

Every command returns the same result whether it's invoked from a terminal
or in-process by a platform adapter — see
[docs/specs/command-canon.md](docs/specs/command-canon.md).

---

## v0.4 (in progress) — Cost-to-Outcome & Beside

The category-defining release: sitrep reads whatever planning tool you already
use and overlays cost + continuity on top of it, instead of replacing it.

- **Cost-to-outcome pipeline** — every session's cost/tokens are attributed to
  the plan phase and ticket they went toward, and to the model that did the
  work (`report`, `report --phase N`, `report --ticket ID`, `report --model
  NAME`). Every figure keeps its `actual`/`estimate` label, or `mixed` if a
  phase/ticket/model drew from sessions with different labels — never blurred.
- **Native + file-based plan adapter** — `plan`/`progress`/`report` work
  identically whether your plan lives in `PROJECT_PLAN.md`, an OpenSpec
  `changes/` folder, or a Spec Kit `specs/` folder.
- **Tool-neutral external integration** — a plan tracked in Jira (or any
  future external tool) works through one generic, agent-mediated mechanism:
  sitrep never authenticates to or stores credentials for anything external
  (see [ADR-0006](docs/adr/0006-tool-neutral-agent-mediated-integration.md)).
- **Intelligent nudges** — see below.

Still in progress for v0.4: a scoped plan-vs-reality conflict check and a
cost-optimization advisory. Follow along in
[`sitrep/PROJECT_PLAN.md`](sitrep/PROJECT_PLAN.md) (Phase 4), which this repo
keeps genuinely current on itself, dogfood-style.

---

## Intelligent Nudges

sitrep watches for a handful of *real, observable* signals — not guesses — and surfaces at most one suggestion at a time, never repeating one you've already seen. No config, no dashboard to babysit. Bound to your tool's mid-session hook (`PostToolUse` on Claude Code/Codex, `afterFileEdit` on Cursor) via the same `getsitrep init` wizard that sets up everything else.

Actual messages this produces, verbatim from the code:

```
💡 sitrep: consider `/selfheal` — 3 command file(s) have drifted from the canonical version
💡 sitrep: consider `/dashboard` — 5 sessions logged since the last dashboard view
💡 sitrep: consider `/capture` — uncommitted changes present for a while — worth capturing as a tracked task if this is new scope
💡 sitrep: consider `/handoff` — this has been a long session — consider a handoff checkpoint
```

Each is tied to something sitrep can actually verify: `selfheal`'s own drift detection, a real count of sessions since the dashboard was last regenerated, `git status` showing uncommitted work, or a tick count standing in for session length (no tool currently exposes true elapsed time to a hook). Two triggers from the original design are deliberately *not* implemented rather than faked — a plan-vs-reality divergence check (needs the scoped conflict checker, still in progress) and context-hygiene nudges (no cross-tool telemetry exists yet to base them on honestly).

---

## The Dashboard

`/dashboard` generates a self-contained HTML report you open in any browser:

- **Summary** — progress, total cost, sessions, blockers at a glance
- **Progress** — visual bars per phase with cost attribution
- **Sprint** — active tasks with status badges
- **Sessions** — timeline of who did what, when, at what cost
- **Costs** — token usage over time, cost by phase, cost by model
- **Users** — team activity and contribution tracking
- **Decisions** — architecture decision log
- **Risks** — blockers and risk register
- **Documents** — full plan and status rendered inline
- **History** — archived handoffs, dashboards, git log

Dark mode. Print-friendly. Mobile-responsive. No server needed.

---

## Cost Tracking

Every `/session-end` logs:
- Tokens used (input + output)
- Cost in USD (based on model pricing)
- Model used (Claude Sonnet, Opus, GPT-4, etc.)
- Session duration
- Who did the session

Know exactly what each feature costs before your budget surprises you.

---

## Quick Start

```bash
cd your-project
npx getsitrep init
```

Customize `sitrep/PROJECT_PLAN.md` with your phases. Then, in whichever tool you configured:

```
/session-start           (Claude Code)
getsitrep session-start  (Cursor, Codex, bare terminal, CI)
```

Or nothing at all, if you set up hooks during `init` — it fires on its own.

You're tracking.

---

## Use Cases

_Shown as slash commands (Claude Code shorthand) — swap `/foo` for `getsitrep foo` on Cursor, Codex, or a bare terminal, same result._

| Situation | What to do |
|-----------|-----------|
| Starting a new project | `npx getsitrep init` → customize plan → `/session-start` |
| Resuming after a break | `/session-start` — zero context rebuilding |
| New task mid-session | `/capture [description] --phase N` |
| Handing off to a person | `/handoff human` — 5-minute onboarding doc |
| Switching AI sessions | `/handoff ai` — structured context for next session |
| Checking costs | `/dashboard` — visual cost breakdown |
| Something feels wrong | `/selfheal` or `/selfheal deep` |
| Stakeholder update | `/dashboard` → open HTML → Cmd+P to print |
| End of day | `/session-end` — always, no exceptions |
| Forgot what I ran | `/sitrep` — quick read-only status check |

Full usage guide: [docs/USAGE_GUIDE.md](docs/USAGE_GUIDE.md)

---

## What's New in v0.2

- `/capture` — structured task creation mid-session
- `/selfheal` — health check + auto-fix with deep codebase audit
- `/handoff` — context packages with auto-archiving
- `/dashboard` — visual MIS with 10 sections
- `/pulse` — session awareness, shows what ran and suggests next
- `MANIFEST.md` — self-documenting framework reference
- `.sitrep-data.json` — machine-readable cost and session data
- `history/` — structured archives (sessions, handoffs, dashboards)
- Cost tracking — per-session token and cost logging
- User tracking — who did what, when

---

## Roadmap

- [x] Core commands (session-start, session-end, sitrep, plan-update)
- [x] npm package (`npx getsitrep init`)
- [x] Task capture (`/capture`)
- [x] Context handoffs (`/handoff`)
- [x] Visual MIS dashboard (`/dashboard`)
- [x] Cost and token tracking
- [x] User tracking
- [x] Session history archives
- [x] Session awareness (`/pulse`)
- [x] Self-healing (`/selfheal`)
- [x] Platform-agnostic CLI (`getsitrep`, not locked to Claude Code)
- [x] Cost-to-outcome pipeline (cost by phase, ticket, and model)
- [x] Native + OpenSpec + Spec Kit plan adapters
- [x] Tool-neutral external integration (e.g. Jira), zero credentials stored
- [ ] Scoped plan-vs-reality conflict check
- [ ] Cost optimization advisory
- [ ] Business-user brief generator
- [ ] `getsitrep.dev` landing page
- [ ] HTML intake form for project onboarding
- [ ] GitHub Actions integration
- [ ] Multi-project unified view

---

## Built In Public

sitrep was born while building an AI product using only AI tools. Read the story:

📝 [I Replaced My Entire Dev Team With 3 AI Tools. Here's What Broke First.](https://www.linkedin.com/pulse/i-replaced-my-entire-dev-team-build-ai-product-3-tools-rohit-purohit-vlstc)

---

## Compatibility

sitrep is not built for one tool — the CLI (`getsitrep`) is the actual implementation, and every integration on top of it is an optional adapter:

| Tool | Slash commands | Auto session tracking (hooks) |
|---|---|---|
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | Yes — `init` copies the 8 command MDs into `.claude/commands/` | Yes — SessionStart + SessionEnd |
| [Cursor](https://cursor.com) | Not yet — use `getsitrep <command>` directly | Yes — SessionStart + SessionEnd |
| [Codex CLI](https://github.com/openai/codex) | Not yet — use `getsitrep <command>` directly | Yes — SessionStart + `Stop` (Codex has no native SessionEnd event) |
| Anything else that reads a repo | Not yet | No hooks, but a factual (never imperative) `AGENTS.md` block tells the agent what's configured — see [ADR](docs/adr/) for why it's factual-only |

Copilot/VS Code isn't covered yet — the reuse path it would need hasn't been verified against a live install (tracked as GETSITREP-38).

Choose your tool(s) during `getsitrep init`; nothing here requires picking just one, and the underlying markdown files are always readable/writable by anything with filesystem access, hooks or not.

## Contributing

Zero-dependency core, no build step, `npm test` before any PR — see [CONTRIBUTING.md](CONTRIBUTING.md) for the full workflow and what a good PR looks like.

## License

MIT

---

**Star this repo if sitrep helps you ship faster.** ⭐
