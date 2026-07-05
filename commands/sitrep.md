# Quick Status Check

> Intentional (manually invoked). Absorbs `/pulse` (merged 2026-07 per GETSITREP-13/16 — see `docs/specs/command-canon.md`); pulse is no longer a separate command.

## Step 0: Check sitrep presence
1. Verify `sitrep/STATUS_REPORT.md` exists
2. If missing → print "⚠️ No STATUS_REPORT.md found. Run /selfheal to diagnose, or /session-end to create one." and stop. File repair is /selfheal's job, not sitrep's.

---

Read `sitrep/STATUS_REPORT.md`.

Extract the project name from the header metadata. Use this as [PROJECT] in output below.

---

## Step 1: Session command tracker (absorbed from /pulse)

Read `sitrep/.sitrep-active-session` if it exists, and append `sitrep|[ISO timestamp]` to it. If it doesn't exist, skip this whole step — it's optional context, not a requirement.

If it exists, parse it and show which commands have run this session:

```
Session Commands:
  /session-start  [✅ 10:30 AM  or  ❌ not run]
  /capture        [✅ 11:15 AM (×2)  or  ── not run]
  /plan-update    [✅ 11:45 AM  or  ── not run]
  /selfheal       [✅ time  or  ── not run]
  /handoff        [✅ time  or  ── not run]
  /dashboard      [✅ time  or  ── not run]
  /session-end    [✅ time  or  ❌ not yet]

Session duration: [time since session-start]
Commands run: [X] of 8
```

- ✅ = executed (with timestamp) · ❌ = should have been run but wasn't (session-start, session-end) · ── = optional, not run (fine to skip)
- Show a count if a command ran multiple times (e.g., /capture ×3)

---

## Step 2: Compact status summary

```
=== [PROJECT] SITREP ===
Phase: [current phase] — [X/Y tasks done]
Overall: [X/total — Y%]
Active tasks: [list any 🟡 in-progress tasks]
Blockers: [any ❌ or "None"]
Last update: [date — session N]
========================
```

---

## Step 3: Suggest next command

**If /session-start not run this session (or no tracker file at all):**
→ "💡 Next: /session-start — orient yourself before working."

**If /session-start run but nothing else:**
→ "💡 Next: Start building. Use /capture for new tasks."

**If working (session-start done, some commands run, no session-end):**
→ "💡 Next: Keep building. /session-end when you're done."

**If /session-end was run:**
→ "💡 Session complete. Optional: /handoff (switching context) or /dashboard (visual report)."

**If blockers exist (from STATUS_REPORT.md):**
→ "⚠️ Active blockers detected. Consider /plan-update to address them."

---

## Rules
- Read-only except for appending to the session tracker file (`sitrep/.sitrep-active-session`).
- Fast execution — no heavy file parsing beyond STATUS_REPORT.md and the session tracker.
