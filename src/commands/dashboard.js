// Intentional (manually invoked) per docs/specs/command-canon.md.
//
// Scope note: generates a real, functional self-contained HTML dashboard
// covering Summary, Progress, Sessions, Costs, Decisions, and Risks —
// not all 10 sections from commands/dashboard.md's full vision (Active
// Sprint table, Users panel, Full Documents, History, and inline SVG
// charts are not implemented in this pass). This is the most valuable
// subset achievable without a much larger effort; the rest is a known,
// explicitly-scoped-out gap, not an oversight. Per the MD's own design
// requirement, this must never fail — every section renders "not found"
// rather than throwing when its source file is missing.

const { parseArgs } = require('../lib/args');
const { ok } = require('../lib/result');
const { readIfExists, readJsonIfExists, writeFile, ensureDir, exists } = require('../lib/fs-helpers');
const {
  extractProjectName,
  extractVersion,
  extractHeaderField,
  findKeyDecisionsTable,
  findRiskRegisterTable,
  splitRowCells,
} = require('../lib/markdown');
const paths = require('../lib/paths');
const { commit } = require('../lib/git');
const path = require('path');
const fs = require('fs');

const SPEC = {};

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

// 'actual' only if every recorded session's cost is actual; otherwise the
// aggregate total is a blend and must be labeled 'estimate' rather than
// presented as a bare, unlabeled number (docs/specs/cost-schema.md).
function costLabelForSessions(sessions) {
  if (!sessions.length) return null;
  const allActual = sessions.every((s) => s.cost_label === 'actual');
  return allActual ? 'actual' : 'estimate';
}

function buildHtml({ projectName, version, lastUpdated, currentPhase, overall, dataJson, decisionsRows, riskRows }) {
  const sessions = (dataJson && dataJson.sessions) || [];
  const totals = (dataJson && dataJson.totals) || {};
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
  const costLabel = costLabelForSessions(sessions) || 'estimate';

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(projectName)} — Dashboard</title>
<style>
  :root { color-scheme: dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #e0e0e0; margin: 0; padding: 24px; }
  h1, h2 { color: #fff; }
  section { margin-bottom: 32px; }
  table { width: 100%; border-collapse: collapse; background: #1a1a2e; }
  th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #333; font-size: 14px; }
  th { color: #4361ee; }
  .metrics { display: flex; gap: 24px; flex-wrap: wrap; }
  .metric { background: #1a1a2e; padding: 16px 24px; border-radius: 8px; min-width: 160px; }
  .metric .value { font-size: 28px; font-weight: bold; color: #06d6a0; }
  .metric .label { font-size: 12px; color: #999; }
  @media print { body { background: #fff; color: #000; } .metric, table { background: #fff; } }
  @media (max-width: 600px) { .metrics { flex-direction: column; } }
</style>
</head>
<body>
  <h1>${esc(projectName)} — Intelligent MIS</h1>
  <p>sitrep v${esc(version)} · Last updated: ${esc(lastUpdated)}</p>

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

  <section id="sessions">
    <h2>Sessions</h2>
    <table>
      <thead><tr><th>#</th><th>Date</th><th>User</th><th>Focus</th><th>Tokens</th><th>Cost</th><th>Model</th></tr></thead>
      <tbody>${sessionRows || '<tr><td colspan="7">No sessions recorded</td></tr>'}</tbody>
    </table>
  </section>

  <section id="costs">
    <h2>Costs</h2>
    <div class="metrics">
      <div class="metric"><div class="value">$${(totals.cost_usd || 0).toFixed(2)}</div><div class="label">Total project cost (${costLabel})</div></div>
      <div class="metric"><div class="value">$${sessions.length ? ((totals.cost_usd || 0) / sessions.length).toFixed(2) : '0.00'}</div><div class="label">Average per session (${costLabel})</div></div>
      <div class="metric"><div class="value">${mostExpensive ? `Session ${mostExpensive.number}` : '—'}</div><div class="label">Most expensive${mostExpensive ? ` ($${(mostExpensive.cost_usd || 0).toFixed(2)} — ${mostExpensive.cost_label || 'estimate'})` : ''}</div></div>
    </div>
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

  const html = buildHtml({
    projectName,
    version,
    lastUpdated,
    currentPhase,
    overall,
    dataJson,
    decisionsRows: decisionsTable ? decisionsTable.rows : [],
    riskRows: riskTable ? riskTable.rows : [],
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
    `Sections: Summary, Sessions, Costs, Decisions, Risks${warning}`,
    '=================',
  ];

  return ok('dashboard', parsed.values, lines.join('\n'));
}

module.exports = { name: 'dashboard', execute };
