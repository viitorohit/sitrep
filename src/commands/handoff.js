// Intentional (manually invoked) per docs/specs/command-canon.md.
//
// Usage: handoff [human|ai]  — defaults to "ai" if absent.

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists, writeFile, exists, ensureDir } = require('../lib/fs-helpers');
const {
  extractProjectName,
  extractSection,
  extractLatestSessionLogEntry,
  extractBlockers,
  findTableAfterHeading,
  findKeyDecisionsTable,
  findRiskRegisterTable,
} = require('../lib/markdown');
const paths = require('../lib/paths');
const { commit } = require('../lib/git');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SPEC = {
  positional: { name: 'target', oneOf: ['human', 'ai'], default: 'ai' },
};

function archivePreviousHandoff() {
  const handoffPath = paths.HANDOFF();
  if (!exists(handoffPath)) return null;
  const content = readIfExists(handoffPath);
  const sessionMatch = content.match(/Last session:\**\s*(\d+)/);
  const n = sessionMatch ? sessionMatch[1] : 'unknown';
  ensureDir(paths.HISTORY_HANDOFFS());
  const archivePath = path.join(paths.HISTORY_HANDOFFS(), `handoff-session-${n}.md`);
  fs.renameSync(handoffPath, archivePath);
  return archivePath;
}

function repoStructureTopTwo() {
  const cwd = process.cwd();
  try {
    const top = fs
      .readdirSync(cwd, { withFileTypes: true })
      .filter((d) => !d.name.startsWith('.') && d.name !== 'node_modules')
      .map((d) => d.name)
      .sort();
    const lines = [];
    for (const name of top) {
      lines.push(name);
      const full = path.join(cwd, name);
      if (fs.statSync(full).isDirectory()) {
        try {
          const children = fs
            .readdirSync(full, { withFileTypes: true })
            .filter((d) => !d.name.startsWith('.'))
            .map((d) => d.name)
            .sort();
          for (const child of children) lines.push(`  ${name}/${child}`);
        } catch {
          // unreadable subdirectory — skip it, not fatal
        }
      }
    }
    return lines.join('\n');
  } catch {
    return '(could not read repo structure)';
  }
}

function recentGitLog(n) {
  try {
    return execFileSync('git', ['log', '--oneline', `-${n}`], { encoding: 'utf8' }).trim();
  } catch {
    return '(not a git repository, or no commits)';
  }
}

function buildHandoff(target) {
  const projectPlan = readIfExists(paths.PROJECT_PLAN());
  const statusReport = readIfExists(paths.STATUS_REPORT());
  const manifest = readIfExists(paths.MANIFEST());

  const projectName = extractProjectName(projectPlan, path.basename(process.cwd()));
  const techStackMatch = projectPlan && projectPlan.match(/\*\*Tech Stack:\*\*\s*(.+)/);
  const techStack = techStackMatch ? techStackMatch[1].trim() : 'Not documented.';
  const rawVision = extractSection(projectPlan, /##\s*Product Vision/) || 'Not documented in PROJECT_PLAN.md.';
  // The Tech Stack line often sits inside the same section as the vision
  // paragraph — strip it here since it's rendered in its own section below.
  const vision = rawVision.replace(/\*\*Tech Stack:\*\*.*$/m, '').trim();

  const lastSession = extractLatestSessionLogEntry(statusReport);
  const blockers = extractBlockers(statusReport);

  const activeSprintTable = findTableAfterHeading(statusReport, /##\s*Active Sprint/);
  const pendingTasks = activeSprintTable ? activeSprintTable.rows.filter((r) => /🔲|🟡/.test(r)) : [];

  const decisionsTable = findKeyDecisionsTable(projectPlan);
  const recentDecisions = decisionsTable ? decisionsTable.rows.slice(-5) : [];

  const riskTable = findRiskRegisterTable(projectPlan);
  const risks = riskTable ? riskTable.rows : [];

  const versionMatch = manifest && manifest.match(/\*\*Current:\*\*\s*v?(\S+)/);
  const version = versionMatch ? versionMatch[1] : 'unknown';

  const audienceNote =
    target === 'human'
      ? 'Generated for a human collaborator joining this project.'
      : 'Generated for an AI assistant starting a new session. Read sitrep/PROJECT_PLAN.md and sitrep/STATUS_REPORT.md in full before making changes.';

  const lines = [
    `# ${projectName} — Handoff`,
    '',
    `> **Generated:** ${new Date().toISOString().slice(0, 10)}`,
    `> **Last session:** ${lastSession ? lastSession.number : 'unknown'}`,
    `> **sitrep version:** ${version}`,
    `> **Target:** ${target} — ${audienceNote}`,
    '',
    '---',
    '',
    '## What This Project Is',
    vision,
    '',
    '## Tech Stack',
    techStack,
    '',
    '## What Was Just Done (Last Session)',
    lastSession ? lastSession.fields.Focus || lastSession.fields.Done || '(no summary recorded)' : '(no session log entry found)',
    '',
    "## What's Next",
    pendingTasks.length ? pendingTasks.join('\n') : lastSession && lastSession.fields.Next ? lastSession.fields.Next : '(nothing recorded)',
    '',
    '## Active Decisions & Context',
    recentDecisions.length ? recentDecisions.join('\n') : '(no decisions recorded)',
    '',
    '## Watch Out For',
    risks.length ? risks.join('\n') : '(no risks recorded)',
    '',
    '## Architecture Quick Reference',
    '```',
    repoStructureTopTwo(),
    '```',
    '',
    'Recent commits:',
    '```',
    recentGitLog(10),
    '```',
    '',
    '## Blockers',
    blockers.length ? blockers.join('; ') : 'None',
    '',
    '---',
    '',
    '_Generated by `getsitrep handoff`. Full details in `sitrep/PROJECT_PLAN.md` and `sitrep/STATUS_REPORT.md`._',
  ];

  return lines.join('\n');
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) {
    return fail('handoff', parsed.values, parsed.errors.join('; '));
  }

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  if (!planContent || !statusContent) {
    return fail(
      'handoff',
      parsed.values,
      '⚠️ Cannot generate handoff — sitrep/PROJECT_PLAN.md or sitrep/STATUS_REPORT.md not found. Run selfheal to diagnose and fix.'
    );
  }

  const archived = archivePreviousHandoff();
  const content = buildHandoff(parsed.values.target);
  writeFile(paths.HANDOFF(), content);

  const gitResult = commit(['sitrep/'], `sitrep: handoff — ${parsed.values.target}`);

  const lines = [
    '=== HANDOFF READY ===',
    'File: sitrep/HANDOFF.md',
    `Target: ${parsed.values.target}`,
    `Archived: ${archived ? path.relative(process.cwd(), archived) : 'none'}`,
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
    '=====================',
  ];

  return ok('handoff', parsed.values, lines.join('\n'));
}

module.exports = { name: 'handoff', execute };
