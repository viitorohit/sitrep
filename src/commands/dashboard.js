// Intentional (manually invoked) per docs/specs/command-canon.md.
//
// Scope note: renders all 10 sections from commands/dashboard.md's design —
// Summary, Progress, Active Sprint, Sessions, Costs (with inline SVG
// charts), Users, Decisions, Risks, Full Documents (collapsible), and
// History. Nav bar (sticky, smooth-scroll via CSS, not JS) and a light/dark
// toggle are included per the MD's "Design Requirements"; the MD's mobile
// "hamburger menu" is deliberately simplified to a nav bar that wraps on
// narrow screens instead of a JS-driven collapse — same visual outcome
// (compact on mobile), less code. Per the MD's own design requirement, this
// must never fail — every section renders "not found"/"none yet" rather
// than throwing when its source is missing.

const { parseArgs } = require('../lib/args');
const { ok } = require('../lib/result');
const { readIfExists, readJsonIfExists, writeFile, ensureDir, exists } = require('../lib/fs-helpers');
const {
  extractProjectName,
  extractVersion,
  extractHeaderField,
  findKeyDecisionsTable,
  findRiskRegisterTable,
  findTableAfterHeading,
  splitRowCells,
  extractProgressDashboardTable,
} = require('../lib/markdown');
const paths = require('../lib/paths');
const { commit, logForPath } = require('../lib/git');
const path = require('path');
const fs = require('fs');

const SPEC = {};

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Minimal, line-based markdown -> HTML for the Full Documents section.
// Deliberately not a full parser (same philosophy as lib/markdown.js) —
// covers headings, bold, inline code, blockquotes, lists, and tables, which
// is everything this project's own PROJECT_PLAN.md/STATUS_REPORT.md use.
function inlineMd(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function mdToHtml(content) {
  if (!content) return '<p><em>Not found.</em></p>';
  const lines = content.split('\n');
  const out = [];
  let i = 0;
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^\s*\|.*\|\s*$/.test(line) && lines[i + 1] && /^\s*\|[-\s|:]+\|\s*$/.test(lines[i + 1])) {
      closeList();
      const headerCells = splitRowCells(line);
      out.push('<table><thead><tr>' + headerCells.map((c) => `<th>${inlineMd(c)}</th>`).join('') + '</tr></thead><tbody>');
      i += 2;
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = splitRowCells(lines[i]);
        out.push('<tr>' + cells.map((c) => `<td>${inlineMd(c)}</td>`).join('') + '</tr>');
        i++;
      }
      out.push('</tbody></table>');
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      closeList();
      const level = headingMatch[1].length;
      out.push(`<h${level}>${inlineMd(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    if (/^>\s?/.test(line)) {
      closeList();
      out.push(`<blockquote>${inlineMd(line.replace(/^>\s?/, ''))}</blockquote>`);
      i++;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`);
      i++;
      continue;
    }

    closeList();
    if (line.trim() === '' || line.trim() === '---') {
      i++;
      continue;
    }
    out.push(`<p>${inlineMd(line)}</p>`);
    i++;
  }
  closeList();
  return out.join('\n');
}

function tableRowsToHtml(rows, columnCount) {
  if (!rows.length) return `<tr><td colspan="${columnCount}">None recorded</td></tr>`;
  return rows
    .map((row) => {
      const cells = splitRowCells(row);
      return `<tr>${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`;
    })
    .join('\n');
}

// Color-codes Active Sprint rows by their Status cell's emoji, same status
// vocabulary as MANIFEST.md's Status Codes table.
function activeSprintRowsToHtml(rows) {
  if (!rows.length) return '<tr><td colspan="4">No active sprint tasks</td></tr>';
  return rows
    .map((row) => {
      const cells = splitRowCells(row);
      const statusCell = cells[2] || '';
      let cls = 'status-todo';
      if (statusCell.includes('✅')) cls = 'status-done';
      else if (statusCell.includes('🟡')) cls = 'status-progress';
      else if (statusCell.includes('❌')) cls = 'status-blocked';
      else if (statusCell.includes('⏭️')) cls = 'status-deferred';
      return `<tr class="${cls}">${cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`;
    })
    .join('\n');
}

// Renders whatever the Progress Dashboard table already has, whether a
// phase's Tasks/Done are plain integers ("8/8") or this project's own
// hybrid Jira-Story tracking ("4/9 Stories") — STATUS_REPORT.md always
// carries a pre-computed bar+percentage text regardless of which shape a
// phase uses, so display doesn't need to recompute anything (unlike
// selfheal's Check 4, which only auto-fixes the plain-integer case).
function progressRowsToHtml(dashboardRows) {
  const rows = (dashboardRows || []).filter((r) => !r.isTotal);
  if (!rows.length) return '<p>No phases recorded yet.</p>';
  return rows
    .map((row) => {
      const percentMatch = (row.barRaw || '').match(/(\d+)\s*%/);
      const percent = percentMatch ? parseInt(percentMatch[1], 10) : 0;
      return `<div class="phase-row">
        <div class="phase-label"><strong>Phase ${row.phase}: ${esc(row.name)}</strong> — ${esc(row.doneRaw)}/${esc(row.tasksRaw)}</div>
        <div class="phase-bar-track"><div class="phase-bar-fill" style="width:${percent}%"></div></div>
      </div>`;
    })
    .join('\n');
}

function usersToHtml(users) {
  if (!users || !users.length) return '<p>No users recorded yet.</p>';
  return `<div class="metrics">${users
    .map(
      (u) => `<div class="metric">
      <div class="value">${(u.sessions || []).length}</div>
      <div class="label">${esc(u.name)} — sessions</div>
      <div class="label">${(u.total_tokens || 0).toLocaleString('en-US')} tokens · $${(u.total_cost_usd || 0).toFixed(2)}</div>
    </div>`
    )
    .join('\n')}</div>`;
}

function historySectionToHtml({ handoffs, dashboards, commits }) {
  const list = (items, empty) => (items.length ? `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>` : `<p>${empty}</p>`);
  const handoffsList = list(
    handoffs.map((f) => esc(f)),
    'No archived handoffs yet.'
  );
  const dashboardsList = list(
    dashboards.map((f) => esc(f)),
    'No archived dashboards yet.'
  );
  const commitsList = list(
    commits.map((c) => `<code>${esc(c.hash)}</code> ${esc(c.date)} — ${esc(c.subject)}`),
    'No commits found for sitrep/.'
  );
  return `
    <h3>Archived Handoffs</h3>
    ${handoffsList}
    <h3>Archived Dashboards</h3>
    ${dashboardsList}
    <h3>Git Log (sitrep/, last 20)</h3>
    ${commitsList}
  `;
}

// Simple vertical bar chart, one bar per value. No chart library, per the
// MD's design requirement — just positioned <rect>/<text> elements.
function svgBarChart({ values, labels, color, width = 640, height = 160 }) {
  if (!values.length) return '<p><em>No data yet.</em></p>';
  const max = Math.max(...values, 1);
  const barWidth = width / values.length;
  const bars = values
    .map((v, idx) => {
      const barHeight = (v / max) * (height - 24);
      const x = idx * barWidth + barWidth * 0.15;
      const y = height - barHeight - 20;
      const w = barWidth * 0.7;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(barHeight, 0).toFixed(1)}" fill="${color}" />
<text x="${(x + w / 2).toFixed(1)}" y="${height - 6}" font-size="9" fill="#999" text-anchor="middle">${esc(labels[idx] ?? '')}</text>`;
    })
    .join('\n');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="bar chart">${bars}</svg>`;
}

// Two-series stacked bar chart (input tokens bottom, output tokens on top).
function svgStackedBarChart({ bottomValues, topValues, labels, bottomColor, topColor, width = 640, height = 160 }) {
  if (!bottomValues.length) return '<p><em>No data yet.</em></p>';
  const totals = bottomValues.map((v, i) => v + (topValues[i] || 0));
  const max = Math.max(...totals, 1);
  const barWidth = width / bottomValues.length;
  const bars = bottomValues
    .map((bottomV, idx) => {
      const topV = topValues[idx] || 0;
      const bottomH = (bottomV / max) * (height - 24);
      const topH = (topV / max) * (height - 24);
      const x = idx * barWidth + barWidth * 0.15;
      const w = barWidth * 0.7;
      const bottomY = height - 20 - bottomH;
      const topY = bottomY - topH;
      return `<rect x="${x.toFixed(1)}" y="${bottomY.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(bottomH, 0).toFixed(1)}" fill="${bottomColor}" />
<rect x="${x.toFixed(1)}" y="${topY.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(topH, 0).toFixed(1)}" fill="${topColor}" />
<text x="${(x + w / 2).toFixed(1)}" y="${height - 6}" font-size="9" fill="#999" text-anchor="middle">${esc(labels[idx] ?? '')}</text>`;
    })
    .join('\n');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="stacked bar chart">${bars}</svg>`;
}

// Horizontal bar chart — used for cost-by-phase, where labels (phase names)
// are long and read better left-aligned than under a vertical bar.
function svgHorizontalBarChart({ values, labels, color, width = 640, barHeight = 22, gap = 10 }) {
  if (!values.length) return '<p><em>No data yet.</em></p>';
  const max = Math.max(...values, 1);
  const labelWidth = 180;
  const chartWidth = width - labelWidth - 70;
  const height = values.length * (barHeight + gap) + gap;
  const bars = values
    .map((v, idx) => {
      const y = gap + idx * (barHeight + gap);
      const w = (v / max) * chartWidth;
      return `<text x="0" y="${(y + barHeight * 0.7).toFixed(1)}" font-size="11" fill="#e0e0e0">${esc(labels[idx] ?? '')}</text>
<rect x="${labelWidth}" y="${y.toFixed(1)}" width="${Math.max(w, 0).toFixed(1)}" height="${barHeight}" fill="${color}" />
<text x="${(labelWidth + w + 8).toFixed(1)}" y="${(y + barHeight * 0.7).toFixed(1)}" font-size="11" fill="#999">$${v.toFixed(2)}</text>`;
    })
    .join('\n');
  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="horizontal bar chart">${bars}</svg>`;
}

// 'actual' only if every recorded session's cost is actual; otherwise the
// aggregate total is a blend and must be labeled 'estimate' rather than
// presented as a bare, unlabeled number (docs/specs/cost-schema.md).
function costLabelForSessions(sessions) {
  if (!sessions.length) return null;
  const allActual = sessions.every((s) => s.cost_label === 'actual');
  return allActual ? 'actual' : 'estimate';
}

function buildHtml({
  projectName,
  version,
  lastUpdated,
  currentPhase,
  overall,
  dataJson,
  decisionsRows,
  riskRows,
  activeSprintRows,
  planContent,
  statusContent,
  handoffs,
  dashboards,
  commits,
}) {
  const sessions = (dataJson && dataJson.sessions) || [];
  const users = (dataJson && dataJson.users) || [];
  const phases = (dataJson && dataJson.phases) || [];
  const totals = (dataJson && dataJson.totals) || {};
  const progressDashboard = extractProgressDashboardTable(statusContent);
  const chronological = sessions.slice();
  const sessionRows = sessions
    .slice()
    .reverse()
    .map(
      (s) =>
        `<tr><td>${s.number}</td><td>${esc(s.date)}</td><td>${esc(s.user)}</td><td>${esc(s.focus)}</td><td>${s.tokens?.total ?? 0}</td><td>$${(s.cost_usd ?? 0).toFixed(2)} (${s.cost_label || 'estimate'})</td><td>${esc(s.model || '')}</td></tr>`
    )
    .join('\n');

  const mostExpensive = sessions.length
    ? sessions.reduce((a, b) => ((b.cost_usd || 0) > (a.cost_usd || 0) ? b : a))
    : null;
  const cheapest = sessions.length
    ? sessions.reduce((a, b) => ((b.cost_usd || 0) < (a.cost_usd || 0) ? b : a))
    : null;
  const costLabel = costLabelForSessions(sessions) || 'estimate';

  const costChart = svgBarChart({
    values: chronological.map((s) => s.cost_usd || 0),
    labels: chronological.map((s) => `#${s.number}`),
    color: '#06d6a0',
  });
  const tokensChart = svgStackedBarChart({
    bottomValues: chronological.map((s) => s.tokens?.input || 0),
    topValues: chronological.map((s) => s.tokens?.output || 0),
    labels: chronological.map((s) => `#${s.number}`),
    bottomColor: '#4361ee',
    topColor: '#ffd166',
  });
  const costByPhaseChart = svgHorizontalBarChart({
    values: phases.map((p) => p.cost_usd || 0),
    labels: phases.map((p) => p.name || `Phase ${p.number}`),
    color: '#ef476f',
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(projectName)} — Dashboard</title>
<style>
  :root { color-scheme: dark; }
  html { scroll-behavior: smooth; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; margin: 0; padding: 0 24px 24px; }
  body.light { background: #f7f7fb; color: #1a1a2e; }
  h1, h2, h3 { color: #fff; }
  body.light h1, body.light h2, body.light h3 { color: #111; }
  section { margin-bottom: 32px; scroll-margin-top: 60px; }
  table { width: 100%; border-collapse: collapse; background: #1a1a2e; }
  body.light table { background: #fff; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #333; font-size: 14px; }
  body.light th, body.light td { border-bottom: 1px solid #ddd; }
  th { color: #4361ee; }
  .metrics { display: flex; gap: 24px; flex-wrap: wrap; }
  .metric { background: #1a1a2e; padding: 16px 24px; border-radius: 8px; min-width: 160px; }
  body.light .metric { background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .metric .value { font-size: 28px; font-weight: bold; color: #06d6a0; }
  .metric .label { font-size: 12px; color: #999; }
  .status-done { background: rgba(6, 214, 160, 0.1); }
  .status-progress { background: rgba(255, 209, 102, 0.1); }
  .status-blocked { background: rgba(239, 71, 111, 0.1); }
  .status-deferred { background: rgba(108, 117, 125, 0.15); }
  .phase-row { margin-bottom: 14px; }
  .phase-label { font-size: 14px; margin-bottom: 4px; }
  .phase-bar-track { background: #1a1a2e; border-radius: 4px; height: 10px; overflow: hidden; }
  body.light .phase-bar-track { background: #e5e5ef; }
  .phase-bar-fill { background: #06d6a0; height: 100%; }
  .topnav { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 12px 0; background: #0f0f1a; border-bottom: 1px solid #333; margin-bottom: 24px; }
  body.light .topnav { background: #f7f7fb; border-bottom: 1px solid #ddd; }
  .topnav .brand { font-weight: bold; margin-right: 8px; }
  .topnav a { color: #999; text-decoration: none; font-size: 13px; }
  .topnav a:hover { color: #4361ee; }
  .topnav button { margin-left: auto; background: none; border: 1px solid #333; color: inherit; border-radius: 6px; padding: 4px 10px; cursor: pointer; }
  details { background: #1a1a2e; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px; }
  body.light details { background: #fff; }
  summary { cursor: pointer; font-weight: bold; }
  @media print { .topnav { display: none; } body { background: #fff; color: #000; } .metric, table { background: #fff; } }
  @media (max-width: 600px) { .metrics { flex-direction: column; } .topnav { position: static; } }
</style>
</head>
<body>
  <nav class="topnav">
    <span class="brand">${esc(projectName)}</span>
    <a href="#summary">Summary</a>
    <a href="#progress">Progress</a>
    <a href="#sprint">Sprint</a>
    <a href="#sessions">Sessions</a>
    <a href="#costs">Costs</a>
    <a href="#users">Users</a>
    <a href="#decisions">Decisions</a>
    <a href="#risks">Risks</a>
    <a href="#documents">Documents</a>
    <a href="#history">History</a>
    <button onclick="document.body.classList.toggle('light')" aria-label="Toggle light/dark theme">☾/☀</button>
  </nav>

  <section id="summary">
    <h2>Summary</h2>
    <p><strong>Phase:</strong> ${esc(currentPhase)}</p>
    <p><strong>Overall:</strong> ${esc(overall)}</p>
    <div class="metrics">
      <div class="metric"><div class="value">${totals.sessions || 0}</div><div class="label">Sessions</div></div>
      <div class="metric"><div class="value">${(totals.hours || 0).toFixed(1)}h</div><div class="label">Time invested</div></div>
      <div class="metric"><div class="value">$${(totals.cost_usd || 0).toFixed(2)}</div><div class="label">Total cost to date (${costLabel})</div></div>
      <div class="metric"><div class="value">${totals.tasks_done || 0}${totals.tasks_total ? ` / ${totals.tasks_total}` : ''}</div><div class="label">Tasks done</div></div>
    </div>
  </section>

  <section id="progress">
    <h2>Progress</h2>
    ${progressRowsToHtml(progressDashboard ? progressDashboard.parsedRows : [])}
  </section>

  <section id="sprint">
    <h2>Active Sprint</h2>
    <table>
      <thead><tr><th>ID</th><th>Task</th><th>Status</th><th>Notes</th></tr></thead>
      <tbody>${activeSprintRowsToHtml(activeSprintRows)}</tbody>
    </table>
  </section>

  <section id="sessions">
    <h2>Sessions</h2>
    <table>
      <thead><tr><th>#</th><th>Date</th><th>User</th><th>Focus</th><th>Tokens</th><th>Cost</th><th>Model</th></tr></thead>
      <tbody>${sessionRows || '<tr><td colspan="7">No sessions recorded</td></tr>'}</tbody>
    </table>
  </section>

  <section id="costs">
    <h2>Costs &amp; Tokens</h2>
    <div class="metrics">
      <div class="metric"><div class="value">$${(totals.cost_usd || 0).toFixed(2)}</div><div class="label">Total project cost (${costLabel})</div></div>
      <div class="metric"><div class="value">$${sessions.length ? ((totals.cost_usd || 0) / sessions.length).toFixed(2) : '0.00'}</div><div class="label">Average per session (${costLabel})</div></div>
      <div class="metric"><div class="value">${mostExpensive ? `Session ${mostExpensive.number}` : '—'}</div><div class="label">Most expensive${mostExpensive ? ` ($${(mostExpensive.cost_usd || 0).toFixed(2)})` : ''}</div></div>
      <div class="metric"><div class="value">${cheapest ? `Session ${cheapest.number}` : '—'}</div><div class="label">Cheapest${cheapest ? ` ($${(cheapest.cost_usd || 0).toFixed(2)})` : ''}</div></div>
    </div>
    <h3>Cost per session</h3>
    ${costChart}
    <h3>Tokens per session (input + output)</h3>
    ${tokensChart}
    <h3>Cost by phase</h3>
    ${costByPhaseChart}
  </section>

  <section id="users">
    <h2>Users</h2>
    ${usersToHtml(users)}
  </section>

  <section id="decisions">
    <h2>Decisions</h2>
    <table>
      <thead><tr><th>#</th><th>Decision</th><th>Rationale</th><th>Date</th></tr></thead>
      <tbody>${tableRowsToHtml(decisionsRows, 4)}</tbody>
    </table>
  </section>

  <section id="risks">
    <h2>Risks</h2>
    <table>
      <thead><tr><th>Risk</th><th>Impact</th><th>Mitigation</th></tr></thead>
      <tbody>${tableRowsToHtml(riskRows, 3)}</tbody>
    </table>
  </section>

  <section id="documents">
    <h2>Full Documents</h2>
    <details>
      <summary>Project Plan</summary>
      ${planContent ? mdToHtml(planContent) : '<p>No PROJECT_PLAN.md found. Run <code>/plan-update</code> to create one.</p>'}
    </details>
    <details>
      <summary>Status Report</summary>
      ${statusContent ? mdToHtml(statusContent) : '<p>No STATUS_REPORT.md found. Run <code>/session-end</code> to create one.</p>'}
    </details>
  </section>

  <section id="history">
    <h2>History</h2>
    ${historySectionToHtml({ handoffs, dashboards, commits })}
  </section>

  <footer>
    <p>Generated by getsitrep dashboard on ${new Date().toISOString()}</p>
  </footer>
</body>
</html>
`;
}

function archivePreviousDashboard(sessionNumber) {
  const dashboardPath = paths.DASHBOARD_HTML();
  if (!exists(dashboardPath)) return null;
  ensureDir(paths.HISTORY_DASHBOARDS());
  // Keyed on session number + a timestamp, not session number alone — the
  // session number doesn't change between two dashboard runs in the same
  // session, so a bare "dashboard-session-N.html" name would let a third run
  // silently overwrite the archive a second run just created.
  const archivePath = path.join(paths.HISTORY_DASHBOARDS(), `dashboard-session-${sessionNumber}-${Date.now()}.html`);
  fs.copyFileSync(dashboardPath, archivePath);
  return archivePath;
}

function listDirSafe(dirPath) {
  if (!exists(dirPath)) return [];
  try {
    return fs.readdirSync(dirPath).filter((f) => !f.startsWith('.'));
  } catch {
    return [];
  }
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  // Dashboard "must never fail" per its own spec — bad args become a
  // warning, not a refusal to generate the report.
  const warning = parsed.ok ? '' : ` (ignored: ${parsed.errors.join('; ')})`;

  ensureDir(paths.SITREP_DIR());

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  const manifestContent = readIfExists(paths.MANIFEST());
  const dataJson = readJsonIfExists(paths.DATA_JSON());

  const projectName = extractProjectName(planContent, path.basename(process.cwd()));
  const version = extractVersion(manifestContent);
  const currentPhase = extractHeaderField(statusContent, 'Current Phase') || 'unknown';
  const overall = extractHeaderField(statusContent, 'Overall Progress') || 'unknown';
  const lastUpdated = extractHeaderField(statusContent, 'Last Updated') || 'unknown';

  const decisionsTable = findKeyDecisionsTable(planContent);
  const riskTable = findRiskRegisterTable(planContent);
  const activeSprintTable = findTableAfterHeading(statusContent, /^##\s*Active Sprint.*$/m);

  const handoffs = listDirSafe(paths.HISTORY_HANDOFFS());
  const dashboards = listDirSafe(paths.HISTORY_DASHBOARDS());
  const commits = logForPath('sitrep/', 20);

  const html = buildHtml({
    projectName,
    version,
    lastUpdated,
    currentPhase,
    overall,
    dataJson,
    decisionsRows: decisionsTable ? decisionsTable.rows : [],
    riskRows: riskTable ? riskTable.rows : [],
    activeSprintRows: activeSprintTable ? activeSprintTable.rows : [],
    planContent,
    statusContent,
    handoffs,
    dashboards,
    commits,
  });

  const sessionNumber = (dataJson && dataJson.totals && dataJson.totals.sessions) || 0;
  const archived = archivePreviousDashboard(sessionNumber);

  writeFile(paths.DASHBOARD_HTML(), html);

  const sizeKb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1);
  const gitResult = commit(['sitrep/'], `sitrep: dashboard — session ${sessionNumber}`);

  const lines = [
    '=== DASHBOARD ===',
    'File: sitrep/dashboard.html',
    `Size: ${sizeKb}KB${sizeKb > 80 ? ' ⚠️ exceeds the 80KB target' : ''}`,
    `Archived: ${archived ? path.relative(process.cwd(), archived) : 'none'}`,
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
    `Sections: Summary, Progress, Active Sprint, Sessions, Costs, Users, Decisions, Risks, Documents, History${warning}`,
    '=================',
  ];

  return ok('dashboard', parsed.values, lines.join('\n'));
}

module.exports = { name: 'dashboard', execute };
