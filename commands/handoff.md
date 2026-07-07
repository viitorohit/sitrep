# Handoff — Generate Context Package

> Intentional (manually invoked).

Thin wrapper (GETSITREP-10) — generating `sitrep/HANDOFF.md` (archiving the previous one first), tailoring to a human or AI audience, and committing all live in `getsitrep handoff`.

Run:
```bash
getsitrep handoff $ARGUMENTS
```

`$ARGUMENTS` is `human` or `ai` (default `ai` if omitted — the more common case, a new AI session picking up the project).

Print its output verbatim.
