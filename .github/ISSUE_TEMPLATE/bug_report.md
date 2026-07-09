---
name: Bug report
about: Something in sitrep isn't working as documented
title: ""
labels: bug
---

**What happened**
A clear description of what went wrong.

**What you expected**
What should have happened instead.

**To reproduce**
Exact command(s) run, e.g.:
```bash
getsitrep session-end --data '{"focus":"..."}'
```

**Environment**
- sitrep version: check `node_modules/getsitrep/package.json`'s `version` field, or `npm list getsitrep`
- Node version: `node --version`
- AI tool (if relevant): Claude Code / Codex / Cursor / other
- OS:

**Relevant output**
Paste the command's output, or the relevant section of `sitrep/STATUS_REPORT.md`/`.sitrep-data.json` if it's a data-integrity issue. Redact anything sensitive first.
