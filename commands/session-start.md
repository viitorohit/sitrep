# Session Start Protocol

## Step 0: Validate sitrep location (MANDATORY)
Before anything else, run these checks:

1. Verify these exact files exist:
   - `sitrep/MANIFEST.md` (framework reference)
   - `sitrep/PROJECT_PLAN.md` (relative to repo root)
   - `sitrep/STATUS_REPORT.md` (relative to repo root)

2. If any file is MISSING:
   - Search the repo for the file by name
   - If found in wrong location → move it to `sitrep/` and notify the user
   - If MANIFEST.md is missing → print: "⚠️ Missing MANIFEST.md. Consider adding the framework reference."
   - If PROJECT_PLAN.md or STATUS_REPORT.md missing → print: "⚠️ Missing [filename]. Run /plan-update to create it."
   - Do NOT proceed until both core files (PROJECT_PLAN.md + STATUS_REPORT.md) are in `sitrep/`

3. If a `sitrep/` directory doesn't exist → create it

---

## Step 1: Read project context
1. Read `sitrep/MANIFEST.md` first (if exists) — understand the framework version and rules
2. Read `sitrep/STATUS_REPORT.md` — current progress
3. Read `sitrep/PROJECT_PLAN.md` — roadmap and context
4. Read `sitrep/.sitrep-data.json` (if exists) — cost and session history

Extract the project name from PROJECT_PLAN.md. Use this as [PROJECT] in all output.

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

Do NOT make any changes yet. Wait for instructions on what to work on this session.
