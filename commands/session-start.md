# Session Start Protocol

> Automatic (hook-fired): runs on every session start. Must never block — file repair is /selfheal's job, not this command's.

Thin wrapper (GETSITREP-10) — orientation logic (reading MANIFEST.md/STATUS_REPORT.md/PROJECT_PLAN.md/.sitrep-data.json, building the summary) lives entirely in `getsitrep session-start`. This file's only job is to invoke it and show the result — it does not re-read those files or re-derive the summary itself.

Run:
```bash
getsitrep session-start
```

Print its output verbatim as the session's orientation. This is orientation, not a gate — nothing here should stop the developer from starting work immediately. Wait for instructions on what to work on this session before making changes.

---

## 2026 best-practice reminders (print once alongside the CLI's output)

- **Model routing:** default to Sonnet for this session. Reach for Opus only on genuinely hard reasoning — not as a default. Route subagent/Task-tool work to Haiku by default.
- **/clear hygiene:** session-start orients you *within* the current project context — it doesn't reset it. If this session is starting genuinely unrelated work, run `/clear` first. Don't `/clear` mid-task.
