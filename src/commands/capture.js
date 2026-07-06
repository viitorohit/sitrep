// Intentional (manually invoked) per docs/specs/command-canon.md.
//
// Usage: capture <description> [--phase N] [--future]
// --phase and --future are mutually exclusive. Neither given -> defaults to
// whatever STATUS_REPORT.md's "Current Phase" header names (no interactive
// prompt — a CLI can't ask a question mid-pipe, unlike the original prose
// spec's "ask the user" step).
//
// Scope note: this command inserts the task row into PROJECT_PLAN.md and
// logs the change, but does not recompute STATUS_REPORT.md's Progress
// Dashboard counts/bars — that recalculation is selfheal's job (it already
// claims "sync counts" as part of its cross-file consistency check), so
// capture doesn't duplicate it. Run selfheal after capturing if you want
// the dashboard numbers to reflect the new task immediately.

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists, writeFile, appendLine } = require('../lib/fs-helpers');
const {
  extractHeaderField,
  findPhaseTable,
  nextTaskId,
  findFutureTable,
  nextFutureId,
  insertRowAt,
  insertChangeLogRow,
} = require('../lib/markdown');
const paths = require('../lib/paths');
const { commit } = require('../lib/git');
const { today } = require('../lib/dates');

const SPEC = {
  freeText: true,
  flags: {
    phase: { type: 'value', pattern: /^\d+$/ },
    future: { type: 'boolean' },
  },
  mutuallyExclusive: [['phase', 'future']],
};

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) {
    return fail('capture', parsed.values, parsed.errors.join('; '));
  }

  const { description, phase, future } = parsed.values;
  if (!description) {
    return fail('capture', parsed.values, 'No task description given.');
  }

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  if (!planContent || !statusContent) {
    return fail(
      'capture',
      parsed.values,
      '⚠️ Cannot capture — sitrep/PROJECT_PLAN.md or sitrep/STATUS_REPORT.md not found in sitrep/. Run selfheal to diagnose and fix.'
    );
  }

  let updatedPlan;
  let target;

  if (future) {
    const table = findFutureTable(planContent);
    if (!table) {
      return fail('capture', parsed.values, 'Could not find a "Future / Post-MVP Ideas" table in PROJECT_PLAN.md.');
    }
    const id = nextFutureId(table.rows);
    const row = `| ${id} | ${description} | Medium | TBD |`;
    updatedPlan = insertRowAt(planContent, table.tableEnd, row);
    target = { id, label: 'the Future table' };
  } else {
    const phaseNumber = phase || (extractHeaderField(statusContent, 'Current Phase') || '').match(/Phase\s+(\d+)/)?.[1];
    if (!phaseNumber) {
      return fail('capture', parsed.values, 'Could not determine a target phase — pass --phase N explicitly.');
    }
    const table = findPhaseTable(planContent, phaseNumber);
    if (!table) {
      return fail('capture', parsed.values, `Could not find a task table under "## Phase ${phaseNumber}" in PROJECT_PLAN.md.`);
    }
    if (!table.looksLikeTaskTable) {
      return fail(
        'capture',
        parsed.values,
        `Phase ${phaseNumber}'s table doesn't look like a standard task table (expected a "Feature"/"Task" column) — it may have been reformatted for external tracking. Refusing to guess; edit PROJECT_PLAN.md directly for this phase.`
      );
    }
    const id = nextTaskId(table.rows, phaseNumber);
    const row = `| ${id} | ${description} |  |`;
    updatedPlan = insertRowAt(planContent, table.tableEnd, row);
    target = { id, label: `Phase ${phaseNumber}` };
  }

  const updatedStatus = insertChangeLogRow(statusContent, [
    today(),
    `Captured task ${target.id}: ${description} to ${target.label}`,
    'Mid-session capture',
  ]);

  writeFile(paths.PROJECT_PLAN(), updatedPlan);
  writeFile(paths.STATUS_REPORT(), updatedStatus);

  const gitResult = commit(['sitrep/'], `sitrep: capture ${target.id} — ${description}`);

  const lines = [
    '=== CAPTURED ===',
    `ID: ${target.id}`,
    `Task: ${description}`,
    `Target: ${target.label}`,
    'Updated: PROJECT_PLAN.md + STATUS_REPORT.md',
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
    '================',
  ];

  return ok('capture', parsed.values, lines.join('\n'));
}

module.exports = { name: 'capture', execute };
