# Update Project Plan

> Intentional (manually invoked).

## Step 0: Check sitrep presence
1. Verify `sitrep/PROJECT_PLAN.md` and `sitrep/STATUS_REPORT.md` exist
2. If either is missing → print "⚠️ Cannot update — [filename] not found. Run /selfheal to diagnose and fix." and stop. File repair is /selfheal's job, not plan-update's.

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
