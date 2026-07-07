# Dashboard — Intelligent MIS Report

> Intentional (manually invoked).

Generate a self-contained HTML dashboard from sitrep files. Opens in any browser, no server needed.

Thin wrapper (GETSITREP-10) — reading every data source, rendering every section, and archiving the previous dashboard all live in `getsitrep dashboard` (`src/commands/dashboard.js` is the single source of truth; this file is a pointer to it, not a second copy of its logic).

Run:
```bash
getsitrep dashboard
```

Print its output verbatim, then tell the user to open `sitrep/dashboard.html` in a browser.

---

## What it renders (reference — see the CLI source for exact detail)

Summary, Progress (per-phase bars), Active Sprint (color-coded by status), Sessions, Costs & Tokens (inline SVG bar charts: cost/session, tokens/session, cost/phase), Users, Decisions, Risks, Full Documents (PROJECT_PLAN.md/STATUS_REPORT.md rendered inline, collapsible), and History (archived handoffs/dashboards, git log for `sitrep/`). Sticky nav with smooth scroll, light/dark toggle, print-friendly, single file under the 80KB target. Never fails — renders "not found"/"none yet" for anything missing rather than erroring.
