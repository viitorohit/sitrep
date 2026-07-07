# SitRep

**AI-native project management. Two markdown files. Nine slash commands. Zero dependencies.**

> You don't need Jira to build with AI. You need a system that your AI assistant can read, update, and commit — automatically.

---

## The Problem

AI coding tools start every session blank. No memory. No context. No idea what happened yesterday. You waste 15-20 minutes every session rebuilding context. Nobody knows what it cost.

## The Fix

**sitrep** lives inside your repo. Your AI reads it at session start, updates it at session end. Git tracks everything. A visual dashboard gives you the MIS view. Costs are logged per session.

```bash
npx getsitrep init
```

That's the entire setup.

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
/session-start  →  know where you left off
      ↓
   you build
      ↓
/session-end    →  progress, costs, tokens, decisions — logged and committed
```

Two commands minimum. Everything else is optional but compounds in value.

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
| `/pulse` | Mid-session | Shows which commands ran, suggests what to do next |

---

## CLI (v0.3, in development)

Alongside the slash-command files above, sitrep now also ships a real,
dependency-free Node.js CLI (GETSITREP-8) that implements the same 8 commands
as callable functions — usable from a bare terminal, a CI job, or any AI
coding tool that can run a shell command, not just Claude Code.

**Not yet published to npm** — run it from a clone of this repo:

```bash
git clone https://github.com/viitorohit/sitrep.git
cd sitrep
node bin/getsitrep.js session-start
```

Or link it as a global `getsitrep` command:

```bash
npm link
getsitrep init
```

`init` (GETSITREP-17) is the recommended first command on a new project — a one-time wizard that configures your plan source (native/Jira/OpenSpec/Spec Kit) and cost source, writes `sitrep.config.json`, bootstraps `sitrep/` from templates, and copies the 8 command MDs into `.claude/commands/`. It's not one of the 8 canon slash commands (it only runs once, like the old `install.sh`) and it detects prior sitrep state before touching anything — safe to re-run.

| Command | Usage | What it does |
|---|---|---|
| `init` | `getsitrep init [--yes] [--plan ...] [--cost ...] [--tools ...]` | One-time onboarding wizard — not a slash command |
| `session-start` | `getsitrep session-start` | Orientation banner — phase, progress, cost, blockers |
| `session-end` | `getsitrep session-end --data '<json>'` | Logs the session, updates cost/token totals, commits |
| `sitrep` | `getsitrep sitrep` | Quick read-only status check |
| `capture` | `getsitrep capture "<description>" --phase N` | Adds a task to a phase (or `--future` for the backlog) |
| `plan-update` | `getsitrep plan-update --data '<json>'` | Records a decision or risk in PROJECT_PLAN.md |
| `selfheal` | `getsitrep selfheal` | File-structure/integrity health check, auto-fixes what it safely can |
| `handoff` | `getsitrep handoff [human\|ai]` | Generates a context handoff document |
| `dashboard` | `getsitrep dashboard` | Regenerates the self-contained HTML dashboard |

`session-end` and `plan-update` take structured JSON (via `--data` or piped
stdin) rather than free-form prose — see
[docs/specs/adapter-contract.md](docs/specs/adapter-contract.md) for the
exact schema and how an AI assistant is expected to produce it.

Every command returns the same result whether it's invoked from a terminal
or in-process by a platform adapter — see
[docs/specs/command-canon.md](docs/specs/command-canon.md).

---

## The Dashboard

`/dashboard` generates a self-contained HTML report you open in any browser:

- **Summary** — progress, total cost, sessions, blockers at a glance
- **Progress** — visual bars per phase with cost attribution
- **Sprint** — active tasks with status badges
- **Sessions** — timeline of who did what, when, at what cost
- **Costs** — token usage over time, cost by phase, projections
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

Customize `sitrep/PROJECT_PLAN.md` with your phases. Open Claude Code:

```
/session-start
```

You're tracking.

---

## Use Cases

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
| Forgot what I ran | `/pulse` — see session command history |

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

Built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) slash commands. The markdown format works with any AI tool that can read and write files.

## License

MIT

---

**Star this repo if sitrep helps you ship faster.** ⭐
