# sitrep

**AI-native project management. Two markdown files. Five slash commands. Zero dependencies.**

> You don't need Jira to build with AI. You need a system that your AI assistant can read, update, and commit — automatically.

---

## The Problem

AI coding tools start every session with a blank slate. No memory of yesterday. No idea what decisions were made. No clue what's been tested.

You lose the first 20 minutes of every session rebuilding context. Decisions get re-debated. Progress is invisible. The code gets built but the project drifts.

## The Fix

**sitrep** is a drop-in project tracking system that lives in your repo. Your AI assistant reads it at the start of every session and updates it at the end. Git tracks the history. You stay in control.

```
your-project/
├── sitrep/
│   ├── PROJECT_PLAN.md     ← what to build
│   └── STATUS_REPORT.md    ← where you are
└── .claude/
    └── commands/
        ├── session-start.md
        ├── session-end.md
        ├── sitrep.md
        ├── plan-update.md
        └── doctor.md
```

## How It Works

**Start of session** — type `/session-start`
```
=== MyProject SESSION START ===
Last session: 4 — built auth system
Current phase: Phase 3 — 2/6 tasks done
Overall: 18/44 — 41%
Blockers: None
Queued: task 3.3 (role-based access), 3.4 (token refresh)
=======================================
```

**End of session** — type `/session-end`

It automatically:
- Updates every task status (✅ 🟡 🔲 ❌)
- Recalculates progress bars
- Adds a session log entry
- Syncs the project plan with any new features or decisions
- Git commits everything

**Quick check anytime** — type `/sitrep`
```
=== MyProject SITREP ===
Phase: Frontend Foundation — 5/8 tasks done
Overall: 14/44 — 32%
Active: 2.6 Dashboard page 🟡
Blockers: None
========================
```

**Scope changes** — type `/plan-update`

New feature idea? Architecture decision? Risk discovered? It logs to the right place in your project plan.

**Health check** — type `/doctor`
```
=== MyProject DOCTOR ===
File Structure:     ✅ All files in place
File Integrity:     ✅ Clean
Cross-File Sync:    ⚠️ 1 mismatch (auto-fixed)
Progress Accuracy:  ✅ Correct
Codebase Sync:      ⏭️ Skipped (run /doctor deep)
Overall: ✅ Healthy
========================
```

## Quick Start

### 1. Copy the commands

```bash
# In your project root
mkdir -p .claude/commands

# Download all commands
curl -sL https://raw.githubusercontent.com/getsitrep/sitrep/main/commands/session-start.md -o .claude/commands/session-start.md
curl -sL https://raw.githubusercontent.com/getsitrep/sitrep/main/commands/session-end.md -o .claude/commands/session-end.md
curl -sL https://raw.githubusercontent.com/getsitrep/sitrep/main/commands/sitrep.md -o .claude/commands/sitrep.md
curl -sL https://raw.githubusercontent.com/getsitrep/sitrep/main/commands/plan-update.md -o .claude/commands/plan-update.md
curl -sL https://raw.githubusercontent.com/getsitrep/sitrep/main/commands/doctor.md -o .claude/commands/doctor.md
```

### 2. Create your sitrep folder

```bash
mkdir -p sitrep
```

### 3. Create PROJECT_PLAN.md

```markdown
# My Project — Master Project Plan

> **Project:** My Project
> **Owner:** Your Name
> **Started:** 2026-03-12
> **Last Updated:** 2026-03-12

---

## Phase 1: Foundation

| # | Feature | Description |
|---|---------|-------------|
| 1.1 | Project setup | Scaffold, config, base structure |
| 1.2 | Core feature | The main thing it does |
| 1.3 | Tests | Verify it works |

---

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|

## Future / Post-MVP Ideas

| # | Idea | Priority | Target |
|---|------|----------|--------|
```

### 4. Create STATUS_REPORT.md

```markdown
# My Project — Status Report

> **Last Updated:** 2026-03-12 — Session 1
> **Current Phase:** Phase 1 (Foundation)
> **Overall Progress:** 0/3 tasks (0%)
> **Next Milestone:** v0.1.0

---

## Active Sprint

**Phase 1: Foundation**

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Project setup | 🔲 Todo | |
| 1.2 | Core feature | 🔲 Todo | |
| 1.3 | Tests | 🔲 Todo | |

---

## Progress Dashboard

| Phase | Name | Tasks | Done | Bar |
|-------|------|-------|------|-----|
| 1 | Foundation | 3 | 0 | ░░░░░░░░░░ 0% |
| **TOTAL** | | **3** | **0** | **0%** |

---

## Session Log

### Session 1 — 2026-03-12
- **Focus:** Project setup
- **Done:** Initialized sitrep tracking
- **Blockers:** None
- **Next:** Start building

---

## Blockers & Risks

| # | Issue | Status | Impact | Resolution |
|---|-------|--------|--------|------------|
| — | None | — | — | — |

## Changes & Scope Updates

| Date | Change | Reason |
|------|--------|--------|
```

### 5. Start building

```bash
# Open Claude Code and type:
/session-start
```

That's it. You're tracking.

---

## Commands Reference

| Command | When | Modifies files? |
|---------|------|-----------------|
| `/session-start` | Start of every session | No (read-only) |
| `/session-end` | End of every session | Yes + git commit |
| `/sitrep` | Quick check anytime | No (read-only) |
| `/plan-update` | Scope/feature changes | Yes + git commit |
| `/doctor` | When things feel off | Yes (auto-fixes) + git commit |
| `/doctor deep` | Periodic audit | Yes + scans codebase |

## Status Codes

| Code | Meaning |
|------|---------|
| ✅ | Done — completed and verified |
| 🟡 | In Progress — started, not finished |
| 🔲 | Todo — not started |
| ❌ | Blocked — cannot proceed |
| ⏭️ | Deferred — pushed to future |

---

## Why Not Jira / Notion / Linear?

Those tools aren't designed for AI-assisted development. They live outside your repo. Your AI assistant can't read them, can't update them, and can't commit changes to them.

sitrep lives where your code lives. It's plain markdown that any AI tool can read and write. Git gives you versioning, history, and diffs for free. No SaaS. No sync. No subscription.

---

## Principles

1. **Two files, two purposes.** Plan = what to build. Status = where you are.
2. **Git is the database.** Full history via `git log sitrep/`.
3. **Never delete tasks.** Mark ⏭️ Deferred and move to Future table.
4. **Commands validate first.** Every command checks files exist before acting.
5. **Project-agnostic.** Works for any repo, any stack, any AI tool.

---

## Compatibility

Built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) slash commands. The markdown format works with any AI tool that can read and write files.

---

## Roadmap

- [x] Slash commands (session-start, session-end, sitrep, plan-update, doctor)
- [x] Self-healing file validation
- [x] Cross-file sync checks
- [x] Codebase audit (`/doctor deep`)
- [ ] `npx getsitrep init` — one-command setup
- [ ] GitHub Actions integration — auto-update on PR merge
- [ ] Web dashboard — visual progress from sitrep/ files
- [ ] Multi-project support — monorepo tracking
- [ ] Plugin system — custom commands and checks

---

## Built In Public

sitrep was born while building [Atlas](https://github.com/getsitrep/atlas) — an AI Workforce Platform — using only AI tools. Read the story:

📝 [I Replaced My Entire Dev Team With 3 AI Tools. Here's What Broke First.](https://www.linkedin.com/pulse/i-replaced-my-entire-dev-team-build-ai-product-3-tools-rohit-purohit-vlstc)

---

## License

MIT

---

**Star this repo if sitrep helps you ship faster.** ⭐
