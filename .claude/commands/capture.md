# Capture — Add Task to Plan & Status

> Intentional (manually invoked).

Capture a new task into the project plan and status report in one step. Never lose an idea mid-session.

Thin wrapper (GETSITREP-10) — task-ID assignment, table insertion, and commit all live in `getsitrep capture`. No interactive "which phase?" prompt (unlike this command's original design) — a non-interactive CLI can't ask a question mid-session, so it silently defaults to STATUS_REPORT.md's Current Phase when `--phase`/`--future` are both omitted. Pass `--phase N` explicitly if that default is wrong.

Run:
```bash
getsitrep capture $ARGUMENTS
```

Examples: `getsitrep capture "add export to PDF feature" --phase 3`, `getsitrep capture "refactor connection pooling" --future`.

Print its output verbatim.
