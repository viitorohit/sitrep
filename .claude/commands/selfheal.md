# Selfheal — Health Check & Auto-Fix

> Intentional (manually invoked). This command owns all file-repair behavior for sitrep — session-start, session-end, capture, plan-update, and handoff deliberately do not search for or move files themselves; they defer to /selfheal.

Thin wrapper (GETSITREP-10) — every check below, and every auto-fix, lives in `getsitrep selfheal` (`src/commands/selfheal.js` is the single source of truth for exact behavior and known scope boundaries; this file is a pointer to it, not a second copy of its logic).

Run:
```bash
getsitrep selfheal $ARGUMENTS
```

Examples: `getsitrep selfheal` (default checks), `getsitrep selfheal deep` (adds Check 5), `getsitrep selfheal lock --file dashboard`, `getsitrep selfheal diff --file selfheal`, `getsitrep selfheal restore --file selfheal --force`.

Print its output verbatim — do not reinterpret, re-run, or duplicate its checks yourself.

---

## What it checks (reference — see the CLI source for exact scope)

1. **File Structure** — sitrep/ layout, the 8 canon command files, the hash manifest. Auto-fixes what's safe to create.
2. **File Integrity** — required sections in PROJECT_PLAN.md/STATUS_REPORT.md/MANIFEST.md, valid JSON.
3. **Cross-File Consistency** — phase names, Active Sprint ID references, session-count drift, Current Phase sanity. Report-only.
4. **Progress Accuracy** — recalculates progress bars and cost totals for phases it can confidently compute (skips this project's own Jira-Story-tracked phases rather than guessing).
5. **Codebase Sync** (`deep` only) — git-tag presence for completed phases (auto-fixable), plus a best-effort commit-trace heuristic. Deliberately does not attempt "flag code not tracked in any task" — that needs an LLM's judgment, not deterministic code.

**Lock/diff/restore** (GETSITREP-31) — `lock`/`unlock` accept or resume monitoring on a drifted command MD; `diff` shows it against the canonical version shipped with the CLI; `restore` overwrites it with canonical, refusing without `--force` if it's been customized (the upgrade-protection warning). `<name>` is one of the 8 canon command names, not a file path.
