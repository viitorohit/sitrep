// Intentional (manually invoked) per docs/specs/command-canon.md.
// Absorbs /pulse's session command tracker + next-suggestion logic.

const { parseArgs } = require('../lib/args');
const { ok, fail } = require('../lib/result');
const { readIfExists, appendLine, exists } = require('../lib/fs-helpers');
const {
  extractProjectName,
  extractHeaderField,
  extractBlockers,
} = require('../lib/markdown');
const paths = require('../lib/paths');

const SPEC = {};

const TRACKED_COMMANDS = [
  'session-start',
  'capture',
  'plan-update',
  'selfheal',
  'handoff',
  'dashboard',
  'session-end',
];

function parseTracker(content) {
  if (!content) return [];
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [command, timestamp] = line.split('|');
      return { command, timestamp };
    });
}

function formatTrackerLine(command, entries) {
  const matches = entries.filter((e) => e.command === command);
  if (matches.length === 0) return `  /${command}  [── not run]`;
  const last = matches[matches.length - 1];
  const time = new Date(last.timestamp);
  const timeStr = isNaN(time.getTime()) ? last.timestamp : time.toLocaleTimeString();
  const countSuffix = matches.length > 1 ? ` (×${matches.length})` : '';
  return `  /${command}  [✅ ${timeStr}${countSuffix}]`;
}

function suggestNext(entries, blockers) {
  const ran = (cmd) => entries.some((e) => e.command === cmd);

  if (!ran('session-start')) {
    return '💡 Next: /session-start — orient yourself before working.';
  }
  if (ran('session-end')) {
    return "💡 Session complete. Optional: /handoff (switching context) or /dashboard (visual report).";
  }
  if (blockers.length > 0) {
    return '⚠️ Active blockers detected. Consider /plan-update to address them.';
  }
  const anyOtherRan = TRACKED_COMMANDS.filter((c) => c !== 'session-start' && c !== 'session-end').some(ran);
  if (!anyOtherRan) {
    return '💡 Next: Start building. Use /capture for new tasks.';
  }
  return '💡 Next: Keep building. /session-end when done.';
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  if (!parsed.ok) {
    return fail('sitrep', parsed.values, parsed.errors.join('; '));
  }

  const statusContent = readIfExists(paths.STATUS_REPORT());
  if (!statusContent) {
    return fail('sitrep', parsed.values, '⚠️ No STATUS_REPORT.md found. Run selfheal to diagnose, or session-end to create one.');
  }

  const planContent = readIfExists(paths.PROJECT_PLAN());
  const projectName = extractProjectName(planContent, 'project');

  const trackerPath = paths.ACTIVE_SESSION();
  const trackerExisted = exists(trackerPath);
  const trackerContent = readIfExists(trackerPath);
  const entries = parseTracker(trackerContent);

  if (trackerExisted) {
    appendLine(trackerPath, `sitrep|${new Date().toISOString()}`);
  }

  const currentPhase = extractHeaderField(statusContent, 'Current Phase') || 'unknown';
  const overall = extractHeaderField(statusContent, 'Overall Progress') || 'unknown';
  const lastUpdated = extractHeaderField(statusContent, 'Last Updated') || 'unknown';
  const blockers = extractBlockers(statusContent);
  const lines = [];

  if (trackerExisted) {
    lines.push('Session Commands:');
    for (const cmd of TRACKED_COMMANDS) {
      lines.push(formatTrackerLine(cmd, entries));
    }
    lines.push(`Commands run: ${new Set(entries.map((e) => e.command)).size} of ${TRACKED_COMMANDS.length + 1}`);
    lines.push('');
  }

  lines.push(`=== ${projectName} SITREP ===`);
  lines.push(`Phase: ${currentPhase}`);
  lines.push(`Overall: ${overall}`);
  lines.push(`Blockers: ${blockers.length ? blockers.join('; ') : 'None'}`);
  lines.push(`Last update: ${lastUpdated}`);
  lines.push('========================');

  // GETSITREP-26 (plan-presence guard): detect and mention only — sitrep is
  // documented as fast/read-only, so the actual "generate a draft?"
  // confirmation lives in plan-update, not here.
  if (!planContent) {
    lines.push('⚠️ No sitrep/PROJECT_PLAN.md found — run `plan-update --generate` to create a draft, or write your own.');
  }

  lines.push('');
  lines.push(suggestNext(entries, blockers));

  return ok('sitrep', parsed.values, lines.join('\n'));
}

module.exports = { name: 'sitrep', execute };
