# Session End Protocol

> Automatic (hook-fired): runs unattended at session end. Must never block — file repair is /selfheal's job, not this command's.

Thin wrapper (GETSITREP-10) over `getsitrep session-end` — the CLI owns the Session Log entry, header updates, `.sitrep-data.json`, the history record, and the commit. This file's only remaining job is the one step no CLI can do on its own: building the session-summary JSON from *this* conversation, since a CLI has no way to know what happened in it.

## Step 1: Build the session summary

From your own knowledge of this session, construct:
```json
{
  "focus": "one-line summary",
  "tasksCompleted": ["3.1"], "tasksInProgress": [], "tasksBlocked": [],
  "blockers": [], "decisions": [],
  "tokens": {"input": N, "output": N, "cacheCreation": N, "cacheRead": N, "total": N},
  "costUsd": N.NN, "costLabel": "actual"|"estimate", "costSource": "ccusage"|"manual_estimate",
  "model": "...", "durationMinutes": N, "user": "...", "notes": "..."
}
```
Every field is optional — omit what you don't know rather than guessing a placeholder that looks precise but isn't.

**Tokens/cost — always label `actual` or `estimate`, never write a bare number:**
- If a configured meter (ccusage/CCUM) or the platform itself reports exact counts → use those, label `actual`.
- Otherwise, estimate from the work actually done this session, label `estimate`:
  - Light (reading, planning, small edits): ~20,000 tokens
  - Medium (1-2 features, some debugging): ~60,000 tokens
  - Heavy (large refactor, many files, extensive debugging): ~150,000 tokens
- Calculate cost from `sitrep/MANIFEST.md`'s pricing table.
- **Subagent-cost awareness:** if this session spawned subagents (Task tool calls), count their token usage too — don't undercount by tracking only the main thread.
- **/compact hygiene:** if auto-compact fired this session, note it in `notes` — a post-compact estimate is a lower bound, not exact.

## Step 2: Call the CLI

```bash
getsitrep session-end --data '<the JSON from Step 1>'
```

Print its output verbatim.
