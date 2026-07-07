# Selfheal — Health Check & Auto-Fix

Run a full diagnostic on the sitrep framework. Fix what you can, report what needs human input.

> Intentional (manually invoked). This command owns all file-repair behavior for sitrep — session-start, session-end, capture, plan-update, and handoff deliberately do not search for or move files themselves; they defer to /selfheal. Path-agnostic per hard law #1 (no platform lock-in) — this is the GETSITREP-28 foundation, and all three subtasks (GETSITREP-29 baseline manifest, GETSITREP-30 drift report, GETSITREP-31 lock/diff/restore + upgrade protection) have now landed.

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
**Cannot fix:** Files that don't exist anywhere. A missing or misplaced command file is flagged for the developer, not auto-moved. Drifted files (per the manifest) are reported in the same spirit — informational only, never a nag. A file marked locked (see below) is excluded from this report entirely.

---

## Lock / Diff / Restore Actions (GETSITREP-31)

Manually invoked, one target file at a time — never run automatically as part of the default health check above.

- `selfheal lock --file <name>` — accept a drifted file as intentional. Excluded from the drift report from then on, permanently, until unlocked.
- `selfheal unlock --file <name>` — resume drift monitoring on a locked file, against the same baseline it had before locking.
- `selfheal diff --file <name>` — show the live file against the canonical version shipped with the CLI. No writes.
- `selfheal restore --file <name> [--force]` — overwrite the live file with the canonical version. Without `--force`, refuses and prints the diff if the live file has been customized (this is the upgrade-protection warning — there's no separate `getsitrep upgrade` command, so `restore` is the one write-path that can clobber a customization today). With `--force`, overwrites and re-baselines that file's hash to canonical.

`<name>` is one of the 8 canon command names (`session-start`, `session-end`, `sitrep`, `capture`, `plan-update`, `selfheal`, `handoff`, `dashboard`) — not a file path.

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
- [ ] Phase names match between PROJECT_PLAN.md's `## Phase N:` headings and STATUS_REPORT.md's Progress Dashboard table
- [ ] Every ID in the Active Sprint table appears somewhere in PROJECT_PLAN.md (works for both legacy numeric IDs like `3.4` and Jira-Story keys like `GETSITREP-28`, whichever a phase actually uses)
- [ ] STATUS_REPORT.md's Current Phase header names a phase that actually exists in PROJECT_PLAN.md and isn't already marked ✅ complete there
- [ ] .sitrep-data.json's session count matches the number of `### Session N` entries in STATUS_REPORT.md's Session Log

**Auto-fix:** None — every item above is report-only. A phase-name mismatch, a stray ID, or a session-count drift could each be a real typo or an intentional edit; guessing wrong risks silently corrupting user-authored text, so this check only reports, never rewrites prose.
**Cannot fix (report as "Needs human input"):** All of the above.
**Known gap:** per-phase task-count/total cross-referencing (comparing STATUS_REPORT's stated counts against the actual number of rows in PROJECT_PLAN's table) is not implemented — Check 4 recalculates bars *from* STATUS_REPORT's own numbers, but doesn't independently re-derive those numbers from PROJECT_PLAN's row counts.

---

## Check 4: Progress Accuracy
- [ ] Progress bars match done/total ratios — recalculated for any phase whose Tasks/Done cells in the Progress Dashboard table are plain integers
- [ ] No phase marked ✅ complete in PROJECT_PLAN.md while its Progress Dashboard row shows done < total
- [ ] Cost totals in .sitrep-data.json match the sum of each session's `cost_usd`

**Auto-fix:** Recalculates and rewrites progress bars in place; recalculates and rewrites `.sitrep-data.json`'s `totals.cost_usd`.
**Cannot fix:** A phase marked ✅ with remaining tasks — reported, not auto-resolved (could mean the phase isn't really done, or the count is stale — a human call either way).
**Known gap — by design, not oversight:** TOTAL-row and overall-percentage recomputation is skipped whenever a phase's Tasks/Done cells aren't plain integers. This project's own PROJECT_PLAN.md/STATUS_REPORT.md mix legacy numeric task counts (Phases 1-2) with Jira-Story tracking ("9 Stories", Phase 3+) — a TOTAL row like "23 tasks + 9 Stories" has no single number to recompute, so selfheal treats it as not-applicable rather than force-fitting a number onto it.

---

## Check 5: Codebase Sync (only if $ARGUMENTS contains "deep")
- [ ] Check git tags for completed phases
- [ ] Best-effort: search git log for a commit mentioning each Active-Sprint item marked ✅

**Auto-fix:** Creates a missing git tag (named from the phase heading's version) for any phase marked ✅ in PROJECT_PLAN.md.
**Cannot fix:** A completed item with no matching commit message — reported as a heuristic hint, not a finding ("no commit happened to mention it by name" isn't proof the work wasn't done).
**Known gap — explicitly out of scope, not deferred:** "flag tasks marked ✅ but not found in code" (in the general sense) and "flag code not tracked in any task" both require judging what a diff or file *is* well enough to match it against a task description — that's an LLM-judgment call, not something deterministic Node code can do reliably. Rather than fake it with a weak heuristic, this stays an open gap; an AI running `/selfheal deep` can still reason about this manually using the report as a starting point.

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
