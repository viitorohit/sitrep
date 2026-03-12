# Update Project Plan

## Step 0: Validate sitrep location (MANDATORY)
1. Verify these exact files exist:
   - `sitrep/PROJECT_PLAN.md` (relative to repo root)
   - `sitrep/STATUS_REPORT.md` (relative to repo root)
2. If either file is MISSING:
   - Search the repo for any file named `PROJECT_PLAN.md` or `STATUS_REPORT.md`
   - If found in wrong location → move it to `sitrep/` and notify the user
   - If not found at all → print: "⚠️ Cannot update — [filename] not found."
   - Do NOT proceed until both files are in `sitrep/`

---

Read `sitrep/PROJECT_PLAN.md` and apply the requested changes.

## What can be updated

### Adding new features
- If it's current scope → add to the appropriate existing phase table
- If it's future scope → add to the "Future / Post-MVP Ideas" table with priority and target version
- If it requires a new phase → create a new phase section following the existing format

### Recording decisions
- Add to the Key Decisions table with rationale and date

### Updating risks
- Add to Risk Register with impact and mitigation

### Scope changes
- If tasks are moved between phases, update both phase tables
- If tasks are removed, move to Future table (never delete)
- Also log the change in STATUS_REPORT.md → Changes & Scope Updates table

### After any update
```bash
git add sitrep/
git commit -m "sitrep: plan update — [brief description of change]"
```
