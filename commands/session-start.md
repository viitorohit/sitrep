# Session Start Protocol

## Step 0: Validate sitrep location (MANDATORY)
Before anything else, run these checks:

1. Verify these exact files exist:
   - `sitrep/PROJECT_PLAN.md` (relative to repo root)
   - `sitrep/STATUS_REPORT.md` (relative to repo root)

2. If either file is MISSING:
   - Search the repo for any file named `PROJECT_PLAN.md` or `STATUS_REPORT.md`
   - If found in wrong location → move it to `sitrep/` and notify the user
   - If not found at all → print: "⚠️ Missing [filename]. Run /plan-update to create it."
   - Do NOT proceed until both files are in `sitrep/`

3. If a `sitrep/` directory doesn't exist → create it

---

## Step 1: Read project context
Read both `sitrep/STATUS_REPORT.md` and `sitrep/PROJECT_PLAN.md`.

Extract the project name from the first heading or metadata in PROJECT_PLAN.md. Use this as [PROJECT] in all output below.

---

## Step 2: Print session orientation

```
=== [PROJECT] SESSION START ===
Last session: [session number] — [what was done]
Current phase: [phase name] — [X/Y tasks done]
Overall: [X/total tasks — Y%]
Blockers: [any active blockers or "None"]
Queued for this session: [next tasks from status report]
=====================================
```

Do NOT make any changes yet. Wait for instructions on what to work on this session.
