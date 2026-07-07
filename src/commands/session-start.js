// Automatic (hook-fired) per docs/specs/command-canon.md. Per Hard Law #5,
// this command must never fail or block on unexpected input — unlike the
// six Intentional commands, unrecognized args here become a warning folded
// into `message` with ok: true, not a failure. Do not "fix" this to match
// the other stubs' error behavior.

const path = require('path');
const { parseArgs } = require('../lib/args');
const { ok } = require('../lib/result');
const { readIfExists, readJsonIfExists } = require('../lib/fs-helpers');
const {
  extractProjectName,
  extractVersion,
  extractHeaderField,
  extractLatestSessionLogEntry,
  extractBlockers,
} = require('../lib/markdown');
const paths = require('../lib/paths');

const SPEC = {};

function costLabelForTotals(dataJson) {
  if (!dataJson || !Array.isArray(dataJson.sessions) || dataJson.sessions.length === 0) {
    return null;
  }
  const allActual = dataJson.sessions.every((s) => s.cost_label === 'actual');
  return allActual ? 'actual' : 'estimate';
}

function buildOrientation() {
  const manifestContent = readIfExists(paths.MANIFEST());
  const statusContent = readIfExists(paths.STATUS_REPORT());
  const planContent = readIfExists(paths.PROJECT_PLAN());
  const dataJson = readJsonIfExists(paths.DATA_JSON());

  const missing = [];
  if (!manifestContent) missing.push('sitrep/MANIFEST.md');
  if (!statusContent) missing.push('sitrep/STATUS_REPORT.md');

  const projectName = extractProjectName(planContent, path.basename(process.cwd()));
  const version = extractVersion(manifestContent);
  const lastSession = extractLatestSessionLogEntry(statusContent);
  const currentPhase = extractHeaderField(statusContent, 'Current Phase') || 'unknown';
  const overall = extractHeaderField(statusContent, 'Overall Progress') || 'unknown';
  const blockers = extractBlockers(statusContent);

  let costLine = 'not tracked';
  if (dataJson && dataJson.totals) {
    const label = costLabelForTotals(dataJson) || 'estimate';
    costLine = `$${Number(dataJson.totals.cost_usd || 0).toFixed(2)} across ${dataJson.totals.sessions || 0} sessions (${label})`;
  }

  const lines = [
    `=== ${projectName} SESSION START ===`,
    `sitrep: ${version === 'unknown' ? 'unknown' : 'v' + version}`,
    lastSession
      ? `Last session: ${lastSession.number} — ${lastSession.date} — ${lastSession.fields.User || 'unknown'} — ${lastSession.fields.Focus || 'unknown'}`
      : 'Last session: none recorded',
    `Current phase: ${currentPhase}`,
    `Overall: ${overall}`,
    `Total cost to date: ${costLine}`,
    `Blockers: ${blockers.length ? blockers.join('; ') : 'None'}`,
    `Queued for this session: ${lastSession && lastSession.fields.Next ? lastSession.fields.Next : 'none recorded'}`,
    '=====================================',
  ];

  if (missing.length > 0) {
    lines.push(`⚠️ Missing: ${missing.join(', ')} — run selfheal to diagnose and fix.`);
  }

  // GETSITREP-26 (plan-presence guard): detect and mention, never block —
  // session-start is hook-fired and must stay non-interactive (Hard Law
  // #5), so the actual "generate a draft?" confirmation lives in
  // plan-update, not here.
  if (!planContent) {
    lines.push('⚠️ No sitrep/PROJECT_PLAN.md found — run `plan-update --generate` to create a draft from your repo, or write your own.');
  }

  return lines.join('\n');
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  const warning = parsed.ok ? '' : `\n(ignored: ${parsed.errors.join('; ')})`;
  const orientation = buildOrientation();
  return ok('session-start', parsed.values, `${orientation}${warning}`);
}

module.exports = { name: 'session-start', execute };
