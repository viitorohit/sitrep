# Pulse — Session Status & Next Suggestion

Show which commands have been run this session and suggest what to do next.

---

## Step 1: Read session tracker

Read `sitrep/.sitrep-active-session` (if it exists).

If the file doesn't exist:
```
=== [PROJECT] PULSE ===
⚠️ No active session detected.

💡 Next: /session-start
========================
```
STOP here.

---

## Step 2: Parse and display

Read each line. Build a status display.

```
=== [PROJECT] PULSE ===

Session Commands:
  /session-start  [✅ 10:30 AM  or  ❌ not run]
  /sitrep         [✅ 10:31 AM  or  ── not run]
  /capture        [✅ 11:15 AM (×2)  or  ── not run]
  /plan-update    [✅ 11:45 AM  or  ── not run]
  /selfheal       [✅ time  or  ── not run]
  /handoff        [✅ time  or  ── not run]
  /dashboard      [✅ time  or  ── not run]
  /session-end    [✅ time  or  ❌ not yet]

Session duration: [time since session-start]
Commands run: [X] of 9
========================
```

Use:
- ✅ = executed (with timestamp)
- ❌ = should have been run but wasn't (session-start, session-end)
- ── = optional, not run (fine to skip)
- Show count if a command was run multiple times (e.g., /capture ×3)

---

## Step 3: Suggest next command

**If /session-start not run:**
→ "💡 Next: /session-start — orient yourself before working."

**If /session-start run but nothing else:**
→ "💡 Next: Start building. Use /capture for new tasks. /sitrep for a quick check."

**If working (session-start done, some commands run, no session-end):**
→ "💡 Next: Keep building. /session-end when you're done."

**If /session-end was run:**
→ "💡 Session complete. Optional: /handoff (switching context) or /dashboard (visual report)."

**If blockers exist (from STATUS_REPORT.md):**
→ "⚠️ Active blockers detected. Consider /plan-update to address them."

---

## Rules
- This command is READ-ONLY except for the tracker file.
- Append `pulse|[ISO timestamp]` to `sitrep/.sitrep-active-session` (if it exists).
- Fast execution — no heavy file parsing beyond the session tracker + a quick peek at STATUS_REPORT.md for blockers.
