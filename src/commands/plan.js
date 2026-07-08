// GETSITREP-51: read-only view of the plan, source-agnostic.
//
// `--phase N` only means something for the native source (STATUS_REPORT.md's
// Progress Dashboard + PROJECT_PLAN.md's own phase sections) — openspec/
// speckit have no phase concept at all (tasks are grouped by change/feature
// directory, not numbered phases), and external sources (jira, ...) are
// aggregate-only by contract (see plan-adapters.js's readExternalPlan). Both
// cases say so explicitly rather than silently returning empty/wrong data.
//
// Omitting --phase always shows an overview rather than requiring the flag —
// Hard Law #5 (non-interactive, never block): a headless CI job or agent
// calling this often won't know phase numbers up front, and a hard failure
// would force an extra discovery round-trip for no reason.
//
// Native's `readPlan()` output only has one synthesized entry per *phase*,
// not per individual task (see plan-adapters.js's readNativePlan), so this
// command reads STATUS_REPORT.md's Progress Dashboard table directly for
// per-phase status text — that table already carries a pre-computed bar +
// percentage (and correctly handles Story-tracked phases like "4/9 Stories"
// that aren't plain integers), so there's nothing to recompute.

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists } = require('../lib/fs-helpers');
const { extractPhaseHeadings, extractSection, extractProgressDashboardTable } = require('../lib/markdown');
const { readConfig } = require('../lib/config');
const { readPlan } = require('../lib/plan-adapters');
const { readJsonInput } = require('../lib/input');
const paths = require('../lib/paths');

const SPEC = {
  flags: {
    'plan-data': { type: 'value' },
    phase: { type: 'value', pattern: /^\d+$/ },
  },
};

function phaseRowLine(row) {
  return `Phase ${row.phase}: ${row.name} — ${row.doneRaw}/${row.tasksRaw}${row.barRaw ? ` ${row.barRaw}` : ''}`;
}

function buildPlanLines(plan, phaseNumber, planContent, statusContent) {
  const lines = [`=== PLAN (source: ${plan.source}) ===`];

  if (!plan.available) {
    lines.push(`⚠️ No plan available${plan.note ? ` (${plan.note})` : ''}.`);
    lines.push('=====================');
    return lines;
  }

  if (phaseNumber && plan.source !== 'native') {
    if (plan.source === 'openspec' || plan.source === 'speckit') {
      lines.push(`⚠️ --phase is not applicable for source "${plan.source}" — it has no phase concept (tasks are grouped by change/feature).`);
      const groups = [...new Set(plan.tasks.map((t) => t.group).filter(Boolean))];
      lines.push(groups.length ? `Groups tracked: ${groups.join(', ')}` : 'No task groups found yet.');
    } else {
      lines.push(`⚠️ --phase is not applicable for source "${plan.source}" — this source is aggregate-only (no per-item breakdown; see --plan-data).`);
      if (plan.note) lines.push(plan.note);
    }
    lines.push('=====================');
    return lines;
  }

  if (phaseNumber && plan.source === 'native') {
    const headings = extractPhaseHeadings(planContent);
    const known = headings.map((h) => h.number);
    if (!known.includes(Number(phaseNumber))) {
      lines.push(`⚠️ Phase ${phaseNumber} not found in PROJECT_PLAN.md (known phases: ${known.length ? known.join(', ') : 'none'}).`);
      lines.push('=====================');
      return lines;
    }
    const heading = headings.find((h) => h.number === Number(phaseNumber));
    const dashboard = extractProgressDashboardTable(statusContent);
    const row = dashboard && dashboard.parsedRows.find((r) => !r.isTotal && r.phase === Number(phaseNumber));
    lines.push(row ? phaseRowLine(row) : `Phase ${phaseNumber}: ${heading.name}`);
    const body = extractSection(planContent, new RegExp(`^##\\s*Phase\\s+${phaseNumber}\\b.*$`, 'm'));
    if (body) {
      lines.push('');
      lines.push(body);
    }
    lines.push('=====================');
    return lines;
  }

  // Overview — no --phase given.
  if (plan.source === 'native') {
    const dashboard = extractProgressDashboardTable(statusContent);
    if (dashboard) {
      for (const row of dashboard.parsedRows) {
        if (row.isTotal) continue;
        lines.push(phaseRowLine(row));
      }
    } else {
      const headings = extractPhaseHeadings(planContent);
      for (const h of headings) lines.push(`Phase ${h.number}: ${h.name}`);
      lines.push('(no Progress Dashboard table found in STATUS_REPORT.md — task counts unavailable)');
    }
    lines.push('(pass --phase N for full phase content)');
  } else if (plan.source === 'openspec' || plan.source === 'speckit') {
    lines.push(`Total: ${plan.doneTasks}/${plan.totalTasks} tasks done`);
    const groups = {};
    for (const t of plan.tasks) {
      const g = t.group || '(ungrouped)';
      groups[g] = groups[g] || { done: 0, total: 0 };
      groups[g].total += 1;
      if (t.done) groups[g].done += 1;
    }
    for (const [group, counts] of Object.entries(groups)) {
      lines.push(`  ${group}: ${counts.done}/${counts.total}`);
    }
  } else {
    lines.push(`Aggregate: ${plan.doneTasks}/${plan.totalTasks} tasks done${plan.note ? ` (${plan.note})` : ''}`);
  }

  lines.push('=====================');
  return lines;
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) return fail('plan', parsed.values, parsed.errors.join('; '));

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  const config = readConfig();
  const externalInput = readJsonInput(parsed.values['plan-data']);
  const plan = readPlan(config, { planContent, statusContent, externalData: externalInput.ok ? externalInput.data : undefined });

  const lines = buildPlanLines(plan, parsed.values.phase, planContent, statusContent);
  return ok('plan', parsed.values, lines.join('\n'));
}

module.exports = { name: 'plan', execute, buildPlanLines };
