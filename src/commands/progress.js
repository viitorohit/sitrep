// GETSITREP-51: quick, source-agnostic progress readout.
//
// readPlan()'s totalTasks/doneTasks are already uniform across every source
// (native aggregates across phases, openspec/speckit across all tasks,
// external is aggregate by definition) — unlike plan.js's --phase handling,
// this needs no per-source branching to be "source-agnostic".

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists } = require('../lib/fs-helpers');
const { renderProgressBar } = require('../lib/markdown');
const { readConfig } = require('../lib/config');
const { readPlan } = require('../lib/plan-adapters');
const { readJsonInput } = require('../lib/input');
const paths = require('../lib/paths');

const SPEC = { flags: { 'plan-data': { type: 'value' } } };

function buildProgressLines(plan) {
  const lines = [`=== PROGRESS (source: ${plan.source}) ===`];
  if (!plan.available) {
    lines.push(`⚠️ Not available${plan.note ? ` — ${plan.note}` : ''}.`);
  } else if (plan.totalTasks === 0) {
    lines.push(plan.note || 'No tasks tracked yet.');
  } else {
    const { bar } = renderProgressBar(plan.doneTasks, plan.totalTasks);
    lines.push(`${plan.doneTasks}/${plan.totalTasks} tasks done  ${bar}`);
    if (plan.note) lines.push(plan.note);
  }
  lines.push('=========================');
  return lines;
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) return fail('progress', parsed.values, parsed.errors.join('; '));

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  const config = readConfig();
  const externalInput = readJsonInput(parsed.values['plan-data']);
  const plan = readPlan(config, { planContent, statusContent, externalData: externalInput.ok ? externalInput.data : undefined });

  const lines = buildProgressLines(plan);
  return ok('progress', parsed.values, lines.join('\n'));
}

module.exports = { name: 'progress', execute, buildProgressLines };
