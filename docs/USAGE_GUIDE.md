# sitrep — Usage Guide

> Official documentation for using sitrep in Claude Code sessions.
> Version: 0.2.0

---

## Table of Contents

- [Getting Started](#getting-started)
- [Daily Workflow](#daily-workflow)
- [Use Cases](#use-cases)
  - [Starting a New Project](#1-starting-a-new-project)
  - [Resuming After a Break](#2-resuming-after-a-break)
  - [Adding Features Mid-Session](#3-adding-features-mid-session)
  - [Handing Off to Another Person](#4-handing-off-to-another-person)
  - [Handing Off to a New AI Session](#5-handing-off-to-a-new-ai-session)
  - [Tracking Costs and Token Usage](#6-tracking-costs-and-token-usage)
  - [Viewing Project Progress Visually](#7-viewing-project-progress-visually)
  - [Debugging When Things Feel Off](#8-debugging-when-things-feel-off)
  - [Deferring Work Without Losing It](#9-deferring-work-without-losing-it)
  - [Recording Architecture Decisions](#10-recording-architecture-decisions)
  - [Working on Multiple Projects](#11-working-on-multiple-projects)
  - [Reviewing What Happened Last Week](#12-reviewing-what-happened-last-week)
  - [Presenting Progress to Stakeholders](#13-presenting-progress-to-stakeholders)
  - [Onboarding a New Team Member](#14-onboarding-a-new-team-member)
  - [Recovering from a Bad Session](#15-recovering-from-a-bad-session)
- [Command Reference](#command-reference)
- [Tips and Best Practices](#tips-and-best-practices)
- [Troubleshooting](#troubleshooting)

---

## Getting Started

### Install sitrep in any project

```bash
cd your-project
npx getsitrep init
```

This creates:
- `sitrep/` folder with PROJECT_PLAN.md and STATUS_REPORT.md
- `.claude/commands/` with all 8 slash commands

### Customize your project plan

Open `sitrep/PROJECT_PLAN.md` and fill in:
- Project name and description
- Your phases and tasks
- Any decisions already made

### Start your first session

Open Claude Code in your project directory:
```bash
cd your-project
claude
```

Type:
```
/session-start
```

You're tracking.

---

## Daily Workflow

Every session follows this pattern:

```
┌─────────────────────────────────────────┐
│  /session-start                         │
│  ↓                                      │
│  See where you left off                 │
│  ↓                                      │
│  Do your work (build, fix, test)        │
│  ↓                                      │
│  /sitrep (optional — quick check)       │
│  ↓                                      │
│  /session-end                           │
│  ↓                                      │
│  Everything logged, committed, tracked  │
└─────────────────────────────────────────┘
```

That's it. Two commands minimum per session. Everything else is optional.

---

## Use Cases

### 1. Starting a New Project

**Situation:** You have a new idea and want to start building with AI assistance. You want structure from day one.

**Steps:**

```bash
mkdir my-new-app && cd my-new-app
git init
npx getsitrep init
```

When prompted, enter your project name and your name. Then open the generated files and customize them:

```
claude
```

Tell Claude:

```
Read sitrep/PROJECT_PLAN.md. I want to build [describe your project].
Help me break this into phases with specific tasks, then update
the project plan with the phases we agree on.
```

Once the plan is set:

```
/session-end
```

Your project now has a structured plan, status tracking, and session history from the very first minute.

---

### 2. Resuming After a Break

**Situation:** You haven't touched the project in 3 days (or 3 weeks). You forgot where you left off.

**Steps:**

```
/session-start
```

sitrep prints exactly where you are:

```
=== MyApp SESSION START ===
sitrep: v0.2.0
Last session: 7 — 2026-03-08 — Rohit — built auth middleware
Current phase: Phase 3 — 4/8 tasks done
Overall: 22/45 — 49%
Total cost to date: $4.20 across 7 sessions
Blockers: None
Queued: 3.5 (token refresh), 3.6 (protected routes)
=====================================
```

Zero context rebuilding. You know exactly what to do. Start working.

---

### 3. Adding Features Mid-Session

**Situation:** While building, you realize you need a task that wasn't in the plan. Maybe a bug surfaced, or you thought of a new feature.

**For a task in the current or specific phase:**

```
/capture fix CORS headers on auth endpoints --phase 3
```

Output:
```
=== TASK ADDED ===
ID: 3.9
Task: fix CORS headers on auth endpoints
Phase: 3 (Auth & Security)
Status: 🔲 Todo
Updated: PROJECT_PLAN.md + STATUS_REPORT.md
==================
```

**For a future idea (not current scope):**

```
/capture add webhook notifications for task completion --future
```

This adds it to the Future / Post-MVP Ideas table. It won't affect your current progress count, but it's captured and will never be forgotten.

---

### 4. Handing Off to Another Person

**Situation:** A collaborator, contractor, or friend is going to work on your project next. They need to understand everything without you explaining it over a call.

**Steps:**

```
/session-end
/handoff human
```

The `human` flag tailors the output for a real person. It generates `sitrep/HANDOFF.md` with:
- What the project is (plain English)
- What's working right now
- What was just done
- What's next (specific task IDs)
- How to set up the project (clone, install, run)
- What to watch out for (gotchas, fragile areas)
- Questions they should ask before starting

Share the file:
```bash
# Option 1: They have repo access
git push

# Option 2: Send the file directly
cat sitrep/HANDOFF.md | pbcopy  # macOS: copies to clipboard
```

The next person reads HANDOFF.md and has full context in 5 minutes.

---

### 5. Handing Off to a New AI Session

**Situation:** You're switching from Claude Code to Claude.ai for strategy work. Or you need to start a fresh Claude Code session (context got too long, switching tasks, etc.).

**Steps:**

```
/session-end
/handoff ai
```

The `ai` flag formats the handoff for another AI session:
- Exact file paths to read first
- Ordered reading list: "start by reading these files in this order"
- Structured context, less narrative

In your new session (Claude.ai or fresh Claude Code):

```
Read sitrep/HANDOFF.md and continue from where the last session left off.
```

Or paste the HANDOFF.md content directly into a Claude.ai conversation.

---

### 6. Tracking Costs and Token Usage

**Situation:** You want to know how much your AI-assisted development is costing. Which phases are expensive? Is your spending trending up or down?

**How it works:** Every `/session-end` automatically:
- Estimates tokens used (input + output)
- Calculates cost based on the model used
- Logs the model name
- Records session duration
- Saves everything to `.sitrep-data.json`

**To see your cost data:**

```
/session-start
```
Shows total cost to date in the orientation banner.

```
/dashboard
```
Generates a visual report with:
- Cost over time (per session)
- Cost by phase (which features are expensive)
- Token usage trends
- Average cost per session
- Projected total cost based on remaining work
- Most and least expensive sessions

**To check raw data:**

```bash
cat sitrep/.sitrep-data.json
```

The JSON has every session's token count, cost, model, and duration.

---

### 7. Viewing Project Progress Visually

**Situation:** You want to see the big picture — not read markdown tables, but actually see progress bars, timelines, and charts.

**Steps:**

```
/dashboard
```

Then open in your browser:

```bash
open sitrep/dashboard.html    # macOS
xdg-open sitrep/dashboard.html  # Linux
```

The dashboard shows:
- Summary panel with key metrics (progress, cost, sessions, blockers)
- Phase progress bars (visual, color-coded)
- Active sprint tasks with status badges
- Session timeline (who did what, when, at what cost)
- Cost and token charts
- Decisions log
- Risk register
- Full project plan and status report (collapsible)
- History of all handoffs and previous dashboards

**Print it:** Cmd+P / Ctrl+P in the browser. Print-optimized CSS ensures a clean output.

**Previous dashboards are archived** in `sitrep/history/dashboards/` so you can compare progress over time.

---

### 8. Debugging When Things Feel Off

**Situation:** Something seems wrong. Task counts don't match. The progress bar looks wrong. Files might be in the wrong place.

**Quick check:**

```
/selfheal
```

Runs 4 checks:
1. **File Structure** — are all files where they should be?
2. **File Integrity** — are the markdown files well-formed? All sections present?
3. **Cross-File Sync** — do task counts in PROJECT_PLAN.md match STATUS_REPORT.md?
4. **Progress Accuracy** — do the progress bars match actual done/total ratios?

Auto-fixes what it can. Reports what needs your input.

**Deep audit (checks code too):**

```
/selfheal deep
```

Everything above, plus:
5. **Codebase Sync** — are tasks marked done actually implemented in the code? Is there code that isn't tracked in any task?

Run `/selfheal` periodically — especially after messy sessions or when multiple people are contributing.

---

### 9. Deferring Work Without Losing It

**Situation:** You started planning a feature but realized it's not needed for MVP. Or a task is too complex for now.

**Never delete tasks.** Instead:

Tell Claude:

```
Defer task 4.3 to post-MVP. It's not needed for the beta launch.
```

Claude (via `/session-end` or `/plan-update`) will:
- Mark the task as ⏭️ Deferred in STATUS_REPORT.md
- Move it to the Future / Post-MVP Ideas table in PROJECT_PLAN.md
- Log the change in the Changes & Scope Updates table
- Update task counts and progress bars

The task is preserved with full context. When you're ready for it later, move it back.

---

### 10. Recording Architecture Decisions

**Situation:** You just made an important technical decision (chose a database, picked an API pattern, decided on auth strategy). You want it documented so it's never re-debated.

**Option 1: During session-end**

Just make the decision during your session. `/session-end` picks up decisions and adds them to the Key Decisions table in PROJECT_PLAN.md automatically.

**Option 2: Explicitly**

```
/plan-update
```

Then tell Claude:

```
Add a decision: We're using Valkey instead of Redis for the task queue.
Rationale: Valkey is the open-source fork, avoids Redis licensing concerns,
drop-in compatible.
```

It gets logged in the Key Decisions table with a date. Next time someone asks "why Valkey?", the answer is in the plan.

---

### 11. Working on Multiple Projects

**Situation:** You have 2-3 projects, each with their own sitrep setup. You need to switch between them without mixing context.

**Each project is independent.** sitrep lives inside each repo:

```
~/code/project-a/sitrep/          ← Project A tracking
~/code/my-saas/sitrep/        ← SaaS app tracking
~/code/client-work/sitrep/    ← Client project tracking
```

**Switching projects:**

```bash
cd ~/code/project-a
claude
/session-start      # ← Project A context

# Done with Project A
/session-end

cd ~/code/my-saas
claude
/session-start      # ← SaaS context
```

Each `/session-start` reads only that project's sitrep files. No cross-contamination.

**Tip:** Use `/handoff ai` before switching. It creates a snapshot you can reference if you need to recall what you were doing in the other project.

---

### 12. Reviewing What Happened Last Week

**Situation:** It's Monday. You want to see what happened across last week's sessions before planning this week.

**Option 1: Dashboard**

```
/dashboard
```

Open the HTML. The Session Timeline section shows every session chronologically with what was done, tokens used, and cost.

**Option 2: Git log**

```bash
git log --oneline --since="7 days ago" sitrep/
```

Shows every sitrep commit from the past week.

**Option 3: Session history files**

```bash
ls sitrep/history/sessions/
```

Each session has its own detail file. Read any of them for the full story.

**Option 4: Quick check**

```
/session-start
```

The orientation banner shows the last session info. For deeper history, the session log in STATUS_REPORT.md has every session in reverse chronological order.

---

### 13. Presenting Progress to Stakeholders

**Situation:** An investor, manager, or client asks "where are we?" You need a professional-looking update, not a raw markdown file.

**Steps:**

```
/dashboard
```

Open `sitrep/dashboard.html` in your browser. It's designed to be presentation-ready:

- Clean, professional design (dark mode by default)
- Key metrics prominent: progress percentage, cost, sessions
- Visual progress bars by phase
- Print-friendly: Cmd+P gives a clean printout

**For a quick text summary:**

```
/sitrep
```

Copy-paste the output into Slack, email, or a message. It's concise and readable.

**For a detailed written handoff:**

```
/handoff human
```

Share `sitrep/HANDOFF.md` — it reads like a project status memo.

---

### 14. Onboarding a New Team Member

**Situation:** Someone new is joining the project. They need to understand the codebase, the plan, the progress, and the decisions — fast.

**Step 1: Generate a fresh handoff**

```
/handoff human
```

**Step 2: Generate the dashboard**

```
/dashboard
```

**Step 3: Share both**

Send them:
1. `sitrep/HANDOFF.md` — read this first, it's the 5-minute briefing
2. `sitrep/dashboard.html` — open this for the visual overview
3. `sitrep/PROJECT_PLAN.md` — reference for detailed phase plans
4. `sitrep/MANIFEST.md` — explains how sitrep works so they can use the commands

**Step 4: They start their first session**

```
/session-start
```

sitrep prints everything they need. They're productive in minutes, not hours.

---

### 15. Recovering from a Bad Session

**Situation:** Claude made a mess. Files got corrupted. Tasks are out of sync. The session went sideways.

**Step 1: Don't panic. Run selfheal.**

```
/selfheal deep
```

This will:
- Find and fix misplaced files
- Detect sync issues between plan and status
- Recalculate progress bars
- Check code against task list
- Auto-fix what it can
- Report what needs your input

**Step 2: If sitrep files are really broken, restore from git:**

```bash
# See what changed
git diff sitrep/

# Restore to last good commit
git checkout HEAD~1 -- sitrep/STATUS_REPORT.md
git checkout HEAD~1 -- sitrep/PROJECT_PLAN.md
```

**Step 3: If the session was so bad you want to pretend it didn't happen:**

```bash
# Reset sitrep files to before the bad session
git log --oneline sitrep/   # find the last good commit
git checkout <commit-hash> -- sitrep/
git commit -m "sitrep: reverted to session N — bad session discarded"
```

The beauty of git-backed tracking: nothing is ever truly lost, and any damage is reversible.

---

## Command Reference

| Command | What you type | When to use | Modifies files? |
|---------|--------------|-------------|-----------------|
| Start session | `/session-start` | Beginning of every session | No |
| End session | `/session-end` | End of every session | Yes + commit |
| Quick check | `/sitrep` | Anytime you want a status pulse | No |
| Add task | `/capture [desc] --phase N` | When new work surfaces | Yes + commit |
| Update plan | `/plan-update` | Scope changes, decisions, risks | Yes + commit |
| Health check | `/selfheal` or `/selfheal deep` | When things seem off | Yes + commit |
| Handoff | `/handoff` or `/handoff human` | Switching context or people | Yes + commit |
| Dashboard | `/dashboard` | Visual progress report | Yes + commit |

---

## Tips and Best Practices

**1. Always start with `/session-start` and end with `/session-end`.** These two commands are the minimum. Everything else is optional. If you do nothing else, these two keep your project on track.

**2. Run `/selfheal` weekly.** Even if nothing seems wrong. It catches drift before it becomes a problem.

**3. Use `/capture` immediately when you think of something.** Don't say "I'll add it later." You won't. Capture it now, decide when to do it later.

**4. Defer generously, delete never.** If a task isn't needed now, defer it. The Future table is your parking lot. Ideas that seem irrelevant today might be critical in v2.

**5. Keep session focus tight.** One session, one focus area. "Build auth system" is a session. "Build auth system, refactor the database, and fix CSS" is three sessions. Tight focus = better tracking.

**6. Use `/handoff ai` before clearing context.** If you're about to `/clear` in Claude Code or start a fresh session, run `/handoff ai` first. The next session can read the handoff and continue seamlessly.

**7. Generate the dashboard before important conversations.** Investor meeting? Client check-in? Run `/dashboard` and open the HTML. It's more impressive than saying "let me check my notes."

**8. Let the history accumulate.** Don't clean up `history/`. Those session logs, handoff archives, and dashboard snapshots are your project's memory. Git keeps them small. Let them grow.

**9. One project, one sitrep.** Don't try to track multiple projects in one sitrep folder. Each repo gets its own. Switch between them by changing directories.

**10. Trust the process.** The first few sessions feel like overhead. By session 5, you'll wonder how you ever built without it. The compounding value of preserved context is real.

---

## Troubleshooting

**"sitrep files not found"**
- Run `/selfheal`. It searches for misplaced files and moves them to `sitrep/`.
- If files truly don't exist, run `npx getsitrep init` to recreate templates.

**"Task counts don't match"**
- Run `/selfheal`. It recalculates and syncs both files automatically.

**"Dashboard is blank or broken"**
- Check that `sitrep/.sitrep-data.json` exists and has valid JSON.
- If not, run `/session-end` first — it creates the data file.
- Re-run `/dashboard`.

**"Handoff didn't archive the old one"**
- Check if `sitrep/history/handoffs/` directory exists. If not, create it:
  ```bash
  mkdir -p sitrep/history/handoffs
  ```
- Run `/handoff` again.

**"Cost estimates seem wrong"**
- Costs are estimates based on session activity level. They won't be exact.
- For more accurate tracking, note the actual token count from your Claude Code usage stats and update `.sitrep-data.json` manually.

**"I broke the sitrep files"**
- Restore from git: `git checkout HEAD~1 -- sitrep/`
- Or re-init: `npx getsitrep init` (won't overwrite existing files)

---

_Built by the sitrep community. Contributions welcome at [github.com/viitorohit/sitrep](https://github.com/viitorohit/sitrep)._
