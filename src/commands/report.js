// GETSITREP-51: cost-to-outcome summary ("cost to ship X"), read-only.
// Reads the cost rollup GETSITREP-48's session-end.js already persisted at
// `.sitrep-data.json`'s `cost_rollup` field — never recomputes it here (that
// stays session-end's job, recomputed fresh from `dataJson.sessions` every
// time it runs). `plan.source` is still surfaced in the header for
// consistency with `plan`/`progress` (and because it's used to enrich phase
// numbers with real names via `extractPhaseHeadings`), even though the cost
// numbers themselves don't depend on which plan adapter is configured.

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists, readJsonIfExists } = require('../lib/fs-helpers');
const { extractPhaseHeadings } = require('../lib/markdown');
const { readConfig } = require('../lib/config');
const { readPlan } = require('../lib/plan-adapters');
const { readJsonInput } = require('../lib/input');
const paths = require('../lib/paths');

const SPEC = {
  flags: {
    'plan-data': { type: 'value' },
    phase: { type: 'value', pattern: /^\d+$/ },
    ticket: { type: 'value' },
  },
  mutuallyExclusive: [['phase', 'ticket']],
};

function phaseName(phaseHeadings, phaseNumber) {
  const match = phaseHeadings.find((h) => h.number === Number(phaseNumber));
  return match ? match.name : null;
}

// 'mixed' means the bucket blends actual and estimated sessions — called out
// explicitly rather than silently picking one label, per cost-schema.md.
function labelSuffix(label) {
  return label === 'mixed'
    ? ' — mixed: blends actual and estimated sessions, do not treat as precise'
    : ` (${label || 'estimate'})`;
}

function formatBucket(bucket) {
  return `$${(bucket.cost_usd || 0).toFixed(2)}${labelSuffix(bucket.cost_label)} — ${bucket.tokens} tokens across ${bucket.sessions.length} session(s)`;
}

function buildReportLines({ dataJson, phaseHeadings, planSource, planAvailable, planNote, phaseFilter, ticketFilter }) {
  const lines = [`=== COST REPORT (source: ${planSource}) ===`];

  const rollup = dataJson && dataJson.cost_rollup;
  if (!rollup) {
    lines.push('⚠️ No cost data yet — run `getsitrep session-end` at least once to compute a cost rollup.');
    lines.push('=========================');
    return lines;
  }

  if (!planAvailable && planNote) {
    lines.push(`Plan: ${planNote}`);
  }

  if (ticketFilter) {
    const bucket = rollup.by_ticket[ticketFilter];
    lines.push(bucket ? `Ticket ${ticketFilter}: ${formatBucket(bucket)}` : `No cost recorded for ticket "${ticketFilter}".`);
    lines.push('=========================');
    return lines;
  }

  if (phaseFilter) {
    const known = phaseHeadings.map((h) => h.number);
    if (!known.includes(Number(phaseFilter))) {
      lines.push(`Phase ${phaseFilter} not found in PROJECT_PLAN.md (known phases: ${known.length ? known.join(', ') : 'none'}).`);
      lines.push('=========================');
      return lines;
    }
    const bucket = rollup.by_phase[phaseFilter];
    if (!bucket) {
      lines.push(`No cost attributed to Phase ${phaseFilter} yet.`);
    } else {
      const name = phaseName(phaseHeadings, phaseFilter);
      lines.push(`Phase ${phaseFilter}${name ? `: ${name}` : ''} — ${formatBucket(bucket)}`);
    }
    lines.push('=========================');
    return lines;
  }

  const phaseEntries = Object.entries(rollup.by_phase).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (phaseEntries.length) {
    lines.push('By phase:');
    for (const [num, bucket] of phaseEntries) {
      const name = phaseName(phaseHeadings, num);
      lines.push(`  Phase ${num}${name ? `: ${name}` : ''} — ${formatBucket(bucket)}`);
    }
  } else {
    lines.push('By phase: nothing attributed yet.');
  }

  const ticketEntries = Object.entries(rollup.by_ticket)
    .sort((a, b) => (b[1].cost_usd || 0) - (a[1].cost_usd || 0))
    .slice(0, 5);
  if (ticketEntries.length) {
    lines.push('Top tickets:');
    for (const [id, bucket] of ticketEntries) {
      lines.push(`  ${id} — ${formatBucket(bucket)}`);
    }
  }

  // Transparency, not a financial gap — the cost for these IDs is still
  // counted in the ticket figures above (see cost-attribution.js's own
  // comment); this must never read as "money went missing."
  if (rollup.unattributed && rollup.unattributed.length) {
    lines.push('Note: some task IDs could not be attributed to a phase (cost is still counted in the ticket figures above):');
    for (const entry of rollup.unattributed) {
      lines.push(`  session ${entry.session}: ${entry.ids.join(', ')}`);
    }
  }

  lines.push('=========================');
  return lines;
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) return fail('report', parsed.values, parsed.errors.join('; '));

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  const dataJson = readJsonIfExists(paths.DATA_JSON());
  const config = readConfig();
  const externalInput = readJsonInput(parsed.values['plan-data']);
  const plan = readPlan(config, { planContent, statusContent, externalData: externalInput.ok ? externalInput.data : undefined });
  const phaseHeadings = extractPhaseHeadings(planContent);

  const lines = buildReportLines({
    dataJson,
    phaseHeadings,
    planSource: plan.source,
    planAvailable: plan.available,
    planNote: plan.note,
    phaseFilter: parsed.values.phase,
    ticketFilter: parsed.values.ticket,
  });

  return ok('report', parsed.values, lines.join('\n'));
}

module.exports = { name: 'report', execute, buildReportLines };
