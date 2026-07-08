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
// GETSITREP-50: any `planSource` naming an externally-tracked tool (today
// just 'jira'; tomorrow maybe 'asana'/'linear'/'github') is handled by ONE
// generic reader, readExternalPlan() — not a per-tool adapter. sitrep never
// fetches from or authenticates to any of these tools itself (see ADR-0006):
// it only ever consumes an aggregate status summary the calling AI agent
// already produced using its own independent access to that tool, passed in
// via --plan-data. Adding a new external tool later needs zero new code
// here — just a new allowed value in config.js's PLAN_SOURCES. The
// complementary half of this (an agent optionally *relaying* sitrep-observed
// events out to that tool) has no sitrep code at all — it's declared as
// factual, non-imperative context in AGENTS.md (src/lib/agents-md.js) and
// left entirely to the agent's own judgment and access.

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

// GETSITREP-50: generic reader for any externally-tracked tool. Deliberately
// aggregate-only (tool, ref, fetchedAt, totalTasks, doneTasks, summary) —
// no per-item task list, since a Jira issue, an Asana task, and a GitHub PR
// comment thread aren't the same shape and forcing one would be guessing at
// a universal structure sitrep doesn't need. `externalData` is JSON an AI
// agent already produced using its own access to whatever tool is
// configured — this function only validates and normalizes it, never
// fetches anything itself.
function readExternalPlan(source, externalData) {
  if (!externalData || typeof externalData !== 'object') {
    return unavailable(
      source,
      `no --plan-data provided for external source "${source}" — pass a status summary from an agent with its own access to it, see docs/specs/adapter-contract.md`
    );
  }

  const totalTasks = externalData.totalTasks;
  const doneTasks = externalData.doneTasks;
  if (typeof totalTasks !== 'number' || typeof doneTasks !== 'number') {
    return unavailable(source, `--plan-data for "${source}" is missing numeric totalTasks/doneTasks — ignoring malformed input rather than guessing`);
  }

  const fetchedAt = typeof externalData.fetchedAt === 'string' ? externalData.fetchedAt : 'unknown time';
  const summary = typeof externalData.summary === 'string' && externalData.summary.trim() ? `: ${externalData.summary.trim()}` : '';
  return {
    source,
    available: true,
    tasks: [],
    totalTasks,
    doneTasks,
    note: `${source} status as of ${fetchedAt}${summary}`,
  };
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
// 'native' — the default before any wizard ran). `externalData` is only
// consulted for the `default` (externally-tracked tool) branch below.
function readPlan(config, { planContent, statusContent, cwd, externalData } = {}) {
  const source = (config && config.planSource) || 'native';
  const workingDir = cwd || process.cwd();

  switch (source) {
    case 'native':
      return readNativePlan(planContent, statusContent);
    case 'openspec':
      return readOpenSpecPlan(workingDir);
    case 'speckit':
      return readSpecKitPlan(workingDir);
    case 'none':
      return unavailable(source, 'no plan source configured');
    default:
      // Any other configured value (jira, and any future external tool) is
      // an externally-tracked source — handled identically, see
      // readExternalPlan()'s own comment for why this is a `default`, not a
      // growing list of per-tool cases.
      return readExternalPlan(source, externalData);
  }
}

module.exports = { readPlan, parseChecklistFile, readNativePlan, readOpenSpecPlan, readSpecKitPlan, readExternalPlan };
