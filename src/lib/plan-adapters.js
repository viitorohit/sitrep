// GETSITREP-49: native + file-based plan adapter.
//
// Before this, `sitrep.config.json`'s `planSource` was written at `init` time
// (GETSITREP-18/19) but never read back by anything — every command hardcoded
// a check for sitrep/PROJECT_PLAN.md regardless of what the user configured.
// A project onboarded with `--plan openspec` or `--plan speckit` got a false
// "no plan found" warning even with a real OpenSpec/Spec Kit setup in place.
// This module is the first real reader behind that config field.
//
// Real, verified (not guessed) file conventions as of 2026-07:
// - OpenSpec: `openspec/changes/<change-name>/tasks.md`, one directory per
//   proposed change, checkbox tasks `- [ ] 1.1 Description` / `- [x] ...`.
// - Spec Kit: `specs/<###-feature-name>/tasks.md`, one directory per feature,
//   checkbox tasks `- [ ] T001 Description` / `- [x] ...`.
// Both are per-feature/change directories, not one project-wide plan file
// like sitrep's own PROJECT_PLAN.md+STATUS_REPORT.md model — this adapter
// aggregates across every change/feature directory found, since sitrep's
// "progress" concept is project-wide, not scoped to a single change.
//
// Jira ('jira' planSource) is explicitly NOT handled here — that's
// GETSITREP-50's own adapter (needs live API access, out of scope for a
// file-reading module). Requesting it here returns an honest "not yet built"
// result rather than silently falling back to a wrong source.

const fs = require('fs');
const path = require('path');
const { readIfExists, exists } = require('./fs-helpers');
const { extractProgressDashboardTable, isPlainInteger, stripBold } = require('./markdown');

const CHECKBOX_RE = /^[-*]\s*\[( |x|X)\]\s*(\S+)?\s*(.*)$/;

function parseChecklistFile(content) {
  const tasks = [];
  for (const line of content.split('\n')) {
    const m = line.match(CHECKBOX_RE);
    if (!m) continue;
    tasks.push({ id: m[2] || '', description: (m[3] || '').trim(), done: m[1].toLowerCase() === 'x' });
  }
  return tasks;
}

// Reads every `<baseDir>/*/tasks.md` (one subdirectory per change/feature),
// never throwing — a missing/unreadable baseDir just means "not available".
function readTasksFilesUnder(baseDir) {
  if (!exists(baseDir)) return null;
  let entries;
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return null;
  }
  const tasks = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const content = readIfExists(path.join(baseDir, entry.name, 'tasks.md'));
    if (content) {
      for (const t of parseChecklistFile(content)) tasks.push({ ...t, group: entry.name });
    }
  }
  return tasks;
}

function summarize(source, tasks, emptyNote) {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.done).length;
  return {
    source,
    available: true,
    tasks,
    totalTasks,
    doneTasks,
    note: totalTasks === 0 ? emptyNote : null,
  };
}

function unavailable(source, note) {
  return { source, available: false, note, tasks: [], totalTasks: 0, doneTasks: 0 };
}

function readOpenSpecPlan(cwd) {
  const tasks = readTasksFilesUnder(path.join(cwd, 'openspec', 'changes'));
  if (tasks === null) return unavailable('openspec', 'no openspec/changes/ directory found');
  return summarize('openspec', tasks, 'openspec/changes/ exists but no change has a tasks.md yet');
}

function readSpecKitPlan(cwd) {
  const tasks = readTasksFilesUnder(path.join(cwd, 'specs'));
  if (tasks === null) return unavailable('speckit', 'no specs/ directory found');
  return summarize('speckit', tasks, 'specs/ exists but no feature has a tasks.md yet');
}

// Native mode's "available" is deliberately just "does PROJECT_PLAN.md
// exist" — same test the pre-GETSITREP-49 hardcoded check used. Task counts
// come from STATUS_REPORT.md's Progress Dashboard table separately, but a
// missing/malformed dashboard table must NOT flip `available` to false —
// that would wrongly tell someone with a perfectly real plan "no plan
// found" just because the dashboard summary table has an unrelated issue
// (selfheal's own checkFileIntegrity already owns flagging that,
// separately). Hybrid Story-tracked phases ("9 Stories" instead of a plain
// integer) are skipped when computing counts, same discipline selfheal's
// isPlainInteger check already applies — a Story-tracked phase's real
// progress lives in Jira (GETSITREP-50), not derivable from this table.
function readNativePlan(planContent, statusContent) {
  if (!planContent) return unavailable('native', 'sitrep/PROJECT_PLAN.md not found');

  const dashboard = statusContent ? extractProgressDashboardTable(statusContent) : null;
  if (!dashboard) {
    return {
      source: 'native',
      available: true,
      tasks: [],
      totalTasks: 0,
      doneTasks: 0,
      note: statusContent
        ? 'no Progress Dashboard table found in STATUS_REPORT.md — task counts unavailable'
        : 'sitrep/STATUS_REPORT.md not found — task counts unavailable',
    };
  }

  const tasks = [];
  let totalTasks = 0;
  let doneTasks = 0;
  for (const row of dashboard.parsedRows) {
    if (row.isTotal) continue;
    const totalCell = stripBold(row.tasksRaw || '');
    const doneCell = stripBold(row.doneRaw || '');
    if (isPlainInteger(totalCell) && isPlainInteger(doneCell)) {
      const total = parseInt(totalCell, 10);
      const done = parseInt(doneCell, 10);
      totalTasks += total;
      doneTasks += done;
      tasks.push({ id: `phase-${row.phase}`, description: row.name, done: done >= total });
    }
  }
  return { source: 'native', available: true, tasks, totalTasks, doneTasks, note: null };
}

// Single entry point every command should call instead of hardcoding a
// PROJECT_PLAN.md existence check. `config` is the parsed sitrep.config.json
// (or null if it doesn't exist yet, in which case this falls back to
// 'native' — the default before any wizard ran).
function readPlan(config, { planContent, statusContent, cwd } = {}) {
  const source = (config && config.planSource) || 'native';
  const workingDir = cwd || process.cwd();

  switch (source) {
    case 'native':
      return readNativePlan(planContent, statusContent);
    case 'openspec':
      return readOpenSpecPlan(workingDir);
    case 'speckit':
      return readSpecKitPlan(workingDir);
    case 'jira':
      return unavailable('jira', 'Jira adapter not yet built (GETSITREP-50) — plan/progress reads fall back to nothing for now');
    case 'none':
    default:
      return unavailable(source, 'no plan source configured');
  }
}

module.exports = { readPlan, parseChecklistFile, readNativePlan, readOpenSpecPlan, readSpecKitPlan };
