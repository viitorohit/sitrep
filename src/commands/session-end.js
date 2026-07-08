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
const { ok, fail } = require('../lib/result');
const { readIfExists, writeFile, readJsonIfExists, writeJson, ensureDir, exists } = require('../lib/fs-helpers');
const { readJsonInput } = require('../lib/input');
const { extractProjectName, replaceHeaderField, insertSessionLogEntry } = require('../lib/markdown');
const { computeCostRollup } = require('../lib/cost-attribution');
const { dashboardStaleTrigger } = require('../lib/nudge-triggers');
const dashboard = require('./dashboard');
const paths = require('../lib/paths');
const { commit, userName, currentBranch } = require('../lib/git');
const { today } = require('../lib/dates');
const path = require('path');
const fs = require('fs');

const SPEC = {
  flags: { data: { type: 'value' } },
};

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

// GETSITREP-54: the immediately prior session's number + one-line focus —
// this is exactly the reference this project's own drift incidents (4
// merged Stories going unlogged after Session 8, undetected for a full day)
// would have made visible immediately: a session log entry chained to a
// previous one that's actually two-plus Stories old reads as a red flag on
// its own, without needing a manual git-log/Jira cross-check to catch it.
function previousSessionSummary(dataJson) {
  if (!dataJson || !Array.isArray(dataJson.sessions) || dataJson.sessions.length === 0) return null;
  const prev = dataJson.sessions[dataJson.sessions.length - 1];
  return { number: prev.number, focus: prev.focus };
}

function previousSessionLine(previousSession) {
  return previousSession
    ? `- **Since Session ${previousSession.number}:** ${previousSession.focus}`
    : '- **Since Session:** — (this is the first recorded session)';
}

function buildSessionLogEntry(number, summary, branch, previousSession) {
  const costLine =
    summary.costUsd === null
      ? 'not tracked'
      : `~${summary.tokens.total} (${summary.costLabel}) | Cost: ~$${summary.costUsd.toFixed(2)} (${summary.costLabel})`;

  const lines = [
    `### Session ${number} — ${today()}`,
    `- **User:** ${summary.user}`,
    `- **Branch:** ${branch}`,
    previousSessionLine(previousSession),
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
  // A .sitrep-data.json that exists but predates this schema (or was hand
  // edited) may be missing these arrays even though it parsed as valid JSON
  // — normalize regardless of where `data` came from, rather than only when
  // the whole file was absent.
  if (!Array.isArray(data.sessions)) data.sessions = [];
  if (!Array.isArray(data.users)) data.users = [];

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

function writeHistoryRecord(number, projectName, summary, branch, previousSession) {
  const padded = String(number).padStart(3, '0');
  const filePath = path.join(paths.HISTORY_SESSIONS(), `session-${padded}.md`);
  const costLine =
    summary.costUsd === null ? 'not tracked' : `~$${summary.costUsd.toFixed(2)} (${summary.costLabel})`;
  const previousLine = previousSession
    ? `> **Since Session ${previousSession.number}:** ${previousSession.focus}`
    : '> **Since Session:** — (this is the first recorded session)';

  const content = [
    `# Session ${number} — ${today()}`,
    '',
    `> **User:** ${summary.user}`,
    `> **Branch:** ${branch}`,
    `> **Model:** ${summary.model}`,
    `> **Tokens:** ${summary.tokens.total} (${summary.costLabel}, input: ${summary.tokens.input}, output: ${summary.tokens.output})`,
    `> **Cost:** ${costLine}`,
    previousLine,
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
  if (exists(filePath)) {
    // nextSessionNumber() can drift from what's already on disk (a hand-
    // edited/reset .sitrep-data.json, a branch switch, a restored backup) —
    // never silently overwrite an existing session record; move it aside.
    fs.renameSync(filePath, `${filePath}.bak-${Date.now()}`);
  }
  writeFile(filePath, content);
  return filePath;
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  // GETSITREP-54/55: a malformed invocation (e.g. an unrecognized flag like
  // an accidental `--help` that slipped past cli.js's own interception —
  // see src/cli.js) refuses outright, before any file is touched or
  // anything is committed. This is deliberately different from Hard Law #5's
  // fail-open guarantee: that law protects a LEGITIMATE bare invocation
  // (no --data, no stdin, nothing to infer) from ever being blocked — it was
  // never meant to license committing garbage data just because the
  // invocation itself was broken. Refusing here surfaces the real problem
  // immediately instead of silently writing a placeholder session record.
  if (!parsed.ok) {
    return fail('session-end', parsed.values, `Invalid arguments: ${parsed.errors.join('; ')} — session NOT recorded, nothing committed.`);
  }
  const warnings = [];

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
  const previousSession = previousSessionSummary(dataJson);

  const filesUpdated = [];

  if (statusContent) {
    let updatedStatus = insertSessionLogEntry(statusContent, buildSessionLogEntry(number, summary, branch, previousSession));
    updatedStatus = replaceHeaderField(updatedStatus, 'Last Updated', `${today()} — Session ${number}`);
    writeFile(paths.STATUS_REPORT(), updatedStatus);
    filesUpdated.push('STATUS_REPORT.md');
  } else {
    warnings.push('sitrep/STATUS_REPORT.md not found — session log entry not recorded');
  }

  const updatedData = updateDataJson(dataJson, projectName, number, summary);
  updatedData.cost_rollup = computeCostRollup(updatedData, planContent);
  writeJson(paths.DATA_JSON(), updatedData);
  filesUpdated.push('.sitrep-data.json');

  const historyPath = writeHistoryRecord(number, projectName, summary, branch, previousSession);
  filesUpdated.push(path.relative(process.cwd(), historyPath));

  // GETSITREP-51: fold a dashboard regeneration into this same commit,
  // gated by the exact same staleness signal GETSITREP-35's mid-session
  // nudge-check already uses (dashboardStaleTrigger, threshold currently 3
  // sessions) — reusing it rather than inventing a second heuristic that
  // could drift out of sync. This bounds dashboard staleness to at most
  // THRESHOLD-1 sessions automatically, without regenerating (and
  // re-archiving) on every single session-end. Wrapped in try/catch per
  // Hard Law #5 — a dashboard failure must never block this command's own
  // commit, only degrade to a warning line.
  let dashboardLine;
  try {
    const sessionCount = updatedData.totals.sessions;
    const dashboardArchiveCountBefore = dashboard.archiveCount();
    const trigger = dashboardStaleTrigger({ sessionCount, dashboardArchiveCount: dashboardArchiveCountBefore });
    if (trigger) {
      const result = dashboard.generate();
      filesUpdated.push('sitrep/dashboard.html');
      if (result.archived) filesUpdated.push(result.archived);
      dashboardLine = `Dashboard: regenerated (${trigger.reason})`;
    } else {
      const sessionsSinceDashboard = sessionCount - dashboardArchiveCountBefore;
      dashboardLine = `Dashboard: up to date (${sessionsSinceDashboard} session(s) since last view)`;
    }
  } catch (err) {
    dashboardLine = `Dashboard: regeneration failed (${err.message}) — session recorded anyway`;
  }

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
    dashboardLine,
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
    ...(warnings.length ? [`Warnings: ${warnings.join(' | ')}`] : []),
    '===================================',
  ];

  return ok('session-end', parsed.values, lines.join('\n'));
}

module.exports = { name: 'session-end', execute };
