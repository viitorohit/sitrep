# sitrep — Master Project Plan

> **Project:** sitrep
> **Owner:** Rohit
> **Started:** 2026-03-11
> **Last Updated:** 2026-07-08
> **Roadmap source of truth:** Jira project GETSITREP (Epics GETSITREP-1/2/3 = v0.3/v0.4/v0.5). This file mirrors Jira — if they diverge, Jira wins. See CLAUDE.md Sources of Truth.

---

## Product Vision

sitrep is the operations, cost, and continuity layer for AI-assisted development. It sits **beside** existing planning tools (Jira, OpenSpec, Spec Kit) — never replaces them. It gives solo developers and vibe coders session continuity, cost visibility, and progress tracking — all inside their repo, with zero dependencies.

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

## Phase 3: Sharper & Self-Sufficient — `v0.3.0` 🟡 In Progress

> **Jira Epic:** GETSITREP-1. Make sitrep platform-agnostic, self-sufficient, and honest about what it measures — before any traffic-driving content ships.

**Hard architectural laws (apply to all releases, not just this one):** no agentic-platform lock-in · every cost figure labeled `actual`/`estimate` · zero-dependency core is sacred · CLAUDE.md/AGENTS.md are factual context only, never imperative · sitrep never blocks a workflow (fail-open, idempotent, non-interactive hooks).

**Multi-platform commitment (2026-07-02):** Claude Code, Codex, Cursor adapters from day one; Copilot/VS Code conditional on GETSITREP-38.

### Tier 0 — parallel, no dependencies ✅ shipped

| Story | Component | Goal | Status |
|---|---|---|---|
| GETSITREP-4 — Confirm cost data sources & schema | `cost` | Define schema before any cost code is written; actual vs estimate labeling | ✅ Done (PR #2) |
| GETSITREP-13 — Refresh command MDs, canon per signed audit | `commands` | 9 − pulse − doctor + dashboard (relocated from root) = 8. Audit (2026-07-02) found doctor≈selfheal duplicate + misplaced dashboard.md. Binding spec: Command MD Audit (Confluence) → mirrored to `docs/specs/command-canon.md`. | ✅ Done (PR #1) |
| GETSITREP-36 — Adapter contract | `cli-core` | Plan/cost/auto-run interfaces, all optional; 3 committed platforms + Copilot conditional | ✅ Done (PR #3) |

### Tier 1 — needs Tier 0 (shipped) ✅ shipped

| Story | Component | Goal | Status |
|---|---|---|---|
| GETSITREP-8 — Platform-agnostic core/CLI extraction | `cli-core` | Move all logic into a real CLI; slash commands become thin wrappers | ✅ Done (PR #4; subtasks GETSITREP-9/10/12 all Done) |
| GETSITREP-28 — selfheal: MD-drift + upgrade protection | `selfheal` | Hash manifest, drift report, lock/diff/restore; absorbs doctor's role | ✅ Done (subtasks GETSITREP-29/30/31; reopened+resolved GETSITREP-10's thin-wrapper conversion alongside, PR #6) |

### Tier 2 — needs GETSITREP-8 (shipped) ✅ shipped

| Story | Component | Goal | Status |
|---|---|---|---|
| GETSITREP-17 — CLI onboarding wizard + config | `onboarding` | `getsitrep init`: plan source + cost source + tools in use; residue-detection/restore (GETSITREP-39) | ✅ Done |
| GETSITREP-21 — Auto-run adapters | `onboarding` | SessionStart + SessionEnd hook writers per platform + AGENTS.md factual nudge; Codex spike | ✅ Done (Copilot/VS Code, GETSITREP-38, explicitly deferred — reuse-path unverified) |
| GETSITREP-25 — Plan-presence guard | `cli-core` | If no plan found, offer to generate one from repo introspection | ✅ Done |

### Tier 3 — pre-launch gate

| Story | Component | Goal | Status |
|---|---|---|---|
| GETSITREP-32 — Housekeeping | `docs` | README says "eight" commands, publish v0.2 GitHub release, npm source visible in public repo | ✅ Merged to main (PR #10) — Jira status still In Review, Done transition pending session-owner approval |

**Explicitly OUT of v0.3** (deferred to v0.4+): cost-to-outcome pipeline, Jira read-adapter, activity attribution, business brief, nudge engine (GETSITREP-35), adoption nudge (GETSITREP-40).

**v0.3 build order complete:** all 9 Stories shipped/merged to main as of 2026-07-07 (Tier 0-3). Also merged this close-out: GETSITREP-47, a selfheal bugfix found during dogfooding (PR #11), not part of the original 9 but landed in the same window.

**Definition of Done:** fresh `getsitrep init` on a bare repo → working config + hooks in under 2 minutes; all 8 command MDs pass the audit's cross-cutting rules; `selfheal --verify` flags manual edits; SessionStart/SessionEnd auto-fire with zero typing on Claude Code, Codex, Cursor; no hook ever blocks a session; public repo is traffic-ready.

---

## Phase 4: Cost-to-Outcome & Beside — `v0.4.0` 🟡 In Progress

> **Jira Epic:** GETSITREP-2. The category-flag release — no other SDD tool or meter maps spend to shipped outcome. Broken into 9 Stories on 2026-07-08 (previously titles only).

### Tier 0 — parallel, no dependencies ✅ shipped

| Story | Component | Goal | Status |
|---|---|---|---|
| GETSITREP-48 — Cost-to-outcome pipeline | `cost` | Ingest ccusage/CCUM or thin local-log; attribute spend to plan phase/ticket | ✅ Done (PR #13) |
| GETSITREP-49 — Native + file-based plan adapter | `cli-core` | Read PROJECT_PLAN.md / OpenSpec / Spec Kit as plan source | ✅ Done (PR #14) |
| GETSITREP-35 — Proactive command advisor | `nudge` | Mid-session opportunity nudges for 6 commands, 4 implemented on real signals (selfheal drift, dashboard staleness, capture/handoff/sitrep tick-based proxies) | ✅ Done (PR #15) |

### Tier 1 — needs Tier 0 (shipped) — unblocked

| Story | Component | Goal | Status |
|---|---|---|---|
| GETSITREP-50 — Tool-neutral, agent-mediated integration | `cli-core` | Redesigned from "Jira REST adapter" (rejected twice in review) to: declarative AGENTS.md relay + generic `readExternalPlan()` read-back via `--plan-data`. sitrep never custodies credentials for any tool. ADR-0006. | ✅ Done (PR #17) |
| GETSITREP-51 — Read/report commands | `cli-core` | `getsitrep report`, `plan --phase N`, `progress` — source-agnostic across whichever adapter is configured | 🔲 To Do — recommended next |
| GETSITREP-42 — Dashboard improvements | `dashboard` | Cost-over-time charts, session timeline, print CSS. Needs GETSITREP-48's rollup (shipped). | 🔲 To Do |
| GETSITREP-44 — Model cost comparison | `cost` | Per-model cost/token breakdown in sitrep/dashboard/session logs | 🔲 To Do |

### Tier 2 — needs Tier 1

| Story | Component | Goal | Status |
|---|---|---|---|
| GETSITREP-52 — Scoped conflict check | `selfheal` | Plan-vs-reality divergence + contradicted-decision flags, extension of selfheal. NOT full multi-agent conflict resolution. | 🔲 To Do |

### Tier 3 — pre-launch gate

| Story | Component | Goal | Status |
|---|---|---|---|
| GETSITREP-53 — Cost optimization advisory | `cost` | e.g. "Phase 3 cost 3× Phase 2 for similar scope," tied to outcome data. Needs GETSITREP-48 mature. | 🔲 To Do |

**Explicitly OUT of v0.4:** business brief, adoption nudge (GETSITREP-40), context-hygiene nudge family (deferred pending unverified per-platform telemetry — see GETSITREP-35's PR), headless/no-agent credential fallback for external integrations (deferred per ADR-0006).

**Definition of Done:** `getsitrep report`/`progress`/`plan --phase N` work against any configured plan source; dashboard shows real cost/token charts; sitrep never stores/transmits a credential for any integration, verified via repo-wide grep, not just asserted.

---

## Phase 5: Business Brief & Breadth — `v0.5.0` (planned)

> **Jira Epic:** GETSITREP-3. Depends on v0.4 shipping (the cost-to-outcome pipeline is the data this release's brief generator reports on). The ViitorCloud halo feature — the only tool in this lane producing a brief a non-technical stakeholder can read unassisted.

| Planned capability | What it does |
|---|---|
| Business-user brief generator (`/brief`) | Session + project brief in executive language: what shipped, what it cost, what's next, risks |
| AGENTS.md adapter for non-Claude tools | Cost side largely free (meter already covers ~14 tools); plan/command side via the AGENTS.md cross-tool standard — Cursor (`.cursor/rules`) + Copilot (`.github/instructions`) shims |
| Pricing update (`getsitrep pricing update`) | Manual pull of a maintained pricing JSON — pull not push, zero auto-dependency |
| HTML onboarding form | Richer intake option; CLI wizard from v0.3 remains the default |

**Explicitly OUT of v0.5** (deferred to v1.0+): multi-dev concurrency, GitHub Actions integration, hosted/cloud version, true multi-agent context conflict resolution.

*Titles only — Stories not yet broken into subtasks. Authoritative scope: Jira Epic GETSITREP-3.*

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

> Architecturally-significant decisions from v0.3 onward are recorded as ADRs in `docs/adr/` (see CLAUDE.md decision log) rather than added to this table.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Complexity creep | High | 8 commands max for v0.x (canon locked by GETSITREP-13, shipped). New features must justify token cost. |
| Low npm adoption | Medium | LinkedIn build-in-public, dogfood on Atlas, submit to awesome lists |
| Competitor copies the approach | Low | Speed + community + brand. First mover in AI PM space. |
| Dashboard HTML too large | Medium | Target under 80KB. CSS-only charts, no libraries. |
| CLAUDE.md format changes | Low | Bootstrap reads generically, not format-specific |

---

## Future / Post-MVP Ideas (v1.0+, not yet in Jira)

> Engineering ideas explicitly named as deferred to v1.0+ in the v0.5 Epic, plus marketing/growth activities not yet formalized as Jira Epics.

| # | Idea | Notes |
|---|------|-------|
| F.1 | Revenue model (Pro tier?) | |
| F.2 | VS Code extension | |
| F.3 | Team analytics dashboard | |
| F.4 | Multi-developer support (merge-safe session logging) | Explicitly OUT of v0.5, deferred to v1.0+ |
| F.5 | GitHub Actions integration | Explicitly OUT of v0.5, deferred to v1.0+ |
| F.6 | Hosted/cloud version, live web dashboard | Explicitly OUT of v0.5, deferred to v1.0+ |
| F.7 | True multi-agent context conflict resolution | Explicitly OUT of v0.5, deferred to v1.0+ |
| F.8 | Smart init with codebase scanning | |
| F.9 | Plugin system (custom commands and checks) | |
| F.10 | Submit to awesome-claude-code, Product Hunt, HN Show HN, Dev.to/Hashnode tutorials, community feedback loop | Marketing/growth — not yet in Jira |

