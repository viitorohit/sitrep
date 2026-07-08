// GETSITREP-35: proactive command advisor — the mid-session hook-fired
// counterpart to session-start/session-end's session-boundary automation.
// Bound to PostToolUse (see src/lib/hooks.js) on every committed platform
// that confirms that event (Claude Code, Codex, Cursor — per
// docs/specs/adapter-contract.md's Hook event support table).
//
// Per Hard Law #5: must never block or fail the host tool's turn. Every
// internal step is wrapped so an unexpected error degrades to silent no-op,
// never a thrown error or non-zero exit.
//
// "One-tap accept/dismiss" (the ticket's own phrasing) doesn't have a literal
// UI to bind to here — a hook process has no interactive channel back to the
// user. The honest implementation of that intent: print at most one
// suggestion line, non-blocking, and "dismiss" is simply not acting on it —
// same non-interactive-nudge pattern GETSITREP-26 already established for
// the plan-presence guard.
//
// Only fires the highest-priority currently-eligible trigger, never more
// than one per invocation, and never the same trigger id twice per nudge-
// state lifetime (see src/lib/nudge-state.js) — the no-nag discipline this
// Story requires.

const { parseArgs } = require('../lib/args');
const { ok } = require('../lib/result');
const { readJsonIfExists, exists } = require('../lib/fs-helpers');
const { hasUncommittedChanges } = require('../lib/git');
const { readHashManifest, computeManifest, diffManifest } = require('../lib/manifest');
const { evaluateTriggers } = require('../lib/nudge-triggers');
const { tick, hasFired, markFired } = require('../lib/nudge-state');
const paths = require('../lib/paths');
const fs = require('fs');

const SPEC = {};

function safeDriftResult() {
  try {
    const baseline = readHashManifest();
    if (!baseline) return null;
    const { modified, added, removed } = diffManifest(baseline, computeManifest());
    return { drifted: [...modified, ...added, ...removed] };
  } catch {
    return null;
  }
}

function safeDashboardArchiveCount() {
  try {
    if (!exists(paths.HISTORY_DASHBOARDS())) return 0;
    return fs.readdirSync(paths.HISTORY_DASHBOARDS()).filter((f) => f.endsWith('.html')).length;
  } catch {
    return 0;
  }
}

function gatherState() {
  const nudgeState = tick();
  const dataJson = readJsonIfExists(paths.DATA_JSON());
  const sessionCount = (dataJson && dataJson.totals && dataJson.totals.sessions) || 0;

  return {
    tickCount: nudgeState.tickCount,
    driftResult: safeDriftResult(),
    hasUncommittedChanges: hasUncommittedChanges(),
    sessionCount,
    dashboardArchiveCount: safeDashboardArchiveCount(),
    nudgeState,
  };
}

function execute(argv) {
  const parsed = parseArgs(argv, SPEC);
  try {
    const state = gatherState();
    const eligible = evaluateTriggers(state);
    const next = eligible.find((n) => !hasFired(state.nudgeState, n.triggerId));

    if (!next) {
      return ok('nudge-check', parsed.values, '');
    }

    markFired(next.triggerId);
    return ok('nudge-check', parsed.values, `💡 sitrep: consider \`/${next.command}\` — ${next.reason}`);
  } catch {
    // Fail-open, unconditionally — a broken nudge check must never surface
    // as an error in the host tool's turn.
    return ok('nudge-check', parsed.values, '');
  }
}

module.exports = { name: 'nudge-check', execute };
