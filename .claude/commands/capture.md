# Capture — Add Task to Plan & Status

Capture a new task into the project plan and status report in one step. Never lose an idea mid-session.

## Step 0: Validate sitrep location (MANDATORY)
1. Verify `sitrep/PROJECT_PLAN.md` and `sitrep/STATUS_REPORT.md` exist
2. If missing → search, move, or report. Do NOT proceed until both are in `sitrep/`

---

## Step 1: Parse the request

The user provides a task description in $ARGUMENTS. Examples:
- `/capture build user authentication system --phase 3`
- `/capture fix sidebar navigation bug --phase 2`
- `/capture add export to PDF feature`
- `/capture refactor database connection pooling --future`

Parse:
- **Task description**: the main text
- **--phase N**: which phase to add it to (optional)
- **--future**: add to Future / Post-MVP Ideas table instead of a phase (optional)

If no --phase and no --future:
- Check which phase is the current Active Sprint in STATUS_REPORT.md
- Ask the user: "Add to Phase [N] ([name]) — the active sprint? Or specify a phase number."

---

## Step 2: Determine the task ID

Read the target phase table from PROJECT_PLAN.md.

Find the highest existing task number in that phase. Assign the next number.
- Phase 3 has tasks 3.1, 3.2, 3.3 → new task is 3.4
- Phase 5 has tasks 5.1 through 5.9 → new task is 5.10
- If --future, assign next F.N number from the Future table

---

## Step 3: Update PROJECT_PLAN.md

Add the new task to the correct phase table:

```markdown
| [N.X] | [task description] | [inferred from description or left blank] |
```

If --future, add to the Future / Post-MVP Ideas table:
```markdown
| F.X | [task description] | Medium | [TBD] |
```

---

## Step 4: Update STATUS_REPORT.md

If the task was added to the **active sprint phase**:
- Add to the Active Sprint table:
  ```markdown
  | [N.X] | [task description] | 🔲 Todo | Captured mid-session |
  ```
- Update the Progress Dashboard: increment task count for that phase and TOTAL
- Recalculate progress bar and percentage (done count stays the same, total increases)

If added to a **different phase** (not active sprint):
- Update the Progress Dashboard: increment task count for that phase and TOTAL
- Recalculate progress bar and percentage

If added to **Future table**:
- No changes to Progress Dashboard (future items aren't counted)

---

## Step 5: Log the addition

Add to the Changes & Scope Updates table in STATUS_REPORT.md:
```markdown
| [today's date] | Captured task [N.X]: [description] to Phase [N] | Mid-session capture |
```

---

## Step 6: Commit and confirm

```bash
git add sitrep/
git commit -m "sitrep: capture [N.X] — [short description]"
```

Print:
```
=== CAPTURED ===
ID: [N.X]
Task: [description]
Phase: [N] ([phase name]) / Future
Status: 🔲 Todo
Updated: PROJECT_PLAN.md + STATUS_REPORT.md
================
```
