# Quick Status Check

> Intentional (manually invoked), read-only except for appending to the session tracker.

Thin wrapper (GETSITREP-10) — reading STATUS_REPORT.md, the session-command tracker (absorbed from the old `/pulse`, see `docs/specs/command-canon.md`), and the next-command suggestion logic all live in `getsitrep sitrep`.

Run:
```bash
getsitrep sitrep
```

Print its output verbatim.
