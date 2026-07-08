# Quick Status Check

> Intentional (manually invoked), read-only except for appending to the session tracker.

Thin wrapper (GETSITREP-10) — reading STATUS_REPORT.md, the session-command tracker (absorbed from the old `/pulse`, see `docs/specs/command-canon.md`), and the next-command suggestion logic all live in `getsitrep sitrep`.

**If `sitrep.config.json`'s `planSource` names an external tool** and you have your own independent access to it, you may optionally pass a status summary the same way `session-start` does:
```bash
getsitrep sitrep --plan-data '{"tool":"jira","ref":"...","fetchedAt":"<ISO date>","totalTasks":N,"doneTasks":N,"summary":"..."}'
```
Entirely optional (GETSITREP-50, ADR-0006) — omit it and the command still works.

Run:
```bash
getsitrep sitrep
```

Print its output verbatim.
