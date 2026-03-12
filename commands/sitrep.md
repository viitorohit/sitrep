# Quick Status Check

## Step 0: Validate sitrep location (MANDATORY)
1. Verify `sitrep/STATUS_REPORT.md` exists (relative to repo root)
2. If MISSING:
   - Search the repo for any file named `STATUS_REPORT.md`
   - If found in wrong location → print: "⚠️ STATUS_REPORT.md found at [path] instead of sitrep/. Moving it." → move it
   - If not found → print: "⚠️ No STATUS_REPORT.md found. Run /session-end to create one."
   - STOP here if file cannot be located

---

Read `sitrep/STATUS_REPORT.md`.

Extract the project name from the header metadata. Use this as [PROJECT] in output below.

Print a compact status summary:

```
=== [PROJECT] SITREP ===
Phase: [current phase] — [X/Y tasks done]
Overall: [X/total — Y%]
Active tasks: [list any 🟡 in-progress tasks]
Blockers: [any ❌ or "None"]
Last update: [date — session N]
========================
```

Do NOT modify any files. Read-only check.
