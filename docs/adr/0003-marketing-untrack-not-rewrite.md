# ADR-0003: marketing/ — Untrack Going Forward, Not a History Rewrite

**Status:** Accepted
**Date:** 2026-07-03

## Context
Repo audit (2026-07-03) found `marketing/` (PLAYBOOK.md, COMPARISON.md) tracked and public on `origin/main` since it was first committed. The old CLAUDE.md claimed "marketing folder is gitignored (private)" — false, because `.gitignore` itself had never been committed. Nothing had actually been ignored at any point.

Options considered:
1. Full history rewrite (`git filter-repo`, force-push) — removes `marketing/` from all history going back.
2. Untrack only (`git rm --cached`) — stops future tracking, old versions remain in history.
3. Accept as public, no action.

## Decision
Option 2: untrack only. `marketing/` is removed from tracking and added to `.gitignore`. Git history is left intact.

## Consequences
- Old versions of `PLAYBOOK.md`/`COMPARISON.md` remain visible in git history and in any existing forks/clones indefinitely — this decision does not achieve retroactive removal.
- Directly preserves ADR-0001 (build-in-public history is the brand asset) — a rewrite would have altered commit SHAs across most of the repo's history to protect content that is positioning strategy, not credentials or genuine competitive secrets. The trade was judged not worth it.
- A rewrite would not have fully solved the exposure anyway (existing forks/clones/caches retain old content regardless), so option 1 traded a real principle for an incomplete guarantee.
