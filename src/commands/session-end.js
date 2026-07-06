// Automatic (hook-fired) per docs/specs/command-canon.md. Per Hard Law #5,
// this command must never fail or block — even if no session-summary data
// is provided, it degrades to best-effort defaults rather than refusing to
// end the session.
//
// Usage: session-end --data '<json>'  (or pipe JSON via stdin)
//   {
//     "focus": "one-line summary",
//     "tasksCompleted": ["3.1"], "tasksInProgress": [], "tasksBlocked": [],
//     "blockers": [], "decisions": [],
//     "tokens": {"input": N, "output": N, "cacheCreation": N, "cacheRead": N, "total": N},
//     "costUsd": N.NN, "costLabel": "actual"|"estimate", "costSource": "ccusage"|"manual_estimate",
//     "model": "...", "durationMinutes": N, "user": "...", "notes": "..."
//   }
// Every field is optional — missing ones become honest placeholders, never
// silently-wrong numbers (per docs/specs/cost-schema.md's labeling rule).
//
// Scope note: implements Part A's Session Log entry (not the Active
// Sprint/Progress Dashboard recalculation — that's selfheal's job, same
// scoping as capture.js), Part C (.sitrep-data.json), Part D (history
// record), and Part E (commit). Part B (PROJECT_PLAN.md edits) is
// deliberately out of scope here — that overlaps with plan-update, which
// already owns it.

const { parseArgs } = require('../lib/args');
const { ok } = require('../lib/result');
const { readIfExists, writeFile, readJsonIfExists, writeJson, ensureDir } = require('../lib/fs-helpers');
const { readJsonInput } = require('../lib/input');
const { extractProjectName, replaceHeaderField, insertSessionLogEntry } = require('../lib/markdown');
const paths = require('../lib/paths');
const { commit, userName, currentBranch } = require('../lib/git');
const path = require('path');

const SPEC = {
  flags: { data: { type: 'value' } },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function nextSessionNumber(dataJson) {
  if (!dataJson || !Array.isArray(dataJson.sessions) || dataJson.sessions.length === 0) return 1;
  return Math.max(...dataJson.sessions.map((s) => s.number || 0)) + 1;
}

function normalizeSummary(raw, fallbackUser) {
  const d = raw || {};
  return {
    focus: d.focus || '(not provided)',
    tasksCompleted: Array.isArray(d.tasksCompleted) ? d.tasksCompleted : [],
    tasksInProgress: Array.isArray(d.tasksInProgress) ? d.tasksInProgress : [],
    tasksBlocked: Array.isArray(d.tasksBlocked) ? d.tasksBlocked : [],
    blockers: Array.isArray(d.blockers) ? d.blockers : [],
    decisions: Array.isArray(d.decisions) ? d.decisions : [],
    tokens: {
      input: d.tokens?.input || 0,
      output: d.tokens?.output || 0,
      cacheCreation: d.tokens?.cacheCreation || 0,
      cacheRead: d.tokens?.cacheRead || 0,
      total: d.tokens?.total || 0,
    },
    costUsd: typeof d.costUsd === 'number' ? d.costUsd : null,
    costLabel: d.costLabel === 'actual' ? 'actual' : 'estimate',
    costSource: d.costSource || 'manual_estimate',
    model: d.model || 'unknown',
    durationMinutes: d.durationMinutes || 0,
    user: d.user || fallbackUser,
    notes: d.notes || '',
  };
}

function buildSessionLogEntry(number, summary, branch) {
  const costLine =
    summary.costUsd === null
      ? 'not tracked'
      : `~${summary.tokens.total} (${summary.costLabel}) | Cost: ~$${summary.costUsd.toFixed(2)} (${summary.costLabel})`;

  const lines = [
    `### Session ${number} — ${today()}`,
    `- **User:** ${summary.user}`,
    `- **Branch:** ${branch}`,
    `- **Focus:** ${summary.focus}`,
    `- **Done:** ${summary.tasksCompleted.length ? summary.tasksCompleted.join(', ') : 'None recorded'}`,
    `- **Blockers:** ${summary.blockers.length ? summary.blockers.join('; ') : 'None'}`,
    `- **Tokens:** ${costLine}`,
    `- **Model:** ${summary.model}`,
    `- **Next:** ${summary.notes || '(not provided)'}`,
  ];
  return lines.join('\n');
}

function updateDataJson(dataJson, projectName, number, summary) {
  const data = dataJson || { project: projectName, version: 'unknown', sessions: [], users: [], phases: [], totals: {} };

  data.sessions.push({
    number,
    date: today(),
    user: summary.user,
    focus: summary.focus,
    tasks_completed: summary.tasksCompleted,
    tasks_in_progress: summary.tasksInProgress,
    tasks_blocked: summary.tasksBlocked,
    blockers: summary.blockers,
    decisions: summary.decisions,
    tokens: summary.tokens,
    cost_usd: summary.costUsd,
    cost_label: summary.costLabel,
    cost_source: summary.costSource,
    model: summary.model,
    duration_minutes: summary.durationMinutes,
    notes: summary.notes,
  });

  let user = data.users.find((u) => u.name === summary.user);
  if (!user) {
    user = { name: summary.user, sessions: [], total_tokens: 0, total_cost_usd: 0 };
    data.users.push(user);
  }
  user.sessions.push(number);
  user.total_tokens += summary.tokens.total || 0;
  user.total_cost_usd = round2(user.total_cost_usd + (summary.costUsd || 0));

  data.totals = data.totals || {};
  data.totals.sessions = (data.totals.sessions || 0) + 1;
  data.totals.tasks_done = (data.totals.tasks_done || 0) + summary.tasksCompleted.length;
  data.totals.tokens = (data.totals.tokens || 0) + (summary.tokens.total || 0);
  data.totals.cost_usd = round2((data.totals.cost_usd || 0) + (summary.costUsd || 0));
  data.totals.hours = round2((data.totals.hours || 0) + summary.durationMinutes / 60);

  return data;
}

function writeHistoryRecord(number, projectName, summary, branch) {
  const padded = String(number).padStart(3, '0');
  const filePath = path.join(paths.HISTORY_SESSIONS(), `session-${padded}.md`);
  const costLine =
    summary.costUsd === null ? 'not tracked' : `~$${summary.costUsd.toFixed(2)} (${summary.costLabel})`;

  const content = [
    `# Session ${number} — ${today()}`,
    '',
    `> **User:** ${summary.user}`,
    `> **Branch:** ${branch}`,
    `> **Model:** ${summary.model}`,
    `> **Tokens:** ${summary.tokens.total} (${summary.costLabel}, input: ${summary.tokens.input}, output: ${summary.tokens.output})`,
    `> **Cost:** ${costLine}`,
    '',
    '## Focus',
    summary.focus,
    '',
    '## Completed',
    summary.tasksCompleted.length ? summary.tasksCompleted.join(', ') : 'None',
    '',
    '## In Progress',
    summary.tasksInProgress.length ? summary.tasksInProgress.join(', ') : 'None',
    '',
    '## Decisions Made',
    summary.decisions.length ? summary.decisions.join('; ') : 'None',
    '',
    '## Blockers',
    summary.blockers.length ? summary.blockers.join('; ') : 'None',
    '',
    '## Notes',
    summary.notes || '(none)',
  ].join('\n');

  ensureDir(paths.HISTORY_SESSIONS());
  writeFile(filePath, content);
  return filePath;
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  const warnings = [];
  if (!parsed.ok) {
    warnings.push(`ignored: ${parsed.errors.join('; ')}`);
  }

  const input = readJsonInput(parsed.values.data);
  if (!input.ok) {
    warnings.push(`no session summary provided (${input.error}) — using best-effort defaults`);
  }

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  const dataJson = readJsonIfExists(paths.DATA_JSON());

  const projectName = extractProjectName(planContent, path.basename(process.cwd()));
  const summary = normalizeSummary(input.ok ? input.data : null, userName());
  const number = nextSessionNumber(dataJson);
  const branch = currentBranch();

  const filesUpdated = [];

  if (statusContent) {
    let updatedStatus = insertSessionLogEntry(statusContent, buildSessionLogEntry(number, summary, branch));
    updatedStatus = replaceHeaderField(updatedStatus, 'Last Updated', `${today()} — Session ${number}`);
    writeFile(paths.STATUS_REPORT(), updatedStatus);
    filesUpdated.push('STATUS_REPORT.md');
  } else {
    warnings.push('sitrep/STATUS_REPORT.md not found — session log entry not recorded');
  }

  const updatedData = updateDataJson(dataJson, projectName, number, summary);
  writeJson(paths.DATA_JSON(), updatedData);
  filesUpdated.push('.sitrep-data.json');

  const historyPath = writeHistoryRecord(number, projectName, summary, branch);
  filesUpdated.push(path.relative(process.cwd(), historyPath));

  const gitResult = commit(['sitrep/'], `sitrep: session ${number} — ${summary.focus}`);

  const lines = [
    `=== ${projectName} SESSION END ===`,
    `Session: ${number}`,
    `User: ${summary.user}`,
    `Completed: ${summary.tasksCompleted.length ? summary.tasksCompleted.join(', ') : 'None'}`,
    `Blockers: ${summary.blockers.length ? summary.blockers.join('; ') : 'None'}`,
    `Tokens: ${summary.tokens.total} (${summary.costLabel})`,
    `Cost: ${summary.costUsd === null ? 'not tracked' : `$${summary.costUsd.toFixed(2)} (${summary.costLabel})`}`,
    `Updated: ${filesUpdated.join(', ')}`,
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
    ...(warnings.length ? [`Warnings: ${warnings.join(' | ')}`] : []),
    '===================================',
  ];

  return ok('session-end', parsed.values, lines.join('\n'));
}

module.exports = { name: 'session-end', execute };
