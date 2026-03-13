# sitrep v0.2.0 — Framework Reference

> This file is the single source of truth for how sitrep works in this project.
> AI assistants: read this file first when interacting with sitrep.

---

## What is sitrep?

sitrep is an AI-native project management framework. It tracks project progress, decisions, session history, token costs, and team activity using plain markdown files that AI assistants can read and update automatically.

**Install:** `npx getsitrep init`
**Docs:** https://getsitrep.dev
**Repo:** https://github.com/viitorohit/sitrep

---

## Version

**Current:** v0.2.0

| Version | Changes |
|---------|---------|
| v0.1.0 | Initial release: 5 commands, 2 templates, npm package |
| v0.2.0 | 9 commands: +capture, +selfheal, +handoff, +dashboard, +pulse. Added MANIFEST.md, history/, cost tracking, user tracking, session awareness. |

---

## Folder Structure

```
sitrep/
├── MANIFEST.md                ← THIS FILE. Framework reference and version.
├── PROJECT_PLAN.md            ← What to build. Roadmap, phases, decisions, risks.
├── STATUS_REPORT.md           ← Where we are. Tasks, progress, session log.
├── .sitrep-data.json          ← Machine-readable session + cost + user data.
├── .sitrep-active-session     ← Ephemeral session tracker (gitignored).
├── HANDOFF.md                 ← Latest handoff context (regenerated on /handoff).
├── dashboard.html             ← Open in browser. The Intelligent MIS.
└── history/                   ← All historical records. Never deleted.
    ├── sessions/              ← Per-session detail logs.
    ├── handoffs/              ← Archived handoff snapshots.
    └── dashboards/            ← Archived dashboard snapshots.
```

### File Purposes

| File | Updated by | Purpose |
|------|-----------|---------|
| `MANIFEST.md` | Manual / version bumps | Framework instructions. AI reads this first. |
| `PROJECT_PLAN.md` | `/session-end`, `/plan-update`, `/capture` | Master roadmap. Phases, features, decisions, risks, future ideas. |
| `STATUS_REPORT.md` | `/session-end`, `/capture` | Live progress. Task statuses, progress bars, session log, blockers. |
| `.sitrep-data.json` | `/session-end` (auto) | Machine-readable data store. Costs, tokens, users, sessions. |
| `.sitrep-active-session` | All commands (auto) | Tracks which commands ran this session. Gitignored. |
| `HANDOFF.md` | `/handoff` | Context package for another person or AI session. |
| `dashboard.html` | `/dashboard` | Visual MIS report. Open in browser. |
| `history/sessions/` | `/session-end` (auto) | Detailed per-session records. |
| `history/handoffs/` | `/handoff` (auto-archive) | Previous handoff snapshots. |
| `history/dashboards/` | `/dashboard` (auto-archive) | Previous dashboard snapshots. |

---

## Commands

All commands live in `.claude/commands/` and are available as slash commands in Claude Code.

| Command | Arguments | Modifies files? | Purpose |
|---------|-----------|-----------------|---------|
| `/session-start` | none | No (creates session tracker) | Read status, print orientation with cost summary |
| `/session-end` | none | Yes + commit | Update tasks, progress, costs, tokens, session log |
| `/sitrep` | none | No | Quick read-only status check |
| `/capture` | `[description] --phase N` or `--future` | Yes + commit | Capture a task to plan + status in one step |
| `/plan-update` | none | Yes + commit | Add features, decisions, risks to plan |
| `/selfheal` | optional: `deep` | Yes + commit | Health check, sync validation, auto-fix |
| `/handoff` | optional: `human` or `ai` | Yes + commit | Generate context package, archive previous |
| `/dashboard` | none | Yes + commit | Generate visual MIS dashboard |
| `/pulse` | none | No | Show which commands ran this session, suggest next |

---

## Session Awareness

Commands track their execution in `sitrep/.sitrep-active-session` (gitignored).

- `/session-start` creates/resets the tracker
- Every command appends its name + timestamp
- `/session-end` deletes the tracker (session is over)
- `/pulse` reads the tracker and shows session status
- Commands warn if `/session-start` hasn't been run

---

## Status Codes

| Code | Meaning | When to use |
|------|---------|-------------|
| ✅ | Done | Task completed AND verified working |
| 🟡 | In Progress | Started but not finished. Carries to next session. |
| 🔲 | Todo | Not started |
| ❌ | Blocked | Cannot proceed. Must note the blocker. |
| ⏭️ | Deferred | Pushed to future. Moved to Future table. Never deleted. |

---

## Progress Bars

```
  0%  ░░░░░░░░░░     50%  █████░░░░░     100%  ██████████
```

---

## Token & Cost Tracking

At session end, the AI assistant logs:
- Tokens used (input + output estimate)
- Cost in USD based on model pricing
- Model name
- Session duration

**Cost estimation reference:**
| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude Sonnet 4 | $3 | $15 |
| Claude Opus 4 | $15 | $75 |
| Claude Haiku 4.5 | $0.80 | $4 |

---

## Rules

1. **Two core files, two purposes.** PROJECT_PLAN.md = what to build. STATUS_REPORT.md = where we are.
2. **Never delete tasks.** Mark ⏭️ Deferred and move to Future table.
3. **Commands validate first.** Every command checks files exist in `sitrep/` before acting.
4. **Git is the database.** Full history via `git log sitrep/`. Every command commits after changes.
5. **Session log is reverse chronological.** Newest entry at the top.
6. **Task IDs are phase-scoped.** Phase 3, task 4 = `3.4`. Subtasks = `3.4a`, `3.4b`.
7. **HANDOFF.md is always the latest.** Previous versions archived to `history/handoffs/`.
8. **Every session logs cost.** Token counts and cost estimates go into `.sitrep-data.json`.
9. **History is never deleted.** Session records, handoffs, dashboard snapshots all accumulate.
10. **This file (MANIFEST.md) is the instruction set.** AI assistants read this first.

---

## For AI Assistants

When starting work on this project:
1. Read `sitrep/MANIFEST.md` (this file) — understand the framework
2. Read `sitrep/STATUS_REPORT.md` — know where things stand
3. Read `sitrep/PROJECT_PLAN.md` — know what's being built
4. Read `sitrep/.sitrep-data.json` (if exists) — know costs and history
5. Follow the commands and rules above
6. When in doubt, run `/selfheal` to check health

---

## .gitignore

Add to your project's `.gitignore`:
```
sitrep/.sitrep-active-session
```
