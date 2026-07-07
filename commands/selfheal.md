# Selfheal — Health Check & Auto-Fix

Run a full diagnostic on the sitrep framework. Fix what you can, report what needs human input.

> Intentional (manually invoked). This command owns all file-repair behavior for sitrep — session-start, session-end, capture, plan-update, and handoff deliberately do not search for or move files themselves; they defer to /selfheal. Path-agnostic per hard law #1 (no platform lock-in) — this is the GETSITREP-28 foundation. GETSITREP-29 (baseline hash manifest) and GETSITREP-30 (drift report) have landed; lock/diff/restore + upgrade protection (GETSITREP-31) is still to come.

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
- [ ] `sitrep/.sitrep-active-session` is in `.gitignore`
- [ ] The active platform's command directory contains all 8 canon commands: `session-start`, `session-end`, `sitrep`, `capture`, `plan-update`, `selfheal`, `handoff`, `dashboard` (canon: `docs/specs/command-canon.md`). Read the directory from adapter config, not a hardcoded path — today that's `.claude/commands/` for Claude Code; this becomes fully config-driven once GETSITREP-36's adapter contract ships. Never hardcode a second platform's path here.
- [ ] `sitrep/.sitrep-manifest.json` exists — a sha256 baseline of every canon command MD plus `sitrep/MANIFEST.md`, keyed to the version in `sitrep/MANIFEST.md`. (GETSITREP-29.) Created once, the first time it's missing — never regenerated on top of an existing one, since that would silently erase the baseline drift is measured against.
- [ ] Current file hashes are compared against the baseline manifest → report any modified/added/removed file, informational only. (GETSITREP-30.) Every drifted file is reported regardless of intent — nothing is excluded or acted on yet.

**Auto-fix:** Create missing directories. Add gitignore entry. Create the baseline hash manifest if absent.
**Cannot fix:** Files that don't exist anywhere. A missing or misplaced command file is flagged for the developer, not auto-moved. Drifted files (per the manifest) are reported in the same spirit — informational only, never a nag — since selfheal still can't tell a stale file from an intentionally customized one; that distinction is GETSITREP-31's lock/diff/restore.

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
