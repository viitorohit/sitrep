# Session End Protocol

## Step 0: Validate sitrep location (MANDATORY)
Before anything else, run these checks:

1. Verify these exact files exist:
   - `sitrep/PROJECT_PLAN.md` (relative to repo root)
   - `sitrep/STATUS_REPORT.md` (relative to repo root)

2. If either file is MISSING:
   - Search the repo for any file named `PROJECT_PLAN.md` or `STATUS_REPORT.md`
   - If found in wrong location → move it to `sitrep/` and notify the user
   - If not found at all → print: "⚠️ Cannot update [filename] — file not found. Create it first."
   - Do NOT proceed with updates until both files are in `sitrep/`

3. If a `sitrep/` directory doesn't exist → create it

---

Read both `sitrep/STATUS_REPORT.md` and `sitrep/PROJECT_PLAN.md`.

Extract the project name from the first heading or metadata in PROJECT_PLAN.md. Use this as [PROJECT] in all output below.

Update both files with everything accomplished this session.

---

## Part A: Update STATUS_REPORT.md

### 1. Update Active Sprint table
- Change 🔲 → ✅ for completed tasks (add short note)
- Change 🔲 → 🟡 for in-progress tasks (note what remains)
- Change 🔲 → ❌ for blocked tasks (note the blocker)
- If a phase is now complete, move it to Completed Phases section

### 2. Update Progress Dashboard
- Recalculate Done count for each affected phase
- Update progress bars:
  - 0% ░░░░░░░░░░ | 10% █░░░░░░░░░ | 20% ██░░░░░░░░
  - 30% ███░░░░░░░ | 40% ████░░░░░░ | 50% █████░░░░░
  - 60% ██████░░░░ | 70% ███████░░░ | 80% ████████░░
  - 90% █████████░ | 100% ██████████
- Update TOTAL row
- Update header: Overall Progress count and percentage

### 3. Add Session Log entry (at the TOP of the log)
```
### Session N — YYYY-MM-DD
- **Focus:** [one-line summary of session focus]
- **Done:** [list completed task IDs and short descriptions]
- **Blockers:** [any issues or "None"]
- **Next:** [what should happen next session]
```

### 4. Update header metadata
- Last Updated date and session number
- Current Phase (if changed)
- Next Milestone (if changed)

### 5. If a phase completed
- Move tasks to Completed Phases section
- Set up next phase as Active Sprint
- Create git tag: `git tag v0.X.0-<n> -m "Phase X complete"`

### 6. Log any scope changes
- If tasks were added, split, or deferred → add to Changes & Scope Updates table
- If new risks were found → add to Blockers & Risks table

---

## Part B: Update PROJECT_PLAN.md

Review everything that happened this session and update the project plan:

### 1. New features or tasks
- If any new tasks were created → add to the correct phase table
- If a task was split into subtasks → update the phase table (3.1a, 3.1b, etc.)
- If a new feature was discussed for future → add to Future / Post-MVP Ideas table

### 2. Scope changes
- If tasks were moved between phases → update both phase tables
- If tasks were deferred → move to Future table with a note (never delete)
- If a phase was restructured → update the phase section

### 3. Decisions
- If any architectural or design decisions were made → add to Key Decisions table with rationale and date

### 4. Risks
- If new risks were discovered → add to Risk Register with impact and mitigation
- If existing risks were resolved → note resolution

### 5. Sync check
- Verify task counts in PROJECT_PLAN.md match STATUS_REPORT.md
- Verify phase names and task IDs are consistent across both files
- Flag any mismatches found and fix them

---

## Part C: Commit and summarize

```bash
git add sitrep/
git commit -m "sitrep: session N — [one-line summary]"
```

Print summary:
```
=== [PROJECT] SESSION END ===
Session: [N]
Completed: [list of task IDs]
In progress: [list of task IDs or "None"]
Blockers: [any or "None"]
Overall: [X/total tasks — Y%]
Plan changes: [any updates to PROJECT_PLAN.md or "None"]
Next session: [queued work]
===================================
```
