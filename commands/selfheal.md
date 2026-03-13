# Selfheal — Health Check & Auto-Fix

Run a full diagnostic on the sitrep framework. Fix what you can, report what needs human input.

Read `sitrep/PROJECT_PLAN.md` to extract the project name. Use as [PROJECT] in output.

---

## Check 1: File Structure
- [ ] `sitrep/` directory exists at repo root
- [ ] `sitrep/MANIFEST.md` exists
- [ ] `sitrep/PROJECT_PLAN.md` exists
- [ ] `sitrep/STATUS_REPORT.md` exists
- [ ] `sitrep/history/sessions/` exists
- [ ] `sitrep/history/handoffs/` exists
- [ ] `sitrep/history/dashboards/` exists
- [ ] `.claude/commands/session-start.md` exists
- [ ] `.claude/commands/session-end.md` exists
- [ ] `.claude/commands/sitrep.md` exists
- [ ] `.claude/commands/plan-update.md` exists
- [ ] `.claude/commands/capture.md` exists
- [ ] `.claude/commands/selfheal.md` exists
- [ ] `.claude/commands/handoff.md` exists
- [ ] `.claude/commands/dashboard.md` exists
- [ ] `.claude/commands/pulse.md` exists
- [ ] `sitrep/.sitrep-active-session` is in `.gitignore`

**Auto-fix:** Move misplaced files. Create missing directories. Add gitignore entry.
**Cannot fix:** Files that don't exist anywhere.

---

## Check 2: File Integrity
- [ ] PROJECT_PLAN.md has required sections: phases, Key Decisions, Risk Register, Future
- [ ] STATUS_REPORT.md has required sections: Active Sprint, Progress Dashboard, Session Log, Blockers, Changes
- [ ] MANIFEST.md has version and folder structure
- [ ] .sitrep-data.json is valid JSON (if exists)
- [ ] No corrupted markdown (broken tables, unclosed code blocks)
- [ ] Session log in reverse chronological order

**Auto-fix:** Add missing sections with empty templates. Fix table formatting.
**Cannot fix:** Missing content within sections.

---

## Check 3: Cross-File Consistency
- [ ] Phase names match between both files
- [ ] Task IDs in STATUS_REPORT all exist in PROJECT_PLAN
- [ ] Task counts per phase match
- [ ] Total task count matches actual tasks listed
- [ ] Current Phase header matches actual active sprint
- [ ] .sitrep-data.json session count matches session log entries

**Auto-fix:** Update counts, fix references, sync IDs.
**Cannot fix:** Conflicting descriptions — report both, ask human.

---

## Check 4: Progress Accuracy
- [ ] Progress bars match done/total ratios
- [ ] TOTAL row sums correctly
- [ ] Overall percentage matches TOTAL row
- [ ] No phase marked complete with remaining 🔲 or 🟡 tasks
- [ ] Cost totals in .sitrep-data.json match sum of session costs

**Auto-fix:** Recalculate all progress bars, totals, percentages, cost sums.
**Cannot fix:** Tasks marked done without verification.

---

## Check 5: Codebase Sync (only if $ARGUMENTS contains "deep")
- [ ] Scan codebase for implemented features
- [ ] Flag tasks marked ✅ but not found in code
- [ ] Flag code not tracked in any task
- [ ] Check git tags for completed phases

**Auto-fix:** Add missing git tags.
**Cannot fix:** Untracked work — report and suggest placement.

---

## Output

```
=== [PROJECT] SELFHEAL ===

File Structure:     ✅ All files in place (or ⚠️ X issues)
File Integrity:     ✅ Clean (or ⚠️ X issues)
Cross-File Sync:    ✅ Consistent (or ⚠️ X mismatches)
Progress Accuracy:  ✅ Correct (or ⚠️ X recalculated)
Codebase Sync:      ⏭️ Skipped (run /selfheal deep to include)

Auto-fixed:
- [list corrections]

Needs human input:
- [list decisions needed]

Overall: ✅ Healthy / ⚠️ X issues (Y fixed, Z need input)
===========================
```

If files were modified:
```bash
git add sitrep/ .claude/
git commit -m "sitrep: selfheal — [summary of fixes]"
```
