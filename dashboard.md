# Dashboard — Intelligent MIS Report

Generate a self-contained HTML dashboard from sitrep files. This is the management information system for the project. Opens in any browser. No server needed.

## Step 0: Validate and prepare
1. Check if `sitrep/` directory exists. If not → create it.
2. Archive previous dashboard if it exists:
   - Create `sitrep/history/dashboards/` if missing
   - If `sitrep/dashboard.html` exists → copy to `sitrep/history/dashboards/dashboard-session-[N].html`
3. Read all available files. The dashboard renders whatever exists and clearly marks what's missing.
4. The dashboard must NEVER fail. It renders what it can.

---

## Step 1: Read all available data

### Primary sources
- `sitrep/MANIFEST.md` → version info. If missing: version = "unknown"
- `sitrep/PROJECT_PLAN.md` → phases, decisions, risks, future ideas. If missing: show "Not found" warning.
- `sitrep/STATUS_REPORT.md` → progress, sprint, sessions. If missing: show "Not found" warning.
- `sitrep/.sitrep-data.json` → structured data: sessions, costs, tokens, users. If missing: derive what's possible from markdown files and show "Enable cost tracking by running /session-end" message.

### Historical sources
- `sitrep/history/sessions/` → all session detail files
- `sitrep/history/handoffs/` → all archived handoffs
- `sitrep/history/dashboards/` → previous dashboard snapshots (list only, for reference)
- `git log --oneline sitrep/` → last 50 commits on sitrep/

### Derive project name
From PROJECT_PLAN.md heading → fallback to .sitrep-data.json → fallback to repo folder name.

---

## Step 2: Generate dashboard.html

Create `sitrep/dashboard.html` — a single self-contained HTML file. ALL data embedded inline. No external dependencies, no fetch calls, no server. HTML + CSS + inline JS only.

---

### Navigation Bar (sticky top)

Fixed navigation menu at the top of the page:

```
[Project Name]    Summary | Progress | Sprint | Sessions | Costs | Decisions | Risks | Documents | History
```

- Each nav item scrolls to its section (smooth scroll)
- Current section highlighted
- Compact on mobile (hamburger menu)

---

### Section 1: Summary Dashboard (hero section)

A high-level overview panel — this is the first thing anyone sees.

**Left column:**
- Project name (large heading)
- Current phase badge (colored pill)
- sitrep version
- Last updated: date + session number + who

**Center column — Key Metrics (large numbers):**
- Overall progress: `21 / 71 tasks — 30%` with a large colored progress ring or bar
- Sessions completed: total count
- Time invested: total hours across all sessions
- Active blockers: count (red if > 0)

**Right column — Cost Summary:**
- Total cost to date: `$X.XX`
- Average cost per session: `$X.XX`
- Average tokens per session: `~X,XXX`
- Most used model: `claude-sonnet-4`

**Bottom strip — Last Session Quick View:**
- Session [N] — [date] — [user]
- Focus: [one-line]
- Completed: [task IDs]
- Tokens: [total] | Cost: $[N.NN]

---

### Section 2: Progress

**Phase progress bars:**
- One row per phase
- Phase name + status badge (Complete / Active / Upcoming)
- Visual progress bar (colored segments: green = done, yellow = in progress, gray = todo)
- Fraction: `9/9` or `5/8`
- Cost per phase: `$X.XX` (from .sitrep-data.json)
- Sessions spent: count

**Total bar at bottom** spanning full width.

---

### Section 3: Active Sprint

**Table of current sprint tasks:**

| # | Task | Status | Notes |
|---|------|--------|-------|

- Rows color-coded: green (✅), yellow (🟡), white (🔲), red (❌), gray (⏭️)
- Status shown as both emoji and colored badge
- Sort by status (blocked first, then in-progress, then todo, then done)

---

### Section 4: Sessions Timeline

**Two views (tabs):**

**Timeline view:**
- Vertical timeline, newest at top
- Each entry is a card showing:
  - Session number + date + user name (avatar/initial)
  - Focus (one-line)
  - Tasks completed (badges)
  - Tokens used + cost
  - Model used
  - Duration
  - Blockers (red badges if any)

**Table view:**
- Sortable table with all session data
- Columns: Session | Date | User | Focus | Tasks Done | Tokens | Cost | Model | Duration
- Totals row at bottom

---

### Section 5: Costs & Tokens

**Three visualizations (use inline SVG charts or CSS-based charts):**

**5a. Cost over time**
- Bar chart or area chart: X-axis = session numbers, Y-axis = cost in USD
- Running total line overlaid
- Color-code by phase

**5b. Token usage over time**
- Bar chart: X-axis = session numbers, Y-axis = tokens
- Split bars showing input vs output tokens
- Average line

**5c. Cost by phase**
- Horizontal bar chart or pie-like display
- Each phase labeled with total cost and token count
- Shows which phases are expensive

**Summary stats below charts:**
- Total project cost: $X.XX
- Average session cost: $X.XX
- Cheapest session: Session N ($X.XX)
- Most expensive session: Session N ($X.XX)
- Total tokens: X,XXX,XXX
- Projected total cost (based on remaining tasks × average): $X.XX

---

### Section 6: Users

**Team activity panel:**

For each user:
- Name + role
- Total sessions
- Total tokens consumed
- Total cost attributed
- Last active: date
- Tasks completed (count)
- Session list (linked to timeline)

If only one user, still show — this becomes useful when team grows.

---

### Section 7: Decisions Log

- Table from Key Decisions in PROJECT_PLAN.md
- Columns: # | Decision | Rationale | Date
- Sorted by date (newest first)

---

### Section 8: Risks & Blockers

**Two sub-sections:**

**Active Blockers** (from STATUS_REPORT.md)
- Red highlighted cards
- If none: green "No active blockers" badge

**Risk Register** (from PROJECT_PLAN.md)
- Table: Risk | Impact | Mitigation
- Impact color-coded: red (High), yellow (Medium), green (Low)

---

### Section 9: Full Documents (collapsible)

**Project Plan** — render PROJECT_PLAN.md as formatted HTML
- Collapsed by default, click to expand
- If missing: "No PROJECT_PLAN.md found. Run `/plan-update` to create one."

**Status Report** — render STATUS_REPORT.md as formatted HTML
- Collapsed by default, click to expand
- If missing: "No STATUS_REPORT.md found. Run `/session-end` to create one."

Convert markdown: tables → HTML tables, headings → h tags, bold → strong, lists → ul/li, code → pre/code

---

### Section 10: History

**Archived handoffs** (from history/handoffs/)
- List with dates and session numbers
- Each links to the file (relative path)

**Archived dashboards** (from history/dashboards/)
- List with dates and session numbers

**Git log** (sitrep/ commits)
- Last 20 entries: hash, date, message
- Shows the full audit trail

---

### Footer

- Generated by sitrep v[version]
- Generated on [date] at [time]
- Project: [name]
- Report covers sessions 1 through [N]

---

## Design Requirements

- Clean, modern, professional — think Linear/Notion/Vercel dashboard aesthetic
- **Dark mode by default** with a toggle to light mode (top-right)
- **Printable** — use `@media print` CSS: white background, no nav bar, clean tables
- **Mobile-responsive** — stack sections vertically, hamburger nav
- **Single file, target under 80KB** (data is embedded, not external)
- **No external CDN links** — everything inline
- **Smooth scroll** between sections via nav
- Use CSS grid/flexbox for layout
- **Color palette:**
  - Dark bg: `#0f0f1a`
  - Card bg: `#1a1a2e`
  - Text: `#e0e0e0`
  - Accent blue: `#4361ee`
  - Green (done/success): `#06d6a0`
  - Yellow (in progress/warning): `#ffd166`
  - Red (blocked/danger): `#ef476f`
  - Gray (todo/muted): `#6c757d`
- **Charts:** Use inline SVG or pure CSS bars. No chart libraries. Keep it simple and lightweight.
- **Typography:** System font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)

---

## Step 3: Confirm and commit

Print:
```
=== [PROJECT] DASHBOARD ===
File: sitrep/dashboard.html
Open: file://[absolute path to dashboard.html]
Archived: [previous dashboard path or "none"]

Sections: Summary, Progress, Sprint, Sessions, Costs, Users, Decisions, Risks, Documents, History
Data: [N] sessions, [N] users, $[X.XX] total cost

Open in your browser to view the Intelligent MIS.
Print: Cmd+P / Ctrl+P for a clean printout.
============================
```

Commit:
```bash
git add sitrep/
git commit -m "sitrep: dashboard — session [N]"
```
