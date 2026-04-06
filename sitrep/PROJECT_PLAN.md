# sitrep — Master Project Plan

> **Project:** sitrep
> **Owner:** Rohit
> **Started:** 2026-03-11
> **Last Updated:** 2026-04-06

---

## Product Vision

sitrep is the project management framework built for AI-assisted development. It gives solo developers and vibe coders session continuity, cost visibility, and progress tracking — all inside their repo, with zero dependencies.

**Tech Stack:** Node.js (CLI) · Markdown (commands + data) · HTML (dashboard) · Git (versioning)

---

## Phase 1: Foundation — `v0.1.0` ✅

> Core commands and npm package

| # | Feature | Description |
|---|---------|-------------|
| 1.1 | 5 slash commands | session-start, session-end, sitrep, plan-update, doctor |
| 1.2 | PROJECT_PLAN.md template | Blank template for new projects |
| 1.3 | STATUS_REPORT.md template | Blank template for new projects |
| 1.4 | install.sh | curl-based installer |
| 1.5 | npm package (getsitrep) | npx getsitrep init |
| 1.6 | GitHub repo | viitorohit/sitrep |
| 1.7 | README.md | Public-facing documentation |
| 1.8 | MIT License | Open source |

---

## Phase 2: Operations Layer — `v0.2.0` ✅

> Cost tracking, dashboard, handoffs, session awareness

| # | Feature | Description |
|---|---------|-------------|
| 2.1 | /capture command | Add tasks mid-session (replaced /task-add) |
| 2.2 | /selfheal command | Health check + auto-fix (replaced /doctor) |
| 2.3 | /handoff command | Context package with auto-archiving |
| 2.4 | /dashboard command | Visual MIS HTML report (10 sections) |
| 2.5 | /pulse command | Session command status + next suggestion |
| 2.6 | MANIFEST.md | Self-documenting framework reference |
| 2.7 | .sitrep-data.json | Machine-readable cost/token/user data |
| 2.8 | history/ folder | Archived sessions, handoffs, dashboards |
| 2.9 | Cost tracking | Per-session token + cost logging |
| 2.10 | User tracking | Who did what, when |
| 2.11 | First-run bootstrap | Reads CLAUDE.md to auto-populate on fresh install |
| 2.12 | npm v0.2.0 publish | Updated package with 9 commands |
| 2.13 | USAGE_GUIDE.md | 15 use cases documented |
| 2.14 | LinkedIn Article 1 | "I Replaced My Entire Dev Team With 3 AI Tools" |
| 2.15 | Domain: getsitrep.dev | Purchased |

---

## Phase 3: Onboarding & Polish — `v0.3.0`

> Make first experience frictionless

| # | Feature | Description |
|---|---------|-------------|
| 3.1 | HTML intake form | Browser-based project brief capture |
| 3.2 | Import existing plans | Paste PRD/brief → sitrep generates plan |
| 3.3 | Session awareness integration | All commands write to .sitrep-active-session |
| 3.4 | Dashboard improvements | Cost charts, session timeline, print CSS |
| 3.5 | getsitrep.dev landing page | Product website |
| 3.6 | LinkedIn Article 2 | "The npm Package I Built to Stop Wasting AI Tokens" |

---

## Phase 4: Community & Growth — `v0.4.0`

> Build the user base

| # | Feature | Description |
|---|---------|-------------|
| 4.1 | Submit to awesome-claude-code | Get listed in the curated list |
| 4.2 | Product Hunt launch | Ship page + launch post |
| 4.3 | Hacker News Show HN | "Show HN: sitrep — AI-native project management" |
| 4.4 | Dev.to / Hashnode tutorials | Technical how-to articles |
| 4.5 | GitHub Actions integration | Auto-update on PR merge |
| 4.6 | Community feedback loop | Issues → features pipeline |

---

## Phase 5: Scale — `v1.0.0`

> Production-ready for teams

| # | Feature | Description |
|---|---------|-------------|
| 5.1 | Multi-developer support | Merge-safe session logging |
| 5.2 | Smart init with codebase scanning | Infer project state from code |
| 5.3 | Plugin system | Custom commands and checks |
| 5.4 | Multi-project unified view | Track several repos from one place |
| 5.5 | Web dashboard (live) | Real-time progress, not static HTML |
| 5.6 | Cursor / Copilot integration | Beyond Claude Code |

---

## Key Decisions

| # | Decision | Rationale | Date |
|---|----------|-----------|------|
| 1 | Zero dependencies | Simplicity, trust, no supply chain risk | 2026-03-11 |
| 2 | Markdown-first | AI tools read/write markdown natively | 2026-03-11 |
| 3 | Named "sitrep" | Military precision, memorable, unique in AI PM space | 2026-03-12 |
| 4 | Personal GitHub (viitorohit) not org | Solo builder, ties to personal brand | 2026-03-12 |
| 5 | MIT license | Maximum adoption | 2026-03-12 |
| 6 | /doctor → /selfheal rename | Avoid conflict with system tools | 2026-03-13 |
| 7 | /task-add → /capture rename | Avoid conflict with generic task commands | 2026-03-13 |
| 8 | First-run bootstrap from CLAUDE.md | Solves blank template problem on existing projects | 2026-03-13 |
| 9 | .sitrep-initialized flag | Prevents token waste on repeated session starts | 2026-03-13 |

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complexity creep | High | 9 commands max for v0.x. New features must justify token cost. |
| Low npm adoption | Medium | LinkedIn build-in-public, dogfood on Atlas, submit to awesome lists |
| Competitor copies the approach | Low | Speed + community + brand. First mover in AI PM space. |
| Dashboard HTML too large | Medium | Target under 80KB. CSS-only charts, no libraries. |
| CLAUDE.md format changes | Low | Bootstrap reads generically, not format-specific |

---

## Future / Post-MVP Ideas

| # | Idea | Priority | Target |
|---|------|----------|--------|
| F.1 | Revenue model (Pro tier?) | High | v1.0+ |
| F.2 | VS Code extension | Medium | v1.0+ |
| F.3 | Team analytics dashboard | Medium | v1.0+ |
| F.4 | AI model comparison (cost per model) | Low | v0.4 |
| F.5 | Webhook notifications (Slack, email) | Low | v1.0+ |
| F.6 | CLI dashboard (terminal UI) | Low | v0.5 |
