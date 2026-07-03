# Session Start Protocol

> Automatic (hook-fired): this command is meant to run unattended on every session start. It must never block — file repair is /selfheal's job (see GETSITREP-28/39), not this command's.

## Step 0: Check sitrep presence (fail-open)
Look for these files, but do not search for or move anything — that's /selfheal's responsibility, not session-start's:
- `sitrep/MANIFEST.md`
- `sitrep/PROJECT_PLAN.md`
- `sitrep/STATUS_REPORT.md`

- All present → continue to Step 1.
- Any missing → print one line ("⚠️ Missing [filename] — run /selfheal to diagnose and fix, or /plan-update to create it") and continue anyway with whatever context is available. Never block the session on missing files.
- No `sitrep/` directory at all → same: warn, continue (first-run bootstrap handles brand-new projects — see MANIFEST.md).

---

## Step 1: Read project context
1. Read `sitrep/MANIFEST.md` if it exists — understand the framework version and rules
2. Read `sitrep/STATUS_REPORT.md` if it exists — current progress
3. Read `sitrep/PROJECT_PLAN.md` if it exists — roadmap and context
4. Read `sitrep/.sitrep-data.json` if it exists — cost and session history

Extract the project name from PROJECT_PLAN.md. Use this as [PROJECT] in all output. If PROJECT_PLAN.md is missing, fall back to the repo directory name.

---

## Step 2: Print session orientation

```
=== [PROJECT] SESSION START ===
sitrep: v[version from MANIFEST.md or "unknown"]
Last session: [N] — [date] — [user] — [focus]
Current phase: [phase name] — [X/Y tasks done]
Overall: [X/total tasks — Y%]
Total cost to date: $[X.XX] across [N] sessions
Blockers: [any active blockers or "None"]
Queued for this session: [next tasks from status report]
=====================================
```

This is orientation, not a gate — nothing here should stop the developer from starting work immediately. Wait for instructions on what to work on this session before making changes.
