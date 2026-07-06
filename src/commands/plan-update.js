// Intentional (manually invoked) per docs/specs/command-canon.md.
//
// Usage: plan-update --data '<json>'   (or pipe JSON via stdin)
//   {"type": "decision", "decision": "...", "rationale": "...", "date": "YYYY-MM-DD"?}
//   {"type": "risk", "risk": "...", "impact": "High|Medium|Low", "mitigation": "..."}
//
// Scope note: adding a task to a phase or the Future table is capture's job
// (it already owns that table-insertion logic) — plan-update covers the two
// structured tables capture doesn't touch: Key Decisions and Risk Register.
// The original MD's "free-form requested changes" is fundamentally an LLM
// interpretation step; this JSON shape is what that interpretation should
// produce before calling the CLI (see docs/specs/adapter-contract.md's
// discussion of what belongs in the CLI vs. the calling adapter).

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists, writeFile } = require('../lib/fs-helpers');
const { readJsonInput } = require('../lib/input');
const {
  findKeyDecisionsTable,
  nextDecisionNumber,
  findRiskRegisterTable,
  insertRowAt,
  insertChangeLogRow,
} = require('../lib/markdown');
const paths = require('../lib/paths');
const { commit } = require('../lib/git');
const { today } = require('../lib/dates');

const SPEC = {
  flags: {
    data: { type: 'value' },
  },
};

function applyDecision(planContent, data) {
  if (!data.decision || !data.rationale) {
    return { error: 'A "decision" edit requires "decision" and "rationale" fields.' };
  }
  const table = findKeyDecisionsTable(planContent);
  if (!table) return { error: 'Could not find a "Key Decisions" table in PROJECT_PLAN.md.' };

  const number = nextDecisionNumber(table.rows);
  const date = data.date || today();
  const row = `| ${number} | ${data.decision} | ${data.rationale} | ${date} |`;
  return {
    updatedPlan: insertRowAt(planContent, table.tableEnd, row),
    summary: `Recorded decision #${number}: ${data.decision}`,
  };
}

function applyRisk(planContent, data) {
  if (!data.risk || !data.impact || !data.mitigation) {
    return { error: 'A "risk" edit requires "risk", "impact", and "mitigation" fields.' };
  }
  const table = findRiskRegisterTable(planContent);
  if (!table) return { error: 'Could not find a "Risk Register" table in PROJECT_PLAN.md.' };

  const row = `| ${data.risk} | ${data.impact} | ${data.mitigation} |`;
  return {
    updatedPlan: insertRowAt(planContent, table.tableEnd, row),
    summary: `Added risk: ${data.risk}`,
  };
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) {
    return fail('plan-update', parsed.values, parsed.errors.join('; '));
  }

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  if (!planContent || !statusContent) {
    return fail(
      'plan-update',
      parsed.values,
      '⚠️ Cannot update — sitrep/PROJECT_PLAN.md or sitrep/STATUS_REPORT.md not found. Run selfheal to diagnose and fix.'
    );
  }

  const input = readJsonInput(parsed.values.data);
  if (!input.ok) {
    return fail('plan-update', parsed.values, input.error);
  }

  const data = input.data;
  let applied;
  if (data.type === 'decision') {
    applied = applyDecision(planContent, data);
  } else if (data.type === 'risk') {
    applied = applyRisk(planContent, data);
  } else {
    return fail('plan-update', parsed.values, `Unknown edit type: "${data.type}". Expected "decision" or "risk".`);
  }

  if (applied.error) {
    return fail('plan-update', parsed.values, applied.error);
  }

  const updatedStatus = insertChangeLogRow(statusContent, [today(), applied.summary, 'plan-update']);

  writeFile(paths.PROJECT_PLAN(), applied.updatedPlan);
  writeFile(paths.STATUS_REPORT(), updatedStatus);

  const gitResult = commit(['sitrep/'], `sitrep: plan update — ${applied.summary}`);

  const lines = [
    '=== PLAN UPDATED ===',
    applied.summary,
    'Updated: PROJECT_PLAN.md + STATUS_REPORT.md',
    gitResult.committed ? 'Committed.' : `Not committed (${gitResult.reason}).`,
    '====================',
  ];

  return ok('plan-update', { type: data.type }, lines.join('\n'));
}

module.exports = { name: 'plan-update', execute };
