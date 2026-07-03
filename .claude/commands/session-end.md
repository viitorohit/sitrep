# Session End Protocol

## Step 0: Validate sitrep location (MANDATORY)
Before anything else, run these checks:

1. Verify these exact files exist:
   - `sitrep/MANIFEST.md` (framework reference — warn if missing but continue)
   - `sitrep/PROJECT_PLAN.md` (relative to repo root)
   - `sitrep/STATUS_REPORT.md` (relative to repo root)

2. If PROJECT_PLAN.md or STATUS_REPORT.md is MISSING:
   - Search the repo for any file named `PROJECT_PLAN.md` or `STATUS_REPORT.md`
   - If found in wrong location → move it to `sitrep/` and notify the user
   - If not found at all → print: "⚠️ Cannot update [filename] — file not found."
   - Do NOT proceed with updates until both files are in `sitrep/`

3. Ensure these directories exist (create if missing):
   - `sitrep/history/sessions/`
   - `sitrep/history/handoffs/`
   - `sitrep/history/dashboards/`

---

Read both `sitrep/STATUS_REPORT.md` and `sitrep/PROJECT_PLAN.md`.

Extract the project name from the first heading or metadata in PROJECT_PLAN.md. Use this as [PROJECT] in all output.

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
- **User:** [who did this session]
- **Focus:** [one-line summary]
- **Done:** [list completed task IDs and descriptions]
- **Blockers:** [any issues or "None"]
- **Tokens:** ~[estimated total tokens] | Cost: ~$[estimated cost]
- **Model:** [which AI model was used]
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

### 1. New features or tasks
- If any new tasks were created → add to the correct phase table
- If a task was split into subtasks → update the phase table (3.1a, 3.1b, etc.)
- If a new feature was discussed for future → add to Future / Post-MVP Ideas table

### 2. Scope changes
- If tasks were moved between phases → update both phase tables
- If tasks were deferred → move to Future table with a note (never delete)

### 3. Decisions
- If any decisions were made → add to Key Decisions table with rationale and date

### 4. Risks
- If new risks were discovered → add to Risk Register

### 5. Sync check
- Verify task counts in PROJECT_PLAN.md match STATUS_REPORT.md
- Verify phase names and task IDs are consistent across both files
- Flag any mismatches and fix them

---

## Part C: Update .sitrep-data.json

Read `sitrep/.sitrep-data.json` (create if it doesn't exist with empty structure).

### 1. Determine session info
- **Session number:** increment from last session in the file
- **Date:** today's date
- **User:** ask or infer from git config (`git config user.name`) or previous sessions
- **Focus:** one-line summary of what this session was about
- **Phase:** which phase was active
- **Model:** which AI model was used this session

### 2. Estimate tokens and cost
- Review the work done this session
- Estimate token usage:
  - Light (reading, planning, small edits): ~20,000 tokens
  - Medium (1-2 features built, some debugging): ~60,000 tokens
  - Heavy (large refactor, many files, extensive debugging): ~150,000 tokens
- Calculate cost using model pricing from MANIFEST.md
- If exact counts are available from the AI tool, use those instead

### 3. Add session record
Add a new entry to the `sessions` array in `.sitrep-data.json`:
```json
{
  "number": N,
  "date": "YYYY-MM-DD",
  "user": "name",
  "focus": "one-line summary",
  "phase": N,
  "tasks_completed": ["X.Y", "X.Z"],
  "tasks_in_progress": ["X.W"],
  "tasks_blocked": [],
  "blockers": [],
  "decisions": ["decision made"],
  "tokens": { "input": N, "output": N, "total": N },
  "cost_usd": N.NN,
  "model": "model-name",
  "duration_minutes": N,
  "notes": "any additional notes"
}
```

### 4. Update user record
Add or update the user in the `users` array. Add this session number to their sessions list.

### 5. Update phase totals
Update the relevant phase entry: add tokens and cost from this session.

### 6. Update grand totals
Recalculate `totals` object: total sessions, tasks done, total tokens, total cost, total hours.

---

## Part D: Create session history record

Create `sitrep/history/sessions/session-NNN.md` (zero-padded to 3 digits):

```markdown
# Session [N] — [date]

> **User:** [name]
> **Phase:** [phase number] — [phase name]
> **Duration:** ~[minutes] min
> **Model:** [model name]
> **Tokens:** ~[total] (input: [N], output: [N])
> **Cost:** ~$[N.NN]

## Focus
[What this session was about]

## Completed
[List of task IDs and what was done]

## In Progress
[Tasks started but not finished]

## Decisions Made
[Any decisions logged]

## Blockers
[Any blockers or "None"]

## Notes
[Anything else worth recording]

## Next Session
[What should happen next]
```

---

## Part E: Commit and summarize

```bash
git add sitrep/
git commit -m "sitrep: session N — [one-line summary]"
```

Print summary:
```
=== [PROJECT] SESSION END ===
Session: [N]
User: [name]
Completed: [list of task IDs]
In progress: [list or "None"]
Blockers: [any or "None"]
Overall: [X/total tasks — Y%]
Tokens: ~[total] | Cost: ~$[N.NN]
Plan changes: [any or "None"]
Next session: [queued work]
===================================
```
