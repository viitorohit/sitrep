# Sitrep Doctor — Health Check & Auto-Fix

Run a full diagnostic on the sitrep framework. Fix what you can, report what needs human input.

Read `sitrep/PROJECT_PLAN.md` to extract the project name. Use this as [PROJECT] in all output.

---

## Check 1: File Structure
- [ ] `sitrep/` directory exists at repo root
- [ ] `sitrep/PROJECT_PLAN.md` exists
- [ ] `sitrep/STATUS_REPORT.md` exists
- [ ] `.claude/commands/session-start.md` exists
- [ ] `.claude/commands/session-end.md` exists
- [ ] `.claude/commands/sitrep.md` exists
- [ ] `.claude/commands/plan-update.md` exists
- [ ] `.claude/commands/doctor.md` exists

**Auto-fix:** If files found in wrong locations, move them. If `sitrep/` missing, create it.
**Cannot fix:** If files don't exist anywhere — report which ones are missing.

---

## Check 2: File Integrity
- [ ] PROJECT_PLAN.md has all required sections: phases, Key Decisions, Risk Register, Future/Post-MVP
- [ ] STATUS_REPORT.md has all required sections: Active Sprint, Progress Dashboard, Completed Phases, Session Log, Blockers, Changes
- [ ] No corrupted markdown (broken tables, unclosed code blocks)
- [ ] Session log entries are in reverse chronological order (newest first)
- [ ] Last Updated date in both files is not more than 1 session behind

**Auto-fix:** Add missing sections with empty templates. Fix table formatting.
**Cannot fix:** Missing content within sections — report what's empty.

---

## Check 3: Cross-File Consistency
- [ ] Phase names match between PROJECT_PLAN.md and STATUS_REPORT.md
- [ ] Task IDs in STATUS_REPORT.md all exist in PROJECT_PLAN.md
- [ ] Task counts per phase match between both files
- [ ] Total task count in Progress Dashboard matches actual tasks listed
- [ ] Current Phase in STATUS_REPORT.md header matches the actual active sprint
- [ ] No tasks marked ✅ in STATUS_REPORT.md that don't appear in PROJECT_PLAN.md

**Auto-fix:** Update counts, fix phase references, sync task IDs.
**Cannot fix:** Conflicting task descriptions — report both versions, ask human to pick.

---

## Check 4: Progress Accuracy
- [ ] Progress bars match actual done/total ratios
- [ ] TOTAL row sums correctly
- [ ] Overall percentage in header matches TOTAL row
- [ ] No phase marked complete that still has 🔲 or 🟡 tasks
- [ ] No tasks marked ✅ Done without a note explaining what was done

**Auto-fix:** Recalculate all progress bars, totals, and percentages.
**Cannot fix:** Tasks marked done without verification — flag them.

---

## Check 5: Codebase Sync (Optional — only if $ARGUMENTS contains "deep")
- [ ] Scan the actual codebase for implemented features
- [ ] Compare against tasks marked ✅ — flag anything marked done but not found in code
- [ ] Look for significant code that isn't tracked in any task — flag as untracked work
- [ ] Check git tags exist for completed phases

**Auto-fix:** Add missing git tags for completed phases.
**Cannot fix:** Untracked work — report it and suggest which phase/task it belongs to.

---

## Output Format

```
=== [PROJECT] DOCTOR ===

File Structure:     ✅ All files in place (or ⚠️ X issues)
File Integrity:     ✅ Clean (or ⚠️ X issues)
Cross-File Sync:    ✅ Consistent (or ⚠️ X mismatches)
Progress Accuracy:  ✅ Correct (or ⚠️ X recalculated)
Codebase Sync:      ⏭️ Skipped (run /doctor deep to include)

Auto-fixed:
- [list everything that was auto-corrected]

Needs human input:
- [list anything that requires a decision]

Overall: ✅ Healthy / ⚠️ X issues found (Y auto-fixed, Z need input)
========================
```

---

## After fixes

If any files were modified:
```bash
git add sitrep/ .claude/
git commit -m "sitrep: doctor — auto-fix [brief summary of fixes]"
```
